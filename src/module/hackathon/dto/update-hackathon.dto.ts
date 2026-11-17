import { PartialType } from '@nestjs/mapped-types';
import { HackathonDto } from './hackathon.dto';

export class UpdateHackathonDto extends PartialType(HackathonDto) {}
