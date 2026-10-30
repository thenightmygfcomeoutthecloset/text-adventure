-- ═══════════════════════════════════════════════════════════════
-- 【关键部署说明：注册后直接登录】
-- 本项目将中国大陆手机号转换为「手机号@phone.user」模拟邮箱，使用 Supabase Email/Password 注册。
-- 必须在 Supabase Dashboard → Authentication → Providers → Email 中关闭「Confirm email」。
-- 否则注册成功仅返回 user、不会返回 session，无法立即登录及使用云存档。
-- 此配置无法通过执行本 schema.sql 生效，必须在对应 Supabase 项目的后台单独设置。
-- 注意：此方案不校验手机号归属，也不是免密码注册；用户仍须设置至少 6 位密码。
-- 如需真正的短信验证码/免密手机号登录，应另外接入 Supabase Phone OTP 和短信服务。
-- 项目设置：https://supabase.com/dashboard/project/cydvlahdycqttljesokw/auth/providers?provider=Email
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 异界卷 · 云存档数据库 schema
-- 请在 Supabase Dashboard → SQL Editor 中执行此文件
-- ═══════════════════════════════════════════════════════════════

-- 1. 建表
CREATE TABLE IF NOT EXISTS public.game_saves (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot        integer NOT NULL,
    save_data   jsonb NOT NULL,
    title       text DEFAULT '',
    world_name  text DEFAULT '',
    character_name text DEFAULT '',
    updated_at  timestamptz DEFAULT now(),

    -- 每个用户每个槽位只能有一条记录
    CONSTRAINT uq_user_slot UNIQUE (user_id, slot)
);

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_game_saves_user_id ON public.game_saves (user_id);
CREATE INDEX IF NOT EXISTS idx_game_saves_user_slot ON public.game_saves (user_id, slot);
CREATE INDEX IF NOT EXISTS idx_game_saves_updated_at ON public.game_saves (user_id, updated_at DESC);

-- 3. 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_game_saves_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_saves_updated_at ON public.game_saves;
CREATE TRIGGER trg_game_saves_updated_at
    BEFORE UPDATE ON public.game_saves
    FOR EACH ROW
    EXECUTE FUNCTION update_game_saves_updated_at();

-- 4. 启用 RLS
ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;

-- 5. 删除已有的策略（幂等执行用）
DROP POLICY IF EXISTS "Users can read own saves" ON public.game_saves;
DROP POLICY IF EXISTS "Users can insert own saves" ON public.game_saves;
DROP POLICY IF EXISTS "Users can update own saves" ON public.game_saves;
DROP POLICY IF EXISTS "Users can delete own saves" ON public.game_saves;

-- 6. RLS 策略
-- 用户只能读取自己的存档
CREATE POLICY "Users can read own saves"
    ON public.game_saves
    FOR SELECT
    USING (auth.uid() = user_id);

-- 用户只能插入自己的存档
CREATE POLICY "Users can insert own saves"
    ON public.game_saves
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的存档
CREATE POLICY "Users can update own saves"
    ON public.game_saves
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的存档
CREATE POLICY "Users can delete own saves"
    ON public.game_saves
    FOR DELETE
    USING (auth.uid() = user_id);

-- 7. 授予 authenticated 用户对表的访问权限
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_saves TO authenticated;
