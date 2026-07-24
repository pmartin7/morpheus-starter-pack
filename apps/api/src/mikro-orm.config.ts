import './config/load-env.js';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

export default defineConfig({
  clientUrl: process.env['NEON_DATABASE_URL'],
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  extensions: [Migrator],
  migrations: {
    path: './migrations',
    pathTs: './migrations',
  },
  debug: process.env['NODE_ENV'] !== 'production',
});
