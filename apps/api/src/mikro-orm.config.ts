import './config/load-env.js';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

const clientUrl = process.env['NEON_DATABASE_URL'];

export default defineConfig({
  clientUrl,
  // MikroORM drops query params from clientUrl, so sslmode=require must be
  // passed to the pg driver explicitly or Neon rejects the connection.
  driverOptions: clientUrl?.includes('sslmode=require') ? { connection: { ssl: true } } : undefined,
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  extensions: [Migrator],
  migrations: {
    path: './migrations',
    pathTs: './migrations',
  },
  debug: process.env['NODE_ENV'] !== 'production',
});
