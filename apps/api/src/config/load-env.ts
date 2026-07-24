import { config } from 'dotenv';
import { resolve } from 'path';

// Loads the single root .env for the whole monorepo. Works from both the
// source tree (src/config/) and the compiled output (dist/config/) because
// both sit four levels below the repo root.
config({ path: resolve(__dirname, '../../../../.env') });
