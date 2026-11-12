import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import 'dotenv/config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Requerido por Better Auth (la librería reactiva el parser para el resto)
  });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
