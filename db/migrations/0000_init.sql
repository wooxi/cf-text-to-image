-- D1 Schema for txt2img (CF version)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keyword_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_parameter_group INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES keyword_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  is_secret INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS image_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_names TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'image',
  poster_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'pending',
  type TEXT NOT NULL DEFAULT 'image',
  keyword_names TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  reference_image TEXT NOT NULL DEFAULT '',
  video_path TEXT NOT NULL DEFAULT '',
  video_id TEXT NOT NULL DEFAULT '',
  poster_path TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0,
  size TEXT NOT NULL DEFAULT '1024x1024',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Add sort_order for keyword reordering
ALTER TABLE keywords ADD COLUMN sort_order INTEGER DEFAULT 0;
