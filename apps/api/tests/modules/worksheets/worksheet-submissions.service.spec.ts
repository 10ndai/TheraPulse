import { createHmac } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { WorksheetSubmissionsService } from '../../../src/modules/worksheets/worksheet-submissions.service';
import { WORKSHEET_SUBMISSION_REPOSITORY } from '../../../src/modules/worksheets/worksheet-submissions.repository.interface';
import { WORKSHEET_ASSIGNMENT_REPOSITORY } from '../../../src/modules/worksheets/worksheet-assignments.repository.interface';
import { WORKSHEET_TEMPLATE_REPOSITORY } from '../../../src/modules/worksheets/worksheet-templates.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';
import { EncryptionService } from '../../../src/modules/encryption/encryption.service';
import { ScoringService } from '../../../src/modules/worksheets/scoring.service';

const clientId = 'client-uuid-001';
const therapistId = 'therapist-uuid-001';
const assignmentId = 'assign-uuid-001';
const submissionId = 'sub-uuid-001';

const HMAC_KEY = 'test-hmac-key-for-unit-tests';
const responsesJson = JSON.stringify({ f1: 'answer1' });
const validIntegrityHash = createHmac('sha512', HMAC_KEY)
  .update(`${submissionId}${assignmentId}${clientId}${responsesJson}`)
  .digest('hex');

const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };

