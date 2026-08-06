import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL não configurada.");
  return p.query<T>(text, params);
}

export async function ensureTables(): Promise<void> {
  const p = getPool();
  if (!p) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id SERIAL PRIMARY KEY,
      owner_user_id INT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Meu workspace',
      nicho TEXT DEFAULT '',
      produto TEXT DEFAULT '',
      oferta TEXT DEFAULT '',
      cta TEXT DEFAULT '',
      tom_voz TEXT DEFAULT '',
      concorrentes JSONB DEFAULT '[]'::jsonb,
      ig_user_id TEXT DEFAULT '',
      ig_username TEXT DEFAULT '',
      ig_access_token TEXT DEFAULT '',
      brand_kit JSONB DEFAULT '{}'::jsonb,
      onboarding_done BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS research_runs (
      id SERIAL PRIMARY KEY,
      workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      raw_data JSONB DEFAULT '{}'::jsonb,
      report JSONB DEFAULT '{}'::jsonb,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id SERIAL PRIMARY KEY,
      workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
      research_id INT REFERENCES research_runs(id) ON DELETE SET NULL,
      days INT NOT NULL DEFAULT 7,
      plan JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS creatives (
      id SERIAL PRIMARY KEY,
      workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
      strategy_id INT REFERENCES strategies(id) ON DELETE SET NULL,
      day_index INT NOT NULL DEFAULT 1,
      format TEXT NOT NULL DEFAULT 'feed',
      hook TEXT DEFAULT '',
      caption TEXT DEFAULT '',
      visual_prompt TEXT DEFAULT '',
      media_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      ig_media_id TEXT,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_creatives_scheduled
      ON creatives (status, scheduled_at)
      WHERE status = 'scheduled';
  `);
}
