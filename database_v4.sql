-- Supabase Schema Update: Enforce User Data Privacy & Admin Access

-- 1. Add user_id column to track ownership
ALTER TABLE public.scan_reports ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.scan_results ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Update scan_reports RLS Policies
DROP POLICY IF EXISTS "Allow public reading of scan_reports" ON public.scan_reports;
DROP POLICY IF EXISTS "Allow anonymous inserts to scan_reports" ON public.scan_reports;
DROP POLICY IF EXISTS "Allow system inserts to scan_reports" ON public.scan_reports;
DROP POLICY IF EXISTS "Users view own scan reports and admins view all" ON public.scan_reports;

-- Let the python backend insert records freely via anon key
CREATE POLICY "Allow system inserts to scan_reports" ON public.scan_reports
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Ensure normal users only see their own scans, while admins can see everything
CREATE POLICY "Users view own scan reports and admins view all" ON public.scan_reports
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. Update scan_results RLS Policies
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public reading of scan_results" ON public.scan_results;
DROP POLICY IF EXISTS "Allow system inserts to scan_results" ON public.scan_results;
DROP POLICY IF EXISTS "Users view own scan results and admins view all" ON public.scan_results;

CREATE POLICY "Allow system inserts to scan_results" ON public.scan_results
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Users view own scan results and admins view all" ON public.scan_results
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Update Chat Sessions and Messages to allow Admins to read them
-- (Previously they were strictly locked to auth.uid() = user_id)
DROP POLICY IF EXISTS "Users view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users view own chat sessions and admins view all" ON public.chat_sessions;
CREATE POLICY "Users view own chat sessions and admins view all" ON public.chat_sessions 
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Users view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users view own messages and admins view all" ON public.chat_messages;
CREATE POLICY "Users view own messages and admins view all" ON public.chat_messages 
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