const mockAssignment = {
  id: assignmentId,
  clientId,
  therapistId,
  templateId: 'tpl-001',
  status: 'PENDING',
  instructions: null,
  dueDate: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

const finalizedSubmission = {
  ...mockSubmission,
  finalizedAt: new Date(),
};

const makeSubRepo = () => ({
  findAll: vi.fn().mockResolvedValue({
    data: [mockSubmission],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  }),
  findById: vi.fn().mockResolvedValue(mockSubmission),
  create: vi.fn().mockResolvedValue(mockSubmission),
  update: vi.fn().mockResolvedValue(mockSubmission),
  softDelete: vi.fn().mockResolvedValue(undefined),
  findDraftByAssignment: vi.fn().mockResolvedValue(null),
});

const makeAssignRepo = () => ({
  findAll: vi.fn(),
  findById: vi.fn().mockResolvedValue(mockAssignment),
  create: vi.fn(),
  update: vi.fn().mockResolvedValue({ ...mockAssignment, status: 'COMPLETED' }),
  softDelete: vi.fn(),
  findByFilters: vi.fn(),
});

const makeAuditService = () => ({
  log: vi.fn().mockResolvedValue(undefined),
});

const makeEncryptionService = () => ({
  encrypt: vi.fn((s: string) => `v1.${Buffer.from(s).toString('base64')}`),
  decrypt: vi.fn((s: string) => Buffer.from(s.slice(3), 'base64').toString('utf8')),
});

const makeConfigService = () => ({
  get: vi.fn(() => 'test-hmac-key-for-unit-tests'),
  getOrThrow: vi.fn(() => 'test-hmac-key-for-unit-tests'),
});

const makeTemplateRepo = () => ({
  findAll: vi.fn(),
  findById: vi.fn().mockResolvedValue({
    id: 'tpl-001',
    scoringConfig: null,
    formSchema: { version: 1, fields: [] },
  }),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  findByFilters: vi.fn(),
});

const makeScoringService = () => ({
  score: vi.fn().mockReturnValue(null),
});

describe('WorksheetSubmissionsService', () => {
  let service: WorksheetSubmissionsService;
  let subRepo: ReturnType<typeof makeSubRepo>;
  let assignRepo: ReturnType<typeof makeAssignRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let encryptionService: ReturnType<typeof makeEncryptionService>;
  let templateRepo: ReturnType<typeof makeTemplateRepo>;
  let scoringService: ReturnType<typeof makeScoringService>;

  beforeEach(async () => {
    subRepo = makeSubRepo();
    assignRepo = makeAssignRepo();
    auditService = makeAuditService();
    encryptionService = makeEncryptionService();
    templateRepo = makeTemplateRepo();
    scoringService = makeScoringService();
    const configService = makeConfigService();

    const module = await Test.createTestingModule({
      providers: [
        WorksheetSubmissionsService,
        { provide: WORKSHEET_SUBMISSION_REPOSITORY, useValue: subRepo },
        { provide: WORKSHEET_ASSIGNMENT_REPOSITORY, useValue: assignRepo },
        { provide: WORKSHEET_TEMPLATE_REPOSITORY, useValue: templateRepo },
        { provide: AuditLogService, useValue: auditService },
        { provide: EncryptionService, useValue: encryptionService },
        { provide: ScoringService, useValue: scoringService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(WorksheetSubmissionsService);
  });

  // ── submit (DRAFT) ─────────────────────────────────────────────────────────

  describe('submit — DRAFT', () => {
    const dto = { assignmentId, responses: { f1: 'answer1' }, status: 'DRAFT' as const };

    it('creates a draft submission when none exists', async () => {
      const result = await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(subRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockSubmission);
    });

    it('updates existing draft when one already exists for the assignment', async () => {
      subRepo.findDraftByAssignment.mockResolvedValueOnce(mockSubmission);
      await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(subRepo.update).toHaveBeenCalledWith(submissionId, expect.any(Object));
      expect(subRepo.create).not.toHaveBeenCalled();
    });

    it('encrypts the responses before storing', async () => {
      await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(encryptionService.encrypt).toHaveBeenCalled();
    });

    it('computes an integrity hash', async () => {
      await service.submit(dto, clientId, UserRole.CLIENT, meta);
      const createCall = subRepo.create.mock.calls[0][0] as Record<string, unknown>;
      expect(createCall).toHaveProperty('integrityHash');
      expect(typeof createCall['integrityHash']).toBe('string');
      expect((createCall['integrityHash'] as string).length).toBeGreaterThan(0);
    });

    it('throws ForbiddenException when THERAPIST tries to submit', async () => {
      await expect(service.submit(dto, therapistId, UserRole.THERAPIST, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when the assignment does not belong to this client', async () => {
      assignRepo.findById.mockResolvedValueOnce({ ...mockAssignment, clientId: 'other-client' });
      await expect(service.submit(dto, clientId, UserRole.CLIENT, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when assignment does not exist', async () => {
      assignRepo.findById.mockResolvedValueOnce(null);
      await expect(service.submit(dto, clientId, UserRole.CLIENT, meta)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when existing draft is already finalized', async () => {
      subRepo.findDraftByAssignment.mockResolvedValueOnce(finalizedSubmission);
      await expect(service.submit(dto, clientId, UserRole.CLIENT, meta)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates an audit log entry on draft save', async () => {
      await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_submission.draft', actorId: clientId }),
      );
    });
  });

  // ── submit (SUBMITTED) ─────────────────────────────────────────────────────

  describe('submit — SUBMITTED', () => {
    const dto = { assignmentId, responses: { f1: 'answer1' }, status: 'SUBMITTED' as const };

    it('creates a finalized submission when no draft exists', async () => {
      const finalSub = { ...mockSubmission, finalizedAt: new Date() };
      subRepo.create.mockResolvedValueOnce(finalSub);
      const result = await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(result.finalizedAt).not.toBeNull();
    });

    it('finalizes an existing draft on submit', async () => {
      subRepo.findDraftByAssignment.mockResolvedValueOnce(mockSubmission);
      const finalSub = { ...mockSubmission, finalizedAt: new Date() };
      subRepo.update.mockResolvedValueOnce(finalSub);
      const result = await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(subRepo.update).toHaveBeenCalledWith(
        submissionId,
        expect.objectContaining({ finalizedAt: expect.any(Date) }),
      );
      expect(result.finalizedAt).not.toBeNull();
    });

    it('updates assignment status to COMPLETED on finalize', async () => {
      await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(assignRepo.update).toHaveBeenCalledWith(
        assignmentId,
        expect.objectContaining({ status: 'COMPLETED' }),
      );
    });

    it('creates an audit log entry on finalize', async () => {
      await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'worksheet_submission.finalized' }),
      );
    });

    it('throws BadRequestException when trying to re-submit a finalized submission', async () => {
      subRepo.findDraftByAssignment.mockResolvedValueOnce(finalizedSubmission);
      await expect(service.submit(dto, clientId, UserRole.CLIENT, meta)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('calls scoring service and stores score when template has scoringConfig', async () => {
      const mockScore = { totalScore: 15, severity: 'moderate' };
      scoringService.score.mockReturnValueOnce(mockScore);
      templateRepo.findById.mockResolvedValueOnce({
        id: 'tpl-001',
        scoringConfig: { maxScore: 27, ranges: [] },
        formSchema: { version: 1, fields: [] },
      });
      const finalSub = { ...mockSubmission, finalizedAt: new Date(), score: mockScore };
      subRepo.create.mockResolvedValueOnce(finalSub);
      const result = await service.submit(dto, clientId, UserRole.CLIENT, meta);
      expect(scoringService.score).toHaveBeenCalled();
      expect(result.score).toEqual(mockScore);
    });
  });

  // ── getSubmission ──────────────────────────────────────────────────────────

  describe('getSubmission', () => {
    it('returns submission to the owning client', async () => {
      const result = await service.getSubmission(submissionId, clientId, UserRole.CLIENT);
      expect(result).toEqual(mockSubmission);
    });

    it('returns submission to the therapist of the assignment', async () => {
      const result = await service.getSubmission(submissionId, therapistId, UserRole.THERAPIST);
      expect(result).toEqual(mockSubmission);
    });

    it('returns submission to ADMIN regardless of assignment', async () => {
      const result = await service.getSubmission(submissionId, 'admin-id', UserRole.ADMIN);
      expect(result).toEqual(mockSubmission);
    });

    it('throws NotFoundException when submission not found', async () => {
      subRepo.findById.mockResolvedValueOnce(null);
      await expect(service.getSubmission('nonexistent', clientId, UserRole.CLIENT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when CLIENT tries to access another client submission', async () => {
      const sub = { ...mockSubmission, clientId: 'other-client' };
      subRepo.findById.mockResolvedValueOnce(sub);
      await expect(service.getSubmission(submissionId, clientId, UserRole.CLIENT)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when THERAPIST accesses submission not from their client', async () => {
      assignRepo.findById.mockResolvedValueOnce({
        ...mockAssignment,
        therapistId: 'other-therapist',
      });
      await expect(
        service.getSubmission(submissionId, therapistId, UserRole.THERAPIST),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── listSubmissions ────────────────────────────────────────────────────────

  describe('listSubmissions', () => {
    it('returns paginated list for CLIENT', async () => {
      const result = await service.listSubmissions({}, clientId, UserRole.CLIENT, {
        page: 1,
        limit: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(subRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ clientId }),
        expect.any(Object),
      );
    });

    it('returns paginated list for ADMIN without filter', async () => {
      await service.listSubmissions({}, 'admin-id', UserRole.ADMIN, { page: 1, limit: 20 });
      expect(subRepo.findAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ clientId }),
        expect.any(Object),
      );
    });
  });

  // ── verifyIntegrity ────────────────────────────────────────────────────────

  describe('verifyIntegrity', () => {
    const submissionWithValidHash = {
      ...mockSubmission,
      responses: responsesJson,
      integrityHash: validIntegrityHash,
    };

    it('returns { valid: true } when HMAC matches stored hash', async () => {
      subRepo.findById.mockResolvedValueOnce(submissionWithValidHash);
      const result = await service.verifyIntegrity(submissionId, clientId, UserRole.CLIENT);
      expect(result).toEqual({ valid: true });
    });

    it('returns { valid: false } when stored hash does not match', async () => {
      subRepo.findById.mockResolvedValueOnce({
        ...mockSubmission,
        responses: responsesJson,
        integrityHash: 'tampered-hash',
      });
      const result = await service.verifyIntegrity(submissionId, clientId, UserRole.CLIENT);
      expect(result).toEqual({ valid: false });
    });

    it('throws NotFoundException when submission does not exist', async () => {
      subRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.verifyIntegrity('nonexistent', clientId, UserRole.CLIENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when CLIENT accesses another client submission', async () => {
      subRepo.findById.mockResolvedValueOnce({
        ...submissionWithValidHash,
        clientId: 'other-client',
      });
      await expect(
        service.verifyIntegrity(submissionId, clientId, UserRole.CLIENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to verify any submission', async () => {
      subRepo.findById.mockResolvedValueOnce(submissionWithValidHash);
      const result = await service.verifyIntegrity(submissionId, 'admin-id', UserRole.ADMIN);
      expect(result).toEqual({ valid: true });
    });
  });
});
