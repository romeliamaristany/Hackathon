import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  ArcjetGuard,
  ArcjetModule as ArcjetSdkModule,
  shield,
  slidingWindow,
} from '@arcjet/nest';

/**
 * Infrastructure module for Arcjet. Registers the SDK client globally and
 * applies Shield + rate limiting to every route via a global guard.
 * Per-route rules can be added with @WithArcjetRules(...).
 */
@Global()
@Module({
  imports: [
    ArcjetSdkModule.forRootAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode =
          config.get<string>('ARCJET_MODE') === 'LIVE' ? 'LIVE' : 'DRY_RUN';
        return {
          key: config.getOrThrow<string>('ARCJET_KEY'),
          characteristics: ['ip.src'],
          rules: [
            shield({ mode }),
            slidingWindow({
              mode,
              interval: 60, // seconds
              max: 60, // requests per interval per IP
            }),
          ],
        };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ArcjetGuard }],
})
export class ArcjetModule {}
