import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  readonly status: 'ok';
  readonly timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
