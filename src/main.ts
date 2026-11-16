import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

import 'dotenv/config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Requerido por Better Auth (la librería reactiva el parser para el resto)
  });
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
