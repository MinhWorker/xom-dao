import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { type Db, openDb } from '../db/db.module.js';

/** A Postgres server tests may create databases on; tests that need it skip without it. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** A fresh, migrated database on `TEST_DATABASE_URL`; `drop` removes it. */
export async function freshDb(): Promise<{ db: Db; drop: () => Promise<void> }> {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
  const name = `xomdao_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  const db = await openDb(url.toString());
  return {
    db,
    drop: async () => {
      await db.$client.end();
      const admin = new Client({ connectionString: TEST_DATABASE_URL });
      await admin.connect();
      await admin.query(`DROP DATABASE ${name}`);
      await admin.end();
    },
  };
}
