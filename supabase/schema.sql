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
