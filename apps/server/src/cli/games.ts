/**
 * Switches a Game off or on without a deploy (table `disabled_games`); the running server sees
 * it within `DISABLED_GAMES_CACHE_MS`.
 *
 *   npm run games -w @xomdao/server -- list
 *   npm run games -w @xomdao/server -- disable <id>
 *   npm run games -w @xomdao/server -- enable <id>
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema.js';
import { PgDisabledGamesStore } from '../game-host/disabled-games.store.js';

try {
  process.loadEnvFile();
} catch {}

const [command, gameId] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set: there is no disabled_games table to change');
  process.exit(1);
}
if (!['list', 'disable', 'enable'].includes(command ?? '') || (command !== 'list' && !gameId)) {
  console.error('Usage: npm run games -w @xomdao/server -- list | disable <id> | enable <id>');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const store = new PgDisabledGamesStore(drizzle({ client: pool, schema }));
try {
  if (command === 'disable') await store.disable(gameId!);
  if (command === 'enable') await store.enable(gameId!);
  const disabled = await store.list();
  console.log(disabled.length ? `Disabled: ${disabled.join(', ')}` : 'No Game is disabled');
} finally {
  await pool.end();
}
