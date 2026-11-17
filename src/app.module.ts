import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArcjetModule } from './lib/arcjet/arcjet.module';
import { AuthModule } from './lib/auth/auth.module';
import { PrismaModule } from './lib/database/prisma.module';
import { UserModule } from './module/user/user.module';
import { AdminModule } from './module/admin/admin.module';
import { HackathonModule } from './module/hackathon/hackathon.module';

import 'dotenv/config';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ArcjetModule,
    PrismaModule,
    AuthModule,
    UserModule,
    AdminModule,
    HackathonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
