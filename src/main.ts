import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

import 'dotenv/config';

export interface ValidationIssue {
  property: string;
  message: string;
}

/**
 * Aplana los ValidationError (incluidos los anidados) a una lista de
 * { property, message }, con una entrada por cada restricción incumplida.
 */
function flattenErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationIssue[] {
  return errors.flatMap((error) => {
    const property = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    const own = Object.values(error.constraints ?? {}).map((message) => ({
      property,
      message,
    }));
    const nested = flattenErrors(error.children ?? [], property);

    return [...own, ...nested];
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Requerido por Better Auth (la librería reactiva el parser para el resto)
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(flattenErrors(errors)),
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
