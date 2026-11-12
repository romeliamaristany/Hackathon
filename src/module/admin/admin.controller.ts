import { Controller, Get } from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { ROLE } from '../../lib/auth/auth';

@Controller('admin')
export class AdminController {
  /** Ruta de verificación: solo usuarios con rol ADMIN. */
  @Get('ping')
  @Roles([ROLE.ADMIN])
  ping() {
    return { ok: true };
  }
}
