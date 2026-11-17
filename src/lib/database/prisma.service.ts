import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { db } from '../../prisma/db';

/**
 * Infrastructure service wrapping the Prisma ORM client.
 * Inject this wherever database access is needed.
 */
@Injectable()
export class PrismaService implements OnApplicationShutdown {
  readonly client = db;

  /** Typed ORM entry point, e.g. `prisma.orm.public.User.where(...)`. */
  get orm() {
    return this.client.orm;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
