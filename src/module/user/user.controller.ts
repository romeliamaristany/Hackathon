import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@Controller('users')
export class UserController {
  /** Devuelve el usuario autenticado. Requiere sesión (guard global). */
  @Get('me')
  getProfile(@Session() session: UserSession) {
    return { user: session.user };
  }
}
