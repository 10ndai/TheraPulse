import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, WorksheetType } from '@prisma/client';
import { WorksheetTemplatesService } from '../../../src/modules/worksheets/worksheet-templates.service';
import { WORKSHEET_TEMPLATE_REPOSITORY } from '../../../src/modules/worksheets/worksheet-templates.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '../../../src/modules/audit-logs/audit-log.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };
const adminId = '00000000-0000-0000-0000-000000000099';
const therapistId = '00000000-0000-0000-0000-000000000001';
const otherTherapistId = '00000000-0000-0000-0000-000000000002';
const clientId = '00000000-0000-0000-0000-000000000003';

const makeDraftTemplate = (overrides = {}) => ({
  id: '10000000-0000-0000-0000-000000000001',
  title: 'Test Template',
  type: WorksheetType.CUSTOM,
  formSchema: { version: 1, fields: [] },
  scoringConfig: null,
  isSystem: false,
  createdById: therapistId,
  isPublished: false,
  version: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const makePublishedTemplate = (overrides = {}) =>
  makeDraftTemplate({ isPublished: true, ...overrides });

describe('WorksheetTemplatesService', () => {
  let service: WorksheetTemplatesService;
  let mockRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockAuditRepo: { create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      findByFilters: vi.fn(),
    };
    mockAuditRepo = { create: vi.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        WorksheetTemplatesService,
        AuditLogService,
        { provide: WORKSHEET_TEMPLATE_REPOSITORY, useValue: mockRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
      ],
    }).compile();

    service = module.get<WorksheetTemplatesService>(WorksheetTemplatesService);
  });

  // ── createTemplate() ────────────────────────────────────────────────────

  describe('createTemplate()', () => {
    const dto = {
      title: 'CBT Thought Record',
      type: WorksheetType.CUSTOM,
      formSchema: { version: 1, fields: [] },
    };

    it('creates a template for a THERAPIST actor', async () => {
      const created = makeDraftTemplate({ createdById: therapistId });
      mockRepo.create.mockResolvedValue(created);

      const result = await service.createTemplate(dto, therapistId, UserRole.THERAPIST, mockMeta);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: dto.title,
          createdBy: { connect: { id: therapistId } },
          isSystem: false,
        }),
      );
      expect(result).toEqual(created);
    });

    it('creates a system template when actor is ADMIN and isSystem is true', async () => {
      const created = makeDraftTemplate({ createdById: adminId, isSystem: true });
      mockRepo.create.mockResolvedValue(created);

      await service.createTemplate(dto, adminId, UserRole.ADMIN, mockMeta, true);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isSystem: true }));
    });

    it('forces isSystem to false when THERAPIST requests it', async () => {
      const created = makeDraftTemplate({ createdById: therapistId, isSystem: false });
      mockRepo.create.mockResolvedValue(created);

      await service.createTemplate(dto, therapistId, UserRole.THERAPIST, mockMeta, true);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isSystem: false }));
    });

    it('throws ForbiddenException for CLIENT actor', async () => {
      await expect(
        service.createTemplate(dto, clientId, UserRole.CLIENT, mockMeta),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates template in DRAFT state (isPublished = false)', async () => {
      const created = makeDraftTemplate();
      mockRepo.create.mockResolvedValue(created);

      await service.createTemplate(dto, therapistId, UserRole.THERAPIST, mockMeta);

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isPublished: false }));
    });

    it('logs an audit entry', async () => {
      const created = makeDraftTemplate();
      mockRepo.create.mockResolvedValue(created);

      await service.createTemplate(dto, therapistId, UserRole.THERAPIST, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_template.create', actorId: therapistId }),
      );
    });
  });

  // ── getTemplate() ────────────────────────────────────────────────────────

  describe('getTemplate()', () => {
    it('throws NotFoundException when template does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.getTemplate('nonexistent', therapistId, UserRole.THERAPIST),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns own draft template for THERAPIST owner', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);

      const result = await service.getTemplate(template.id, therapistId, UserRole.THERAPIST);

      expect(result).toEqual(template);
    });

    it("throws ForbiddenException when THERAPIST tries to view another therapist's draft", async () => {
      const template = makeDraftTemplate({ createdById: otherTherapistId, isPublished: false });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.getTemplate(template.id, therapistId, UserRole.THERAPIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns published template for any THERAPIST', async () => {
      const template = makePublishedTemplate({ createdById: otherTherapistId });
      mockRepo.findById.mockResolvedValue(template);

      const result = await service.getTemplate(template.id, therapistId, UserRole.THERAPIST);

      expect(result).toEqual(template);
    });

    it('returns published template for CLIENT', async () => {
      const template = makePublishedTemplate();
      mockRepo.findById.mockResolvedValue(template);

      const result = await service.getTemplate(template.id, clientId, UserRole.CLIENT);

      expect(result).toEqual(template);
    });

    it('throws ForbiddenException when CLIENT tries to view unpublished template', async () => {
      const template = makeDraftTemplate({ isPublished: false });
      mockRepo.findById.mockResolvedValue(template);

      await expect(service.getTemplate(template.id, clientId, UserRole.CLIENT)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ADMIN can view any template regardless of published status', async () => {
      const template = makeDraftTemplate({ createdById: therapistId, isPublished: false });
      mockRepo.findById.mockResolvedValue(template);

      const result = await service.getTemplate(template.id, adminId, UserRole.ADMIN);

      expect(result).toEqual(template);
    });
  });

  // ── updateTemplate() ─────────────────────────────────────────────────────

  describe('updateTemplate()', () => {
    it('updates a draft template', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      const updated = { ...template, title: 'Updated Title' };
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue(updated);

      const result = await service.updateTemplate(
        template.id,
        { title: 'Updated Title' },
        therapistId,
        UserRole.THERAPIST,
        mockMeta,
      );

      expect(mockRepo.update).toHaveBeenCalledWith(template.id, { title: 'Updated Title' });
      expect(result).toEqual(updated);
    });

    it('throws BadRequestException when template is published (immutable)', async () => {
      const template = makePublishedTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.updateTemplate(
          template.id,
          { title: 'New' },
          therapistId,
          UserRole.THERAPIST,
          mockMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when actor is not the owner', async () => {
      const template = makeDraftTemplate({ createdById: otherTherapistId });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.updateTemplate(
          template.id,
          { title: 'New' },
          therapistId,
          UserRole.THERAPIST,
          mockMeta,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN can update any draft template', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue({ ...template, title: 'Admin Update' });

      await service.updateTemplate(
        template.id,
        { title: 'Admin Update' },
        adminId,
        UserRole.ADMIN,
        mockMeta,
      );

      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('logs an audit entry on update', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue(template);

      await service.updateTemplate(
        template.id,
        { title: 'New' },
        therapistId,
        UserRole.THERAPIST,
        mockMeta,
      );

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_template.update', actorId: therapistId }),
      );
    });
  });

  // ── publishTemplate() ────────────────────────────────────────────────────

  describe('publishTemplate()', () => {
    it('publishes a draft template and increments version', async () => {
      const template = makeDraftTemplate({ createdById: therapistId, version: 1 });
      const published = { ...template, isPublished: true, version: 2 };
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue(published);

      const result = await service.publishTemplate(
        template.id,
        therapistId,
        UserRole.THERAPIST,
        mockMeta,
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        template.id,
        expect.objectContaining({ isPublished: true, version: 2 }),
      );
      expect(result.isPublished).toBe(true);
      expect(result.version).toBe(2);
    });

    it('throws BadRequestException when template is already published', async () => {
      const template = makePublishedTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.publishTemplate(template.id, therapistId, UserRole.THERAPIST, mockMeta),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when actor is not the owner', async () => {
      const template = makeDraftTemplate({ createdById: otherTherapistId });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.publishTemplate(template.id, therapistId, UserRole.THERAPIST, mockMeta),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN can publish any template', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue({ ...template, isPublished: true, version: 2 });

      await service.publishTemplate(template.id, adminId, UserRole.ADMIN, mockMeta);

      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('logs an audit entry on publish', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue({ ...template, isPublished: true, version: 2 });

      await service.publishTemplate(template.id, therapistId, UserRole.THERAPIST, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_template.publish', actorId: therapistId }),
      );
    });
  });

  // ── cloneTemplate() ──────────────────────────────────────────────────────

  describe('cloneTemplate()', () => {
    it('clones a published template into a new draft for a THERAPIST', async () => {
      const template = makePublishedTemplate({ title: 'PHQ-9' });
      const cloned = makeDraftTemplate({
        title: 'Copy of PHQ-9',
        createdById: therapistId,
        isPublished: false,
      });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.create.mockResolvedValue(cloned);

      const result = await service.cloneTemplate(
        template.id,
        therapistId,
        UserRole.THERAPIST,
        mockMeta,
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: `Copy of ${template.title}`,
          isPublished: false,
          isSystem: false,
          version: 1,
          createdBy: { connect: { id: therapistId } },
        }),
      );
      expect(result.isPublished).toBe(false);
    });

    it('throws NotFoundException when source template does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.cloneTemplate('nonexistent', therapistId, UserRole.THERAPIST, mockMeta),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for CLIENT actor', async () => {
      const template = makePublishedTemplate();
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.cloneTemplate(template.id, clientId, UserRole.CLIENT, mockMeta),
      ).rejects.toThrow(ForbiddenException);
    });

    it('logs an audit entry on clone', async () => {
      const template = makePublishedTemplate();
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.create.mockResolvedValue(makeDraftTemplate({ createdById: therapistId }));

      await service.cloneTemplate(template.id, therapistId, UserRole.THERAPIST, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_template.clone', actorId: therapistId }),
      );
    });
  });

  // ── deleteTemplate() ─────────────────────────────────────────────────────

  describe('deleteTemplate()', () => {
    it('deletes template when actor is the owner', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.softDelete.mockResolvedValue(undefined);

      await service.deleteTemplate(template.id, therapistId, UserRole.THERAPIST, mockMeta);

      expect(mockRepo.softDelete).toHaveBeenCalledWith(template.id);
    });

    it('throws NotFoundException when template does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.deleteTemplate('nonexistent', therapistId, UserRole.THERAPIST, mockMeta),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when actor is not the owner', async () => {
      const template = makeDraftTemplate({ createdById: otherTherapistId });
      mockRepo.findById.mockResolvedValue(template);

      await expect(
        service.deleteTemplate(template.id, therapistId, UserRole.THERAPIST, mockMeta),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN can delete any template', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.softDelete.mockResolvedValue(undefined);

      await service.deleteTemplate(template.id, adminId, UserRole.ADMIN, mockMeta);

      expect(mockRepo.softDelete).toHaveBeenCalledWith(template.id);
    });

    it('logs an audit entry on delete', async () => {
      const template = makeDraftTemplate({ createdById: therapistId });
      mockRepo.findById.mockResolvedValue(template);
      mockRepo.softDelete.mockResolvedValue(undefined);

      await service.deleteTemplate(template.id, therapistId, UserRole.THERAPIST, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_template.delete', actorId: therapistId }),
      );
    });
  });

  // ── listTemplates() ──────────────────────────────────────────────────────

  describe('listTemplates()', () => {
    it('returns paginated results from repository', async () => {
      const paginated = {
        data: [makeDraftTemplate()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockRepo.findByFilters.mockResolvedValue(paginated);

      const result = await service.listTemplates(
        {},
        { page: 1, limit: 20 },
        adminId,
        UserRole.ADMIN,
      );

      expect(result).toEqual(paginated);
    });

    it('restricts THERAPIST to own + published templates', async () => {
      mockRepo.findByFilters.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await service.listTemplates({}, { page: 1, limit: 20 }, therapistId, UserRole.THERAPIST);

      expect(mockRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: therapistId, actorRole: UserRole.THERAPIST }),
        expect.any(Object),
      );
    });

    it('restricts CLIENT to published-only templates', async () => {
      mockRepo.findByFilters.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await service.listTemplates({}, { page: 1, limit: 20 }, clientId, UserRole.CLIENT);

      expect(mockRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ actorRole: UserRole.CLIENT }),
        expect.any(Object),
      );
    });
  });
});
