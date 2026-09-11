-- 通用键值设置表。
--
-- 存在的理由：Cloudflare Worker 的单个文本绑定上限 5.1 KB，而一份认真写过的
-- 系统提示词轻易就超过它。这类「内容型」配置放不进环境变量，也不该写死进
-- 代码——每个部署者都不一样。机密（API Key、访问密码）仍然只走环境变量。
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
