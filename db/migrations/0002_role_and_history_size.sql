-- 角色体系 + 历史记录 size 列
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE image_history ADD COLUMN size TEXT NOT NULL DEFAULT '';

-- 将最早的账号提升为管理员（后续可用 SQL 手动调整）
UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users);
