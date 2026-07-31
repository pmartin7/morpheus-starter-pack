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

  // The Admin SDK reads FIREBASE_AUTH_EMULATOR_HOST by itself and then stops
  // verifying token signatures, so a production process that ever saw this
  // variable would accept forged tokens. Refuse to boot rather than trust it.
  const emulatorHost = process.env['FIREBASE_AUTH_EMULATOR_HOST'];
  if (emulatorHost && process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST is set while NODE_ENV=production — refusing to start',
    );
  }

  admin.initializeApp(
    emulatorHost
      ? // Service-account credentials are meaningless against the emulator, and
        // a placeholder PEM would throw while being parsed.
        { projectId: process.env['FIREBASE_PROJECT_ID'] }
      : {
          credential: admin.credential.cert({
            projectId: process.env['FIREBASE_PROJECT_ID'],
            // env stores often escape newlines in the PEM key
            privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
            clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
          }),
        },
  );

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Behind Vercel's proxy, req.ip must come from x-forwarded-for or the
  // IP-based throttle would lump all anonymous traffic under the proxy IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173' });
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env['PORT'] ?? 3000);
}

bootstrap();
