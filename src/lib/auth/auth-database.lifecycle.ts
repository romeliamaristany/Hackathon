import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { authPool } from './auth';

/** Cierra el pool de `pg` de Better Auth cuando la app se apaga. */
@Injectable()
export class AuthDatabaseLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await authPool.end();
  }
}
