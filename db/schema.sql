CREATE TABLE IF NOT EXISTS media_sources (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  media_name TEXT NOT NULL,
  language TEXT,
  homepage_url TEXT,
  feed_url TEXT,
  section TEXT,
  parser_type TEXT NOT NULL DEFAULT 'rss',
  article_limit INTEGER NOT NULL DEFAULT 3,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  country TEXT NOT NULL,
  media_name TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  lang TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_country_published ON articles(country, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source_published ON articles(source_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_fetched ON articles(fetched_at DESC);
