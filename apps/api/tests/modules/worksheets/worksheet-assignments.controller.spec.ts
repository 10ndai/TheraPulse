import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, AssignmentStatus } from '@prisma/client';
import { WorksheetAssignmentsController } from '../../../src/modules/worksheets/worksheet-assignments.controller';
import { WorksheetAssignmentsService } from '../../../src/modules/worksheets/worksheet-assignments.service';

const therapistId = 'therapist-uuid-001';
const clientId = 'client-uuid-001';
const assignmentId = 'assignment-uuid-001';
const templateId = 'template-uuid-001';

const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

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

const makeService = () => ({
  createAssignment: vi.fn().mockResolvedValue(mockAssignment),
  listAssignments: vi.fn().mockResolvedValue({
    data: [mockAssignment],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  }),
  getAssignment: vi.fn().mockResolvedValue(mockAssignment),
  updateStatus: vi
    .fn()
    .mockResolvedValue({ ...mockAssignment, status: AssignmentStatus.IN_PROGRESS }),
  deleteAssignment: vi.fn().mockResolvedValue(undefined),
});

function makeReq(role: UserRole, id: string) {
  return {
    user: { sub: id, role },
    ip: '127.0.0.1',
    get: () => 'test',
    headers: { 'user-agent': 'test' },
  };
}

describe('WorksheetAssignmentsController', () => {
  let controller: WorksheetAssignmentsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module = await Test.createTestingModule({
      controllers: [WorksheetAssignmentsController],
      providers: [{ provide: WorksheetAssignmentsService, useValue: service }],
    }).compile();
    controller = module.get(WorksheetAssignmentsController);
  });

  describe('POST /worksheet-assignments', () => {
    it('calls service.createAssignment and returns {success: true, data}', async () => {
      const dto = { templateId, clientId, instructions: 'Do this', dueDate: undefined };
      const req = makeReq(UserRole.THERAPIST, therapistId);
      const result = await controller.create(dto, req as never);
      expect(result).toEqual({ success: true, data: mockAssignment });
      expect(service.createAssignment).toHaveBeenCalledWith(
        dto,
        therapistId,
        UserRole.THERAPIST,
        meta,
      );
    });

    it('propagates ForbiddenException from service', async () => {
      service.createAssignment.mockRejectedValue(new ForbiddenException());
      const req = makeReq(UserRole.CLIENT, clientId);
      await expect(
        controller.create({ templateId, clientId } as never, req as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /worksheet-assignments', () => {
    it('returns paginated list wrapped in envelope', async () => {
      const req = makeReq(UserRole.THERAPIST, therapistId);
      const result = await controller.list({}, req as never, { page: 1, limit: 20 });
      expect(result).toEqual({
        success: true,
        data: [mockAssignment],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });
  });

  describe('GET /worksheet-assignments/:id', () => {
    it('returns single assignment wrapped in envelope', async () => {
      const req = makeReq(UserRole.THERAPIST, therapistId);
      const result = await controller.getOne(assignmentId, req as never);
      expect(result).toEqual({ success: true, data: mockAssignment });
      expect(service.getAssignment).toHaveBeenCalledWith(
        assignmentId,
        therapistId,
        UserRole.THERAPIST,
      );
    });

    it('propagates NotFoundException from service', async () => {
      service.getAssignment.mockRejectedValue(new NotFoundException());
      const req = makeReq(UserRole.THERAPIST, therapistId);
      await expect(controller.getOne('nonexistent', req as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('PATCH /worksheet-assignments/:id/status', () => {
    it('calls service.updateStatus and returns updated assignment', async () => {
      const req = makeReq(UserRole.CLIENT, clientId);
      const result = await controller.updateStatus(
        assignmentId,
        { status: AssignmentStatus.IN_PROGRESS },
        req as never,
      );
      expect(result).toEqual({
        success: true,
        data: { ...mockAssignment, status: AssignmentStatus.IN_PROGRESS },
      });
      expect(service.updateStatus).toHaveBeenCalledWith(
        assignmentId,
        AssignmentStatus.IN_PROGRESS,
        clientId,
        UserRole.CLIENT,
        meta,
      );
    });

    it('propagates ForbiddenException when therapist tries to update status', async () => {
      service.updateStatus.mockRejectedValue(new ForbiddenException());
      const req = makeReq(UserRole.THERAPIST, therapistId);
      await expect(
        controller.updateStatus(
          assignmentId,
          { status: AssignmentStatus.IN_PROGRESS },
          req as never,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DELETE /worksheet-assignments/:id', () => {
    it('calls service.deleteAssignment and returns {success: true}', async () => {
      const req = makeReq(UserRole.THERAPIST, therapistId);
      const result = await controller.remove(assignmentId, req as never);
      expect(result).toEqual({ success: true, data: null });
      expect(service.deleteAssignment).toHaveBeenCalledWith(
        assignmentId,
        therapistId,
        UserRole.THERAPIST,
        meta,
      );
    });

    it('propagates ForbiddenException from service', async () => {
      service.deleteAssignment.mockRejectedValue(new ForbiddenException());
      const req = makeReq(UserRole.CLIENT, clientId);
      await expect(controller.remove(assignmentId, req as never)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('propagates NotFoundException from service', async () => {
      service.deleteAssignment.mockRejectedValue(new NotFoundException());
      const req = makeReq(UserRole.THERAPIST, therapistId);
      await expect(controller.remove('nonexistent', req as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('edge cases', () => {
    it('list with no pagination params defaults to page 1 limit 20', async () => {
      const req = makeReq(UserRole.THERAPIST, therapistId);
      await controller.list({}, req as never, {});
      expect(service.listAssignments).toHaveBeenCalledWith(
        expect.anything(),
        therapistId,
        UserRole.THERAPIST,
        { page: 1, limit: 20 },
      );
    });

    it('list with status filter passes it through to service', async () => {
      const req = makeReq(UserRole.CLIENT, clientId);
      await controller.list({ status: AssignmentStatus.PENDING }, req as never, {
        page: 1,
        limit: 20,
      });
      expect(service.listAssignments).toHaveBeenCalledWith(
        { status: AssignmentStatus.PENDING },
        clientId,
        UserRole.CLIENT,
        { page: 1, limit: 20 },
      );
    });

    it('extractMeta uses unknown fallback when ip and user-agent are absent', async () => {
      const reqNoIp = {
        user: { sub: therapistId, role: UserRole.THERAPIST },
        ip: undefined,
        get: () => undefined,
      };
      await controller.create({ templateId, clientId } as never, reqNoIp as never);
      expect(service.createAssignment).toHaveBeenCalledWith(
        expect.anything(),
        therapistId,
        UserRole.THERAPIST,
        { ipAddress: 'unknown', userAgent: 'unknown' },
      );
    });
  });
});
