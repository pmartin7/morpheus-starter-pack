import './config/load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as admin from 'firebase-admin';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { validateEnv } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  validateEnv();

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env['FIREBASE_PROJECT_ID'],
      // env stores often escape newlines in the PEM key
      privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
      clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
    }),
  });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173' });
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env['PORT'] ?? 3000);
}

bootstrap();
