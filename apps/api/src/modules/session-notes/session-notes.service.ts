import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SessionNote, SessionNoteVersion } from '@prisma/client';
import { NoteStatus, UserRole } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { EncryptionService } from '../encryption/encryption.service';
import type {
  ISessionNoteRepository,
  SessionNoteFilters,
} from './session-notes.repository.interface';
import { SESSION_NOTE_REPOSITORY } from './session-notes.repository.interface';

export interface CreateNoteDto {
  clientId: string;
  sessionDate: Date;
  sessionType: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
}

export interface UpdateNoteDto {
  sessionDate?: Date;
  sessionType?: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
}

interface RequestMeta {
  ip: string;
  userAgent: string;
}

@Injectable()
export class SessionNotesService {
  constructor(
    @Inject(SESSION_NOTE_REPOSITORY)
    private readonly repo: ISessionNoteRepository,
    private readonly auditLog: AuditLogService,
    private readonly encryption: EncryptionService,
  ) {}

  // ── createNote ────────────────────────────────────────────────────────────────

  async createNote(
    dto: CreateNoteDto,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
  ): Promise<SessionNote> {
    if (actorRole === UserRole.CLIENT) {
      throw new ForbiddenException('Only therapists can create session notes.');
    }

    const therapistId = actorId;
    const note = await this.repo.create({
      therapist: { connect: { id: therapistId } },
      client: { connect: { id: dto.clientId } },
      sessionDate: dto.sessionDate,
      sessionType: dto.sessionType,
      ...(dto.subjective != null ? { subjective: this.encryption.encrypt(dto.subjective) } : {}),
      ...(dto.objective != null ? { objective: this.encryption.encrypt(dto.objective) } : {}),
      ...(dto.assessment != null ? { assessment: this.encryption.encrypt(dto.assessment) } : {}),
      ...(dto.plan != null ? { plan: this.encryption.encrypt(dto.plan) } : {}),
    });

    await this.auditLog.log({
      action: 'session_note.create',
      actorId: therapistId,
      resourceType: 'SessionNote',
      resourceId: note.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: { clientId: dto.clientId },
    });

    return note;
  }

  // ── updateNote ────────────────────────────────────────────────────────────────

  async updateNote(
    id: string,
    dto: UpdateNoteDto,
    therapistId: string,
    meta: RequestMeta,
  ): Promise<SessionNote> {
    const note = await this.repo.findById(id);
    if (!note) throw new NotFoundException(`Session note ${id} not found.`);
    if (note.therapistId !== therapistId)
      throw new ForbiddenException('You can only edit your own session notes.');
    if (note.status === NoteStatus.FINALIZED) {
      throw new BadRequestException('Finalized session notes cannot be edited.');
    }

    // Create version snapshot of current state before updating
    const snapshot = JSON.stringify({
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      sessionDate: note.sessionDate,
      sessionType: note.sessionType,
    });
    await this.repo.createVersion({
      sessionNote: { connect: { id } },
      version: note.version,
      contentSnapshot: this.encryption.encrypt(snapshot),
      changedBy: { connect: { id: therapistId } },
    });

    const encryptedFields: Partial<SessionNote> = {};
    if (dto.subjective !== undefined)
      encryptedFields.subjective =
        dto.subjective != null ? this.encryption.encrypt(dto.subjective) : null;
    if (dto.objective !== undefined)
      encryptedFields.objective =
        dto.objective != null ? this.encryption.encrypt(dto.objective) : null;
    if (dto.assessment !== undefined)
      encryptedFields.assessment =
        dto.assessment != null ? this.encryption.encrypt(dto.assessment) : null;
    if (dto.plan !== undefined)
      encryptedFields.plan = dto.plan != null ? this.encryption.encrypt(dto.plan) : null;

    const updated = await this.repo.update(id, {
      ...encryptedFields,
      ...(dto.sessionDate !== undefined ? { sessionDate: dto.sessionDate } : {}),
      ...(dto.sessionType !== undefined ? { sessionType: dto.sessionType } : {}),
      version: note.version + 1,
    });

    await this.auditLog.log({
      action: 'session_note.update',
      actorId: therapistId,
      resourceType: 'SessionNote',
      resourceId: id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: {},
    });

    return updated;
  }

  // ── finalizeNote ──────────────────────────────────────────────────────────────

  async finalizeNote(id: string, therapistId: string, meta: RequestMeta): Promise<SessionNote> {
    const note = await this.repo.findById(id);
    if (!note) throw new NotFoundException(`Session note ${id} not found.`);
    if (note.therapistId !== therapistId)
      throw new ForbiddenException('You can only finalize your own session notes.');
    if (note.status === NoteStatus.FINALIZED) {
      throw new BadRequestException('Session note is already finalized.');
    }

    const updated = await this.repo.update(id, { status: NoteStatus.FINALIZED });

    await this.auditLog.log({
      action: 'session_note.finalize',
      actorId: therapistId,
      resourceType: 'SessionNote',
      resourceId: id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: {},
    });

    return updated;
  }

  // ── getNote ───────────────────────────────────────────────────────────────────

  async getNote(id: string, actorId: string, actorRole: UserRole): Promise<SessionNote> {
    const note = await this.repo.findById(id);
    if (!note) throw new NotFoundException(`Session note ${id} not found.`);

    this.assertCanView(note, actorId, actorRole);
    return note;
  }

  // ── listNotes ─────────────────────────────────────────────────────────────────

  async listNotes(
    filters: SessionNoteFilters,
    actorId: string,
    actorRole: UserRole,
    options: PaginationOptions,
  ): Promise<PaginatedResult<SessionNote>> {
    const scoped: SessionNoteFilters = { ...filters };

    if (actorRole === UserRole.THERAPIST) {
      scoped.therapistId = actorId;
    } else if (actorRole === UserRole.CLIENT) {
      scoped.clientId = actorId;
    }

    return this.repo.findAll(scoped, options);
  }

  // ── getVersionHistory ─────────────────────────────────────────────────────────

  async getVersionHistory(
    id: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<SessionNoteVersion[]> {
    const note = await this.repo.findById(id);
    if (!note) throw new NotFoundException(`Session note ${id} not found.`);

    this.assertCanView(note, actorId, actorRole);
    return this.repo.listVersions(id);
  }

  // ── deleteNote ────────────────────────────────────────────────────────────────

  async deleteNote(id: string, therapistId: string, meta: RequestMeta): Promise<void> {
    const note = await this.repo.findById(id);
    if (!note) throw new NotFoundException(`Session note ${id} not found.`);
    if (note.therapistId !== therapistId)
      throw new ForbiddenException('You can only delete your own session notes.');
    if (note.status === NoteStatus.FINALIZED) {
      throw new BadRequestException('Finalized session notes cannot be deleted.');
    }

    await this.repo.softDelete(id);

    await this.auditLog.log({
      action: 'session_note.delete',
      actorId: therapistId,
      resourceType: 'SessionNote',
      resourceId: id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      details: {},
    });
  }

  // ── private helpers ────────────────────────────────────────────────────────────

  private assertCanView(note: SessionNote, actorId: string, actorRole: UserRole): void {
    if (actorRole === UserRole.ADMIN) return;

    if (actorRole === UserRole.THERAPIST) {
      if (note.therapistId !== actorId) {
        throw new ForbiddenException('You can only view your own session notes.');
      }
      return;
    }

    // CLIENT
    if (note.clientId !== actorId) {
      throw new ForbiddenException('You can only view session notes about yourself.');
    }
  }
}
