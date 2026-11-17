import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service';
import { HackathonDto } from './dto/hackathon.dto';
import { UpdateHackathonDto } from './dto/update-hackathon.dto';

@Injectable()
export class HackathonService {
  constructor(private readonly prisma: PrismaService) {}

  /** `authorId` es el id del usuario con sesión, nunca viene del body. */
  async create(dto: HackathonDto, authorId: string) {
    return await this.prisma.orm.public.Hackathon.create({
      name: dto.name,
      description: dto.description ?? null,
      startDate: dto.startAt,
      endDate: dto.endAt,
      isActive: dto.isActive,
      authorId,
    });
  }

  async findAll() {
    return await this.prisma.orm.public.Hackathon.orderBy((h) =>
      h.startDate.desc(),
    ).all();
  }

  async findOne(id: string) {
    const hackathon = await this.prisma.orm.public.Hackathon.where({
      id,
    }).first();
    if (!hackathon) {
      throw new NotFoundException(`Hackathon with id "${id}" not found`);
    }
    return hackathon;
  }

  async update(id: string, dto: UpdateHackathonDto) {
    await this.findOne(id);

    // Solo se envían los campos presentes; los undefined se omiten.
    const data = Object.fromEntries(
      Object.entries({
        name: dto.name,
        description: dto.description,
        startDate: dto.startAt,
        endDate: dto.endAt,
        isActive: dto.isActive,
      }).filter(([, value]) => value !== undefined),
    );

    return await this.prisma.orm.public.Hackathon.where({ id }).update(data);
  }

  /** Une al usuario al hackathon si existe, está activo y no se unió antes. */
  async join(hackathonId: string, userId: string) {
    const hackathon = await this.findOne(hackathonId);
    if (!hackathon.isActive) {
      throw new BadRequestException('Hackathon is not active');
    }
    if (hackathon.endDate.getTime() < Date.now()) {
      throw new BadRequestException('Hackathon has already ended');
    }

    const existing = await this.prisma.orm.public.HackathonParticipant.where({
      hackathonId,
      userId,
    }).first();
    if (existing) {
      throw new ConflictException('You have already joined this hackathon');
    }

    return await this.prisma.orm.public.HackathonParticipant.create({
      hackathonId,
      userId,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.orm.public.Hackathon.where({ id }).delete();
  }
}
