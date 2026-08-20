import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, AssignmentStatus } from '@prisma/client';
import { WorksheetAssignmentsService } from '../../../src/modules/worksheets/worksheet-assignments.service';
import { WORKSHEET_ASSIGNMENT_REPOSITORY } from '../../../src/modules/worksheets/worksheet-assignments.repository.interface';
import { WORKSHEET_TEMPLATE_REPOSITORY } from '../../../src/modules/worksheets/worksheet-templates.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';

const therapistId = 'therapist-uuid-001';
const clientId = 'client-uuid-001';
const assignmentId = 'assignment-uuid-001';
const templateId = 'template-uuid-001';

const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };

const mockTemplate = {
  id: templateId,
  title: 'PHQ-9',
  isPublished: true,
  type: 'ASSESSMENT',
  isSystem: true,
  version: 1,
  formSchema: {},
  scoringConfig: null,
  createdById: 'system',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAssignment = {
  id: assignmentId,
  templateId,
  therapistId,
  clientId,
  status: AssignmentStatus.PENDING,
  instructions: null,
  dueDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeRepo = () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  findByFilters: vi.fn(),
});

const makeTemplateRepo = () => ({
  findAll: vi.fn(),
  findById: vi.fn().mockResolvedValue(mockTemplate),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  findByFilters: vi.fn(),
});

const makeAuditService = () => ({
  log: vi.fn().mockResolvedValue(undefined),
});

const makeNotificationsService = () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
});

