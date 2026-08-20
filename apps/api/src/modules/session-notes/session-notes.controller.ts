import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionNote, SessionNoteVersion } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { UserRole } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { SessionNotesService } from './session-notes.service';
import type { CreateNoteDto, UpdateNoteDto } from './session-notes.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

interface ListQuery {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: 'DRAFT' | 'FINALIZED';
}

@Controller('session-notes')
export class SessionNotesController {
  constructor(private readonly service: SessionNotesService) {}

  @Post()
  async create(
    @Body() dto: CreateNoteDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SessionNote }> {
    const { sub: id, role } = req.user;
    const meta = this.extractMeta(req);
    const data = await this.service.createNote(dto, id, role as UserRole, meta);
    return { success: true, data };
  }

  @Get()
  async list(
    @Query() query: ListQuery,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SessionNote[]; meta: PaginatedResult<SessionNote>['meta'] }> {
    const { sub: id, role } = req.user;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const result = await this.service.listNotes(filters, id, role as UserRole, { page, limit });
    return { success: true, data: result.data as SessionNote[], meta: result.meta };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SessionNote }> {
    const { sub: actorId, role } = req.user;
    const data = await this.service.getNote(id, actorId, role as UserRole);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SessionNote }> {
    const { sub: actorId } = req.user;
    const meta = this.extractMeta(req);
    const data = await this.service.updateNote(id, dto, actorId, meta);
    return { success: true, data };
  }

  @Post(':id/finalize')
  async finalize(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SessionNote }> {
    const { sub: actorId } = req.user;
    const meta = this.extractMeta(req);
    const data = await this.service.finalizeNote(id, actorId, meta);
    return { success: true, data };
  }

  @Get(':id/versions')
  async versions(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: SessionNoteVersion[] }> {
    const { sub: actorId, role } = req.user;
    const data = await this.service.getVersionHistory(id, actorId, role as UserRole);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    const { sub: actorId } = req.user;
    const meta = this.extractMeta(req);
    await this.service.deleteNote(id, actorId, meta);
    return { success: true };
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private extractMeta(req: Request): { ip: string; userAgent: string } {
    return {
      ip: req.ip ?? 'unknown',
      userAgent: req.get('user-agent') ?? 'unknown',
    };
  }
}
