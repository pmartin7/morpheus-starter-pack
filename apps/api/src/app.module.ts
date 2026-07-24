import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import mikroOrmConfig from './mikro-orm.config.js';
import { ApiThrottlerGuard } from './common/guards/api-throttler.guard.js';
import { UsersModule } from './users/users.module.js';
import { ChatModule } from './chat/chat.module.js';
import { AiModule } from './ai/ai.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info',
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: ['req.headers.authorization'],
      },
    }),
    UsersModule,
    ChatModule,
    AiModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ApiThrottlerGuard }],
})
export class AppModule {}
