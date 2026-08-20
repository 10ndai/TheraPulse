import { Injectable } from '@nestjs/common';
import type { SessionNote, SessionNoteVersion } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateSessionNoteData,
  CreateVersionData,
  ISessionNoteRepository,
  SessionNoteFilters,
} from './session-notes.repository.interface';

@Injectable()
export class SessionNotesRepository implements ISessionNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filters: SessionNoteFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<SessionNote>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(filters.therapistId ? { therapistId: filters.therapistId } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.sessionNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sessionDate: 'desc' },
      }),
      this.prisma.sessionNote.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<SessionNote | null> {
    return this.prisma.sessionNote.findUnique({ where: { id } });
  }

  async create(data: CreateSessionNoteData): Promise<SessionNote> {
    return this.prisma.sessionNote.create({ data });
  }

  async update(id: string, data: Partial<SessionNote>): Promise<SessionNote> {
    return this.prisma.sessionNote.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.sessionNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async createVersion(data: CreateVersionData): Promise<SessionNoteVersion> {
    return this.prisma.sessionNoteVersion.create({ data });
  }

  async listVersions(sessionNoteId: string): Promise<SessionNoteVersion[]> {
    return this.prisma.sessionNoteVersion.findMany({
      where: { sessionNoteId },
      orderBy: { version: 'desc' },
    });
  }
}
