import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { scrubPhi } from '../utils/phi-scrubber';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const code =
      exception instanceof HttpException
        ? exception.constructor.name.replace('Exception', '').toUpperCase()
        : 'INTERNAL_SERVER_ERROR';

    const message =
      exception instanceof HttpException
        ? ((exception.getResponse() as Record<string, unknown>)['message'] ?? exception.message)
        : 'An unexpected error occurred';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        scrubPhi(`${request.method} ${request.url} → ${status}`),
        exception instanceof Error ? scrubPhi(exception.stack ?? '') : scrubPhi(String(exception)),
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
      },
    });
  }
}
