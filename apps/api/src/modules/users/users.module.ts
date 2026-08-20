import { Module } from '@nestjs/common';
import { UserRepository } from './users.repository';
import { USER_REPOSITORY } from './users.repository.interface';

@Module({
  providers: [
    { provide: USER_REPOSITORY, useClass: UserRepository },
    // Also provide directly so tests can get it by class
    UserRepository,
  ],
  exports: [USER_REPOSITORY, UserRepository],
})
export class UsersModule {}
