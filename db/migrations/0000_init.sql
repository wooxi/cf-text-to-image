-- 完整数据库结构。
--
-- 单实例私人服务，不需要增量迁移的层层叠加：这里就是全部结构。
-- （旧版本的 0001_task_request_json / 0002_role_and_history_size /
--   0003_single_user_auth 已合并进来：request_json 快照与各列完全重复、
--   users/config 表在单密码模式下不再需要、video_* 列随视频功能一并移除。）

CREATE TABLE IF NOT EXISTS keyword_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_parameter_group INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES keyword_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 任务参数就是这些列，没有第二份 JSON 快照需要同步。
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'pending',
  type TEXT NOT NULL DEFAULT 'image',
  prompt TEXT NOT NULL DEFAULT '',
  keyword_names TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '1024x1024',
  reference_image TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS image_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL DEFAULT '',
  keyword_names TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_history_id ON image_history(id DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_group ON keywords(group_id, sort_order);
