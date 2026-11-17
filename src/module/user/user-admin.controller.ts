import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { ROLE } from '../../lib/auth/auth';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { UserService } from './user.service';

/** Gestión de usuarios: solo ADMIN (Better Auth valida sesión + rol). */
@Controller('user')
@Roles([ROLE.ADMIN])
export class UserAdminController {
  constructor(private readonly userService: UserService) {}

  /** GET /user/all — declarado antes de `:id` para que no lo capture. */
  @Get('all')
  @ResponseMessage('Users retrieved successfully')
  findAll() {
    return this.userService.findAll();
  }

  /** GET /user/:id — 404 si no existe. */
  @Get(':id')
  @ResponseMessage('User retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }
}
