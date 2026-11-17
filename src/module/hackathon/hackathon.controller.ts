import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  Roles,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ROLE } from '../../lib/auth/auth';
import { HackathonDto } from './dto/hackathon.dto';
import { UpdateHackathonDto } from './dto/update-hackathon.dto';
import { HackathonService } from './hackathon.service';

/**
 * El AuthGuard de Better Auth es global: toda ruta exige sesión, por lo que
 * cualquier rol autenticado puede leer. Escribir exige ADMIN vía @Roles.
 */
@Controller('hackathons')
export class HackathonController {
  constructor(private readonly hackathonService: HackathonService) {}

  @Post()
  @Roles([ROLE.ADMIN])
  @ResponseMessage('Hackathon created successfully')
  create(@Body() dto: HackathonDto, @Session() session: UserSession) {
    return this.hackathonService.create(dto, session.user.id);
  }

  @Get()
  @ResponseMessage('Hackathons retrieved successfully')
  findAll() {
    return this.hackathonService.findAll();
  }

  @Get(':id')
  @ResponseMessage('Hackathon retrieved successfully')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.hackathonService.findOne(id);
  }

  @Post(':id/join')
  @Roles([ROLE.PARTICIPANT])
  @ResponseMessage('Joined hackathon successfully')
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    return this.hackathonService.join(id, session.user.id);
  }

  @Patch(':id')
  @Roles([ROLE.ADMIN])
  @ResponseMessage('Hackathon updated successfully')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHackathonDto,
  ) {
    return this.hackathonService.update(id, dto);
  }

  @Delete(':id')
  @Roles([ROLE.ADMIN])
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Hackathon deleted successfully')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.hackathonService.remove(id);
  }
}
