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
      media_urls JSONB DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      ig_media_id TEXT,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS landings (
      id SERIAL PRIMARY KEY,
      workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
      html TEXT NOT NULL,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_creatives_scheduled
      ON creatives (status, scheduled_at)
      WHERE status = 'scheduled';

    ALTER TABLE creatives ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb;

    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'produto',
      name TEXT NOT NULL,
      nicho TEXT DEFAULT '',
      produto TEXT DEFAULT '',
      oferta TEXT DEFAULT '',
      cta TEXT DEFAULT '',
      tom_voz TEXT DEFAULT '',
      concorrentes JSONB DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft',
      ig_user_id TEXT DEFAULT '',
      ig_username TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS identity_versions (
      id SERIAL PRIMARY KEY,
      campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE,
      version INT NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'import',
      model JSONB DEFAULT '{}'::jsonb,
      css TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      confidence TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (campaign_id, version)
    );

    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE;
    ALTER TABLE strategies ADD COLUMN IF NOT EXISTS campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE;
    ALTER TABLE creatives ADD COLUMN IF NOT EXISTS campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE;
    ALTER TABLE landings ADD COLUMN IF NOT EXISTS campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns (workspace_id);
    CREATE INDEX IF NOT EXISTS idx_identity_campaign ON identity_versions (campaign_id, status);

    CREATE TABLE IF NOT EXISTS schema_patches (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await p.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM schema_patches WHERE name = 'drop_planner_campaigns') THEN
        DELETE FROM campaigns
        WHERE name ~* 'planer|planner'
           OR produto ~* 'planer|planner'
           OR nicho ~* 'planner mulher'
           OR oferta ~* 'planner';
        INSERT INTO schema_patches (name) VALUES ('drop_planner_campaigns');
      END IF;
    END $$;
  `);

  await p.query(`
    UPDATE research_runs r SET campaign_id = (
      SELECT c.id FROM campaigns c WHERE c.workspace_id = r.workspace_id ORDER BY c.id ASC LIMIT 1
    ) WHERE campaign_id IS NULL;
    UPDATE strategies s SET campaign_id = (
      SELECT c.id FROM campaigns c WHERE c.workspace_id = s.workspace_id ORDER BY c.id ASC LIMIT 1
    ) WHERE campaign_id IS NULL;
    UPDATE creatives x SET campaign_id = (
      SELECT c.id FROM campaigns c WHERE c.workspace_id = x.workspace_id ORDER BY c.id ASC LIMIT 1
    ) WHERE campaign_id IS NULL;
    UPDATE landings l SET campaign_id = (
      SELECT c.id FROM campaigns c WHERE c.workspace_id = l.workspace_id ORDER BY c.id ASC LIMIT 1
    ) WHERE campaign_id IS NULL;
  `);
}
