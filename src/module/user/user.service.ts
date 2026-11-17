import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service';

/**
 * Columnas públicas de la tabla `user` (gestionada por Better Auth, no por el
 * contrato de Prisma 8, por eso se consulta con el carril raw tipado).
 */
const USER_ROW = {
  id: 'pg/text@1',
  name: 'pg/text@1',
  email: 'pg/text@1',
  emailVerified: 'pg/bool@1',
  image: { codecId: 'pg/text@1', nullable: true },
  role: { codecId: 'pg/text@1', nullable: true },
  banned: { codecId: 'pg/bool@1', nullable: true },
  createdAt: 'pg/timestamptz-date@1',
  updatedAt: 'pg/timestamptz-date@1',
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const client = this.prisma.client;
    const plan = client.raw.sql`
      SELECT id, name, email, "emailVerified", image, role, banned,
             "createdAt", "updatedAt"
      FROM "user"
      ORDER BY "createdAt" DESC`
      .returnsRow(USER_ROW)
      .build();
    return await client.query(plan);
  }

  async findOne(id: string) {
    const client = this.prisma.client;
    const plan = client.raw.sql`
      SELECT id, name, email, "emailVerified", image, role, banned,
             "createdAt", "updatedAt"
      FROM "user"
      WHERE id = ${id}
      LIMIT 1`
      .returnsRow(USER_ROW)
      .build();
    const [user] = await client.query(plan);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return user;
  }
}
