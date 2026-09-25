-- Manual fix: move memberships to your current auth user (same email).
-- 1) Supabase → Authentication → Users → copy your User UID
-- 2) Replace :current_user_id below and run in SQL Editor

-- UPDATE memberships m
-- SET user_id = ':current_user_id'::uuid
-- FROM auth.users u
-- WHERE m.user_id = u.id
--   AND lower(u.email) = lower('tu@email.com')
--   AND m.user_id <> ':current_user_id'::uuid;
