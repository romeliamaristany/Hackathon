import { Global, Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth';
import { AuthDatabaseLifecycle } from './auth-database.lifecycle';

/**
 * Infrastructure module for Better Auth. Registers a global AuthGuard:
 * every route is protected unless it uses @AllowAnonymous().
 * Import once in AppModule.
 */
@Global()
@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth,
      // El módulo ya es global por el @Global() de arriba.
    }),
  ],
  providers: [AuthDatabaseLifecycle],
})
export class AuthModule {}
