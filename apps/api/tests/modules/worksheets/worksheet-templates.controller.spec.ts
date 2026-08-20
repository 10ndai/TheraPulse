import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { UserRole, WorksheetType } from '@prisma/client';
import { WorksheetTemplatesController } from '../../../src/modules/worksheets/worksheet-templates.controller';
import { WorksheetTemplatesService } from '../../../src/modules/worksheets/worksheet-templates.service';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../../../src/modules/auth/auth.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

const therapistReq = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: 'therapist-uuid', role: UserRole.THERAPIST },
} as unknown as AuthenticatedRequest;

const adminReq = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: 'admin-uuid', role: UserRole.ADMIN },
} as unknown as AuthenticatedRequest;

const clientReq = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: 'client-uuid', role: UserRole.CLIENT },
} as unknown as AuthenticatedRequest;

const mockTemplate = {
  id: 'template-uuid-001',
  title: 'Test Template',
  type: WorksheetType.CUSTOM,
  formSchema: { version: 1, fields: [] },
  scoringConfig: null,
  isSystem: false,
  createdById: 'therapist-uuid',
  isPublished: false,
  version: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPaginated = {
  data: [mockTemplate],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('WorksheetTemplatesController', () => {
  let controller: WorksheetTemplatesController;
  let mockService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockService = {
      createTemplate: vi.fn(),
      getTemplate: vi.fn(),
      listTemplates: vi.fn(),
      updateTemplate: vi.fn(),
      publishTemplate: vi.fn(),
      cloneTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [WorksheetTemplatesController],
      providers: [{ provide: WorksheetTemplatesService, useValue: mockService }],
    }).compile();

    controller = module.get<WorksheetTemplatesController>(WorksheetTemplatesController);
  });

  // ── POST /worksheet-templates ─────────────────────────────────────────────

  describe('POST /worksheet-templates', () => {
    const dto = {
      title: 'New Template',
      type: WorksheetType.CUSTOM,
      formSchema: { version: 1, fields: [] },
    };

    it('returns success envelope with created template', async () => {
      mockService.createTemplate.mockResolvedValue(mockTemplate);

      const result = await controller.create(dto, therapistReq);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTemplate);
    });

    it('passes actor id and role to service', async () => {
      mockService.createTemplate.mockResolvedValue(mockTemplate);

      await controller.create(dto, therapistReq);

      expect(mockService.createTemplate).toHaveBeenCalledWith(
        dto,
        'therapist-uuid',
        UserRole.THERAPIST,
        expect.any(Object),
        undefined,
      );
    });

    it('passes isSystem flag when provided by ADMIN', async () => {
      mockService.createTemplate.mockResolvedValue(mockTemplate);

      await controller.create({ ...dto, isSystem: true }, adminReq);

      expect(mockService.createTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        'admin-uuid',
        UserRole.ADMIN,
        expect.any(Object),
        true,
      );
    });
  });

  // ── GET /worksheet-templates ──────────────────────────────────────────────

  describe('GET /worksheet-templates', () => {
    it('returns success envelope with paginated templates', async () => {
      mockService.listTemplates.mockResolvedValue(mockPaginated);

      const result = await controller.list({}, therapistReq);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPaginated.data);
      expect(result.meta).toEqual(mockPaginated.meta);
    });

    it('passes actor context to service', async () => {
      mockService.listTemplates.mockResolvedValue(mockPaginated);

      await controller.list({ type: WorksheetType.PHQ9 }, clientReq);

      expect(mockService.listTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ type: WorksheetType.PHQ9 }),
        expect.any(Object),
        'client-uuid',
        UserRole.CLIENT,
      );
    });
  });

  // ── GET /worksheet-templates/:id ──────────────────────────────────────────

  describe('GET /worksheet-templates/:id', () => {
    it('returns success envelope with template', async () => {
      mockService.getTemplate.mockResolvedValue(mockTemplate);

      const result = await controller.getOne('template-uuid-001', therapistReq);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTemplate);
    });
  });

  // ── PATCH /worksheet-templates/:id ────────────────────────────────────────

  describe('PATCH /worksheet-templates/:id', () => {
    it('returns success envelope with updated template', async () => {
      const updated = { ...mockTemplate, title: 'Updated' };
      mockService.updateTemplate.mockResolvedValue(updated);

      const result = await controller.update(
        'template-uuid-001',
        { title: 'Updated' },
        therapistReq,
      );

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Updated');
    });
  });

  // ── POST /worksheet-templates/:id/publish ─────────────────────────────────

  describe('POST /worksheet-templates/:id/publish', () => {
    it('returns success envelope with published template', async () => {
      const published = { ...mockTemplate, isPublished: true, version: 2 };
      mockService.publishTemplate.mockResolvedValue(published);

      const result = await controller.publish('template-uuid-001', therapistReq);

      expect(result.success).toBe(true);
      expect(result.data.isPublished).toBe(true);
      expect(result.data.version).toBe(2);
    });
  });

  // ── POST /worksheet-templates/:id/clone ───────────────────────────────────

  describe('POST /worksheet-templates/:id/clone', () => {
    it('returns success envelope with cloned draft template', async () => {
      const cloned = { ...mockTemplate, id: 'clone-uuid', title: 'Copy of Test Template' };
      mockService.cloneTemplate.mockResolvedValue(cloned);

      const result = await controller.clone('template-uuid-001', therapistReq);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('clone-uuid');
    });
  });

  // ── DELETE /worksheet-templates/:id ──────────────────────────────────────

  describe('DELETE /worksheet-templates/:id', () => {
    it('returns success envelope with null data', async () => {
      mockService.deleteTemplate.mockResolvedValue(undefined);

      const result = await controller.delete('template-uuid-001', therapistReq);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });
});
