import { createHmac } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token requires value import
import { ConfigService } from '@nestjs/config';
import type { WorksheetSubmission } from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import { Inject } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { EncryptionService } from '../encryption/encryption.service';
import type { IWorksheetAssignmentRepository } from './worksheet-assignments.repository.interface';
import { WORKSHEET_ASSIGNMENT_REPOSITORY } from './worksheet-assignments.repository.interface';
import type {
  IWorksheetSubmissionRepository,
  WorksheetSubmissionFilters,
} from './worksheet-submissions.repository.interface';
import { WORKSHEET_SUBMISSION_REPOSITORY } from './worksheet-submissions.repository.interface';
import type { IWorksheetTemplateRepository } from './worksheet-templates.repository.interface';
import { WORKSHEET_TEMPLATE_REPOSITORY } from './worksheet-templates.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { ScoringService } from './scoring.service';

interface SubmitMeta {
  ip: string;
  userAgent: string;
}

interface SubmitDto {
  assignmentId: string;
  responses: Record<string, unknown>;
  status: 'DRAFT' | 'SUBMITTED';
}

@Injectable()
export class WorksheetSubmissionsService {
  constructor(
    @Inject(WORKSHEET_SUBMISSION_REPOSITORY)
    private readonly subRepo: IWorksheetSubmissionRepository,
    @Inject(WORKSHEET_ASSIGNMENT_REPOSITORY)
    private readonly assignRepo: IWorksheetAssignmentRepository,
    @Inject(WORKSHEET_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IWorksheetTemplateRepository,
    private readonly auditLog: AuditLogService,
    private readonly encryption: EncryptionService,
    private readonly scoring: ScoringService,
    private readonly config: ConfigService,
  ) {}

  // ── submit (create draft or finalize) ─────────────────────────────────────

  async submit(
    dto: SubmitDto,
    actorId: string,
    actorRole: UserRole,
    meta: SubmitMeta,
  ): Promise<WorksheetSubmission> {
    if (actorRole !== UserRole.CLIENT) {
      throw new ForbiddenException('Only clients can submit worksheets.');
    }

    const assignment = await this.assignRepo.findById(dto.assignmentId);
    if (!assignment) {
      throw new NotFoundException(`Assignment ${dto.assignmentId} not found.`);
    }
    if (assignment.clientId !== actorId) {
      throw new ForbiddenException('You can only submit worksheets assigned to you.');
    }

    const existingDraft = await this.subRepo.findDraftByAssignment(dto.assignmentId);

    if (existingDraft?.finalizedAt) {
      throw new BadRequestException(
        'This worksheet has already been submitted and cannot be changed.',
      );
    }

    const responsesJson = JSON.stringify(dto.responses);
    const encryptedResponses = this.encryption.encrypt(responsesJson);
    const isFinalized = dto.status === 'SUBMITTED';
    const finalizedAt = isFinalized ? new Date() : null;

    const integrityHash = this.computeIntegrityHash({
      id: existingDraft?.id ?? 'pending',
      assignmentId: dto.assignmentId,
      clientId: actorId,
      responsesJson,
    });

    // Compute score only on finalization (not on draft saves)
    let scoreJson: Record<string, unknown> | null = null;
    if (isFinalized) {
      const template = await this.templateRepo.findById(assignment.templateId);
      if (template?.scoringConfig && template.formSchema) {
        const scoreResult = this.scoring.score(
          template.scoringConfig as unknown as Parameters<ScoringService['score']>[0],
          template.formSchema as unknown as Parameters<ScoringService['score']>[1],
          dto.responses,
        );
        scoreJson = scoreResult as Record<string, unknown> | null;
      }
    }

    let submission: WorksheetSubmission;

    if (existingDraft) {
      submission = await this.subRepo.update(existingDraft.id, {
        responses: encryptedResponses,
        integrityHash,
        ...(finalizedAt ? { finalizedAt } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(scoreJson !== null ? { score: scoreJson as any } : {}),
      });
    } else {
      submission = await this.subRepo.create({
        assignment: { connect: { id: dto.assignmentId } },
        client: { connect: { id: actorId } },
        responses: encryptedResponses,
        integrityHash,
        ...(finalizedAt ? { finalizedAt } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(scoreJson !== null ? { score: scoreJson as any } : {}),
      });
    }

    if (isFinalized) {
      await this.assignRepo.update(dto.assignmentId, { status: 'COMPLETED' });
      await this.auditLog.log({
        action: 'worksheet_submission.finalized',
        actorId,
        resourceType: 'WorksheetSubmission',
        resourceId: submission.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        details: { assignmentId: dto.assignmentId },
      });
    } else {
      await this.auditLog.log({
        action: 'worksheet_submission.draft',
        actorId,
        resourceType: 'WorksheetSubmission',
        resourceId: submission.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        details: { assignmentId: dto.assignmentId },
      });
    }

    return submission;
  }

  // ── getSubmission ──────────────────────────────────────────────────────────

  async getSubmission(
    id: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<WorksheetSubmission> {
    const submission = await this.subRepo.findById(id);
    if (!submission) throw new NotFoundException(`Submission ${id} not found.`);

    await this.assertCanView(submission, actorId, actorRole);
    return submission;
  }

  // ── verifyIntegrity ────────────────────────────────────────────────────────

  async verifyIntegrity(
    id: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<{ valid: boolean }> {
    const submission = await this.subRepo.findById(id);
    if (!submission) throw new NotFoundException(`Submission ${id} not found.`);

    await this.assertCanView(submission, actorId, actorRole);

    const recomputed = this.computeIntegrityHash({
      id: submission.id,
      assignmentId: submission.assignmentId,
      clientId: submission.clientId,
      responsesJson: submission.responses,
    });

    return { valid: recomputed === submission.integrityHash };
  }

  // ── listSubmissions ────────────────────────────────────────────────────────

  async listSubmissions(
    filters: WorksheetSubmissionFilters,
    actorId: string,
    actorRole: UserRole,
    options: PaginationOptions,
  ): Promise<PaginatedResult<WorksheetSubmission>> {
    const scopedFilters: WorksheetSubmissionFilters = { ...filters };

    if (actorRole === UserRole.CLIENT) {
      scopedFilters.clientId = actorId;
    }
    // THERAPIST and ADMIN use filters as-is (therapist scoping applied at query layer)

    return this.subRepo.findAll(scopedFilters, options);
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private async assertCanView(
    submission: WorksheetSubmission,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    if (actorRole === UserRole.ADMIN) return;

    if (actorRole === UserRole.CLIENT) {
      if (submission.clientId !== actorId) {
        throw new ForbiddenException('You can only view your own submissions.');
      }
      return;
    }

    // THERAPIST: must own the assignment
    const assignment = await this.assignRepo.findById(submission.assignmentId);
    if (!assignment || assignment.therapistId !== actorId) {
      throw new ForbiddenException('You can only view submissions for your own clients.');
    }
  }

  private computeIntegrityHash(params: {
    id: string;
    assignmentId: string;
    clientId: string;
    responsesJson: string;
  }): string {
    const hmacKey = this.config.get<string>('INTEGRITY_HMAC_KEY') ?? '';
    const payload = `${params.id}${params.assignmentId}${params.clientId}${params.responsesJson}`;
    return createHmac('sha512', hmacKey).update(payload).digest('hex');
  }
}
