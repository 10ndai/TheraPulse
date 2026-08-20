import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('handles HttpException with correct status and envelope', () => {
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ method: 'GET', url: '/health' }),
      }),
    };

    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 500 for non-HttpException errors', () => {
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ method: 'POST', url: '/api/data' }),
      }),
    };

    filter.catch(new Error('Unexpected DB error'), host as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('uses INTERNAL_SERVER_ERROR code for unknown errors', () => {
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ method: 'GET', url: '/api/test' }),
      }),
    };

    filter.catch('string error', host as never);

    expect(res.status).toHaveBeenCalledWith(500);
    const call = json.mock.calls[0]?.[0] as { success: boolean; error: { code: string } };
    expect(call?.error?.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('extracts message from HttpException response object', () => {
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ method: 'POST', url: '/api/auth' }),
      }),
    };

    const exception = new HttpException(
      { message: 'Custom validation error', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, host as never);

    expect(res.status).toHaveBeenCalledWith(400);
    const call = json.mock.calls[0]?.[0] as { error: { message: string } };
    expect(call?.error?.message).toBe('Custom validation error');
  });
});
