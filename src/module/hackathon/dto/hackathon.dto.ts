import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinDate,
  MinLength,
} from 'class-validator';

export class HackathonDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description?: string;

  // MinDate recibe una función para evaluar "ahora" en cada validación,
  // no una sola vez al arrancar la app.
  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date(), { message: 'startAt must be a future date' })
  startAt: Date;

  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date(), { message: 'endAt must be a future date' })
  endAt: Date;

  @IsBoolean()
  isActive: boolean;
}
