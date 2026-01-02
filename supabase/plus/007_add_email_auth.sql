-- 邮箱认证功能数据库迁移
-- Requirements: 1.1, 3.1, 4.1

-- ============================================
-- 1. 扩展 users 表添加邮箱认证相关字段
-- ============================================

-- 添加邮箱字段（唯一，可为空以保持向后兼容）
ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar(255) UNIQUE;

-- 添加邮箱验证状态
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- 添加登录尝试计数（用于账户锁定）
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts integer DEFAULT 0;

-- 添加账户锁定时间
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz DEFAULT NULL;

-- 创建邮箱索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 2. 创建邮箱验证表
-- ============================================

CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  code varchar(6) NOT NULL,
  type varchar(20) NOT NULL CHECK (type IN ('registration', 'password_reset', 'email_change')),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_type ON email_verifications(type);

-- ============================================
-- 3. RLS 策略
-- ============================================

-- 启用 RLS
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- email_verifications 表策略 - 允许所有操作（验证码验证需要）
CREATE POLICY "email_verifications_all" ON email_verifications 
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 4. 清理过期验证码的函数（可选，用于定期清理）
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verifications 
  WHERE expires_at < now() OR used = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. 注释说明
-- ============================================

COMMENT ON COLUMN users.email IS '用户邮箱地址，用于登录和找回密码';
COMMENT ON COLUMN users.email_verified IS '邮箱是否已验证';
COMMENT ON COLUMN users.login_attempts IS '连续登录失败次数，用于账户锁定';
COMMENT ON COLUMN users.locked_until IS '账户锁定截止时间';

COMMENT ON TABLE email_verifications IS '邮箱验证码记录表';
COMMENT ON COLUMN email_verifications.email IS '目标邮箱地址';
COMMENT ON COLUMN email_verifications.code IS '6位数字验证码';
COMMENT ON COLUMN email_verifications.type IS '验证类型：registration/password_reset/email_change';
COMMENT ON COLUMN email_verifications.expires_at IS '验证码过期时间（10分钟）';
COMMENT ON COLUMN email_verifications.used IS '验证码是否已使用';
