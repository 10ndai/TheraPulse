import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { WorksheetSubmissionsController } from '../../../src/modules/worksheets/worksheet-submissions.controller';
import { WorksheetSubmissionsService } from '../../../src/modules/worksheets/worksheet-submissions.service';

const clientId = 'client-uuid-001';
const assignmentId = 'assign-uuid-001';
const submissionId = 'sub-uuid-001';

const mockUser = { sub: clientId, role: UserRole.CLIENT };
const mockSubmission = {
  id: submissionId,
  assignmentId,
  clientId,
  responses: JSON.stringify({ f1: 'answer1' }),
  score: null,
  finalizedAt: null,
  integrityHash: 'hash-abc',
  createdAt: new Date(),
};

const makeService = () => ({
  submit: vi.fn().mockResolvedValue(mockSubmission),
  getSubmission: vi.fn().mockResolvedValue(mockSubmission),
  listSubmissions: vi.fn().mockResolvedValue({
    data: [mockSubmission],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  }),
  verifyIntegrity: vi.fn().mockResolvedValue({ valid: true }),
});

function makeReq(
  overrides: Partial<{ ip: string; headers: Record<string, string> }> = {},
): Partial<Request> & { user: typeof mockUser } {
  return {
    user: mockUser,
    ip: overrides.ip ?? '127.0.0.1',
    get: vi.fn((header: string) => overrides.headers?.[header.toLowerCase()] ?? 'test-agent'),
  };
}

describe('WorksheetSubmissionsController', () => {
  let controller: WorksheetSubmissionsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module = await Test.createTestingModule({
      controllers: [WorksheetSubmissionsController],
      providers: [{ provide: WorksheetSubmissionsService, useValue: service }],
    }).compile();

    controller = module.get(WorksheetSubmissionsController);
  });

  // ── POST /worksheet-submissions ────────────────────────────────────────────

  describe('POST /worksheet-submissions', () => {
    const dto = { assignmentId, responses: { f1: 'answer1' }, status: 'DRAFT' as const };

    it('calls service.submit and returns success envelope', async () => {
      const result = await controller.submit(
        dto,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.submit).toHaveBeenCalledWith(
        dto,
        clientId,
        UserRole.CLIENT,
        expect.any(Object),
      );
      expect(result).toEqual({ success: true, data: mockSubmission });
    });

    it('passes extracted ip and user-agent to service', async () => {
      const req = makeReq({ ip: '10.0.0.1', headers: { 'user-agent': 'my-browser/1.0' } });
      await controller.submit(dto, req as unknown as Request & { user: typeof mockUser });
      expect(service.submit).toHaveBeenCalledWith(dto, clientId, UserRole.CLIENT, {
        ip: '10.0.0.1',
        userAgent: 'my-browser/1.0',
      });
    });

    it('falls back to "unknown" when ip or user-agent are missing', async () => {
      const req = {
        user: mockUser,
        ip: undefined,
        get: vi.fn(() => undefined),
      } as unknown as Request & { user: typeof mockUser };
      await controller.submit(dto, req);
      expect(service.submit).toHaveBeenCalledWith(dto, clientId, UserRole.CLIENT, {
        ip: 'unknown',
        userAgent: 'unknown',
      });
    });
  });

  // ── GET /worksheet-submissions ─────────────────────────────────────────────

  describe('GET /worksheet-submissions', () => {
    it('returns paginated list in success envelope', async () => {
      const result = await controller.list(
        { page: 1, limit: 20 },
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.listSubmissions).toHaveBeenCalledWith(
        expect.any(Object),
        clientId,
        UserRole.CLIENT,
        expect.objectContaining({ page: 1, limit: 20 }),
      );
      expect(result).toEqual({
        success: true,
        data: [mockSubmission],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    /** Express hands over strings; passing them through 500s inside Prisma. */
    it('coerces string page/limit into numbers', async () => {
      await controller.list(
        { page: '2', limit: '50' },
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.listSubmissions).toHaveBeenCalledWith(
        expect.any(Object),
        clientId,
        UserRole.CLIENT,
        { page: 2, limit: 50 },
      );
    });

    it('rejects an over-max limit with 400 instead of querying unbounded', async () => {
      await expect(
        controller.list(
          { limit: '5000' },
          makeReq() as unknown as Request & { user: typeof mockUser },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(service.listSubmissions).not.toHaveBeenCalled();
    });

    it('defaults page and limit when not provided', async () => {
      await controller.list({}, makeReq() as unknown as Request & { user: typeof mockUser });
      expect(service.listSubmissions).toHaveBeenCalledWith(
        expect.any(Object),
        clientId,
        UserRole.CLIENT,
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });

  // ── GET /worksheet-submissions/:id ─────────────────────────────────────────

  describe('GET /worksheet-submissions/:id', () => {
    it('returns single submission in success envelope', async () => {
      const result = await controller.findOne(
        submissionId,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.getSubmission).toHaveBeenCalledWith(submissionId, clientId, UserRole.CLIENT);
      expect(result).toEqual({ success: true, data: mockSubmission });
    });
  });

  // ── GET /worksheet-submissions/:id/verify ─────────────────────────────────

  describe('GET /worksheet-submissions/:id/verify', () => {
    it('returns integrity check result in success envelope', async () => {
      const result = await controller.verify(
        submissionId,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.verifyIntegrity).toHaveBeenCalledWith(submissionId, clientId, UserRole.CLIENT);
      expect(result).toEqual({ success: true, data: { valid: true } });
    });

    it('returns { valid: false } when integrity check fails', async () => {
      service.verifyIntegrity.mockResolvedValueOnce({ valid: false });
      const result = await controller.verify(
        submissionId,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(result).toEqual({ success: true, data: { valid: false } });
    });
  });
});