describe('WorksheetAssignmentsService', () => {
  let service: WorksheetAssignmentsService;
  let assignmentRepo: ReturnType<typeof makeRepo>;
  let templateRepo: ReturnType<typeof makeTemplateRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let notificationsService: ReturnType<typeof makeNotificationsService>;

  beforeEach(async () => {
    assignmentRepo = makeRepo();
    templateRepo = makeTemplateRepo();
    auditService = makeAuditService();
    notificationsService = makeNotificationsService();

    const module = await Test.createTestingModule({
      providers: [
        WorksheetAssignmentsService,
        { provide: WORKSHEET_ASSIGNMENT_REPOSITORY, useValue: assignmentRepo },
        { provide: WORKSHEET_TEMPLATE_REPOSITORY, useValue: templateRepo },
        { provide: AuditLogService, useValue: auditService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(WorksheetAssignmentsService);
  });

  // ─── createAssignment ────────────────────────────────────────────────────────

  describe('createAssignment', () => {
    const dto = {
      templateId,
      clientId,
      instructions: 'Complete daily',
      dueDate: new Date('2026-06-01'),
    };

    it('creates an assignment when therapist assigns to a client', async () => {
      assignmentRepo.create.mockResolvedValue(mockAssignment);
      const result = await service.createAssignment(dto, therapistId, UserRole.THERAPIST, meta);
      expect(result).toEqual(mockAssignment);
      expect(templateRepo.findById).toHaveBeenCalledWith(templateId);
      expect(assignmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          template: { connect: { id: templateId } },
          therapist: { connect: { id: therapistId } },
          client: { connect: { id: clientId } },
        }),
      );
    });

    it('throws ForbiddenException when CLIENT tries to create assignment', async () => {
      await expect(service.createAssignment(dto, clientId, UserRole.CLIENT, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when template does not exist', async () => {
      templateRepo.findById.mockResolvedValue(null);
      await expect(
        service.createAssignment(dto, therapistId, UserRole.THERAPIST, meta),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when template is not published', async () => {
      templateRepo.findById.mockResolvedValue({ ...mockTemplate, isPublished: false });
      await expect(
        service.createAssignment(dto, therapistId, UserRole.THERAPIST, meta),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates audit log entry on successful creation', async () => {
      assignmentRepo.create.mockResolvedValue(mockAssignment);
      await service.createAssignment(dto, therapistId, UserRole.THERAPIST, meta);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_assignment.create', actorId: therapistId }),
      );
    });

    it('ADMIN can also create assignments', async () => {
      assignmentRepo.create.mockResolvedValue(mockAssignment);
      const result = await service.createAssignment(dto, 'admin-uuid', UserRole.ADMIN, meta);
      expect(result).toEqual(mockAssignment);
    });

    it('creates a NEW_ASSIGNMENT notification for the client', async () => {
      assignmentRepo.create.mockResolvedValue(mockAssignment);
      await service.createAssignment(dto, therapistId, UserRole.THERAPIST, meta);
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: clientId,
          type: 'NEW_ASSIGNMENT',
          resourceType: 'WorksheetAssignment',
          resourceId: assignmentId,
        }),
      );
    });
  });

  // ─── listAssignments ─────────────────────────────────────────────────────────

  describe('listAssignments', () => {
    const paginatedResult = {
      data: [mockAssignment],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };

    it('returns all assignments for ADMIN', async () => {
      assignmentRepo.findByFilters.mockResolvedValue(paginatedResult);
      const result = await service.listAssignments({}, 'admin-uuid', UserRole.ADMIN, {
        page: 1,
        limit: 20,
      });
      expect(result).toEqual(paginatedResult);
      expect(assignmentRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ actorRole: UserRole.ADMIN }),
        { page: 1, limit: 20 },
      );
    });

    it('returns only own client assignments for THERAPIST', async () => {
      assignmentRepo.findByFilters.mockResolvedValue(paginatedResult);
      await service.listAssignments({}, therapistId, UserRole.THERAPIST, { page: 1, limit: 20 });
      expect(assignmentRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: therapistId, actorRole: UserRole.THERAPIST }),
        { page: 1, limit: 20 },
      );
    });

    it('returns only own assignments for CLIENT', async () => {
      assignmentRepo.findByFilters.mockResolvedValue(paginatedResult);
      await service.listAssignments({}, clientId, UserRole.CLIENT, { page: 1, limit: 20 });
      expect(assignmentRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: clientId, actorRole: UserRole.CLIENT }),
        { page: 1, limit: 20 },
      );
    });

    it('passes status filter through to repository', async () => {
      assignmentRepo.findByFilters.mockResolvedValue(paginatedResult);
      await service.listAssignments(
        { status: AssignmentStatus.PENDING },
        clientId,
        UserRole.CLIENT,
        { page: 1, limit: 20 },
      );
      expect(assignmentRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssignmentStatus.PENDING }),
        { page: 1, limit: 20 },
      );
    });
  });

  // ─── getAssignment ───────────────────────────────────────────────────────────

  describe('getAssignment', () => {
    it('returns assignment when THERAPIST owns it', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      const result = await service.getAssignment(assignmentId, therapistId, UserRole.THERAPIST);
      expect(result).toEqual(mockAssignment);
    });

    it('returns assignment when CLIENT is the assignee', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      const result = await service.getAssignment(assignmentId, clientId, UserRole.CLIENT);
      expect(result).toEqual(mockAssignment);
    });

    it('returns assignment when actor is ADMIN', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      const result = await service.getAssignment(assignmentId, 'admin-uuid', UserRole.ADMIN);
      expect(result).toEqual(mockAssignment);
    });

    it('throws NotFoundException when assignment does not exist', async () => {
      assignmentRepo.findById.mockResolvedValue(null);
      await expect(
        service.getAssignment(assignmentId, therapistId, UserRole.THERAPIST),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when THERAPIST does not own the assignment', async () => {
      assignmentRepo.findById.mockResolvedValue({
        ...mockAssignment,
        therapistId: 'other-therapist',
      });
      await expect(
        service.getAssignment(assignmentId, therapistId, UserRole.THERAPIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when CLIENT is not the assignee', async () => {
      assignmentRepo.findById.mockResolvedValue({ ...mockAssignment, clientId: 'other-client' });
      await expect(service.getAssignment(assignmentId, clientId, UserRole.CLIENT)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── updateStatus ────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('CLIENT can update status to IN_PROGRESS', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      assignmentRepo.update.mockResolvedValue({
        ...mockAssignment,
        status: AssignmentStatus.IN_PROGRESS,
      });
      const result = await service.updateStatus(
        assignmentId,
        AssignmentStatus.IN_PROGRESS,
        clientId,
        UserRole.CLIENT,
        meta,
      );
      expect(result.status).toBe(AssignmentStatus.IN_PROGRESS);
    });

    it('CLIENT can update status to COMPLETED', async () => {
      assignmentRepo.findById.mockResolvedValue({
        ...mockAssignment,
        status: AssignmentStatus.IN_PROGRESS,
      });
      assignmentRepo.update.mockResolvedValue({
        ...mockAssignment,
        status: AssignmentStatus.COMPLETED,
      });
      const result = await service.updateStatus(
        assignmentId,
        AssignmentStatus.COMPLETED,
        clientId,
        UserRole.CLIENT,
        meta,
      );
      expect(result.status).toBe(AssignmentStatus.COMPLETED);
    });

    it('throws ForbiddenException when THERAPIST tries to update status', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      await expect(
        service.updateStatus(
          assignmentId,
          AssignmentStatus.IN_PROGRESS,
          therapistId,
          UserRole.THERAPIST,
          meta,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when CLIENT is not the assignee', async () => {
      assignmentRepo.findById.mockResolvedValue({ ...mockAssignment, clientId: 'other-client' });
      await expect(
        service.updateStatus(
          assignmentId,
          AssignmentStatus.IN_PROGRESS,
          clientId,
          UserRole.CLIENT,
          meta,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates audit log entry on status update', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      assignmentRepo.update.mockResolvedValue({
        ...mockAssignment,
        status: AssignmentStatus.IN_PROGRESS,
      });
      await service.updateStatus(
        assignmentId,
        AssignmentStatus.IN_PROGRESS,
        clientId,
        UserRole.CLIENT,
        meta,
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'worksheet_assignment.status_update',
          actorId: clientId,
        }),
      );
    });

    it('throws NotFoundException when assignment does not exist', async () => {
      assignmentRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateStatus(
          assignmentId,
          AssignmentStatus.IN_PROGRESS,
          clientId,
          UserRole.CLIENT,
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteAssignment ────────────────────────────────────────────────────────

  describe('deleteAssignment', () => {
    it('THERAPIST can delete their own assignment', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      assignmentRepo.softDelete.mockResolvedValue(undefined);
      await service.deleteAssignment(assignmentId, therapistId, UserRole.THERAPIST, meta);
      expect(assignmentRepo.softDelete).toHaveBeenCalledWith(assignmentId);
    });

    it('ADMIN can delete any assignment', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      assignmentRepo.softDelete.mockResolvedValue(undefined);
      await service.deleteAssignment(assignmentId, 'admin-uuid', UserRole.ADMIN, meta);
      expect(assignmentRepo.softDelete).toHaveBeenCalledWith(assignmentId);
    });

    it('throws ForbiddenException when THERAPIST does not own the assignment', async () => {
      assignmentRepo.findById.mockResolvedValue({
        ...mockAssignment,
        therapistId: 'other-therapist',
      });
      await expect(
        service.deleteAssignment(assignmentId, therapistId, UserRole.THERAPIST, meta),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when CLIENT tries to delete', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      await expect(
        service.deleteAssignment(assignmentId, clientId, UserRole.CLIENT, meta),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when assignment does not exist', async () => {
      assignmentRepo.findById.mockResolvedValue(null);
      await expect(
        service.deleteAssignment(assignmentId, therapistId, UserRole.THERAPIST, meta),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates audit log entry on deletion', async () => {
      assignmentRepo.findById.mockResolvedValue(mockAssignment);
      assignmentRepo.softDelete.mockResolvedValue(undefined);
      await service.deleteAssignment(assignmentId, therapistId, UserRole.THERAPIST, meta);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_assignment.delete', actorId: therapistId }),
      );
    });
  });
});
