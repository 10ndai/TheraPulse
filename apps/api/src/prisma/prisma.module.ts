import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { EncryptionModule } from '../modules/encryption/encryption.module';
import { RlsContextService } from '../common/interceptors/rls-context.service';

/**
 * @Global() so PrismaService is available everywhere without re-importing.
 * Import PrismaModule once in AppModule.
 * Imports EncryptionModule so PrismaService can receive EncryptionService via DI.
 * Provides and exports RlsContextService so RlsInterceptor (registered in AppModule)
 * and PrismaService share the same AsyncLocalStorage instance.
 */
@Global()
@Module({
  imports: [EncryptionModule],
  providers: [PrismaService, RlsContextService],
  exports: [PrismaService, RlsContextService],
})
export class PrismaModule {}
