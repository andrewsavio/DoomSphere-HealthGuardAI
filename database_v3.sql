-- Supabase Storage System for Compressed PDF Reports
-- Execute this script in your Supabase SQL Editor

-- 1. Create a table to track report metadata
CREATE TABLE IF NOT EXISTS public.scan_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    patient_name TEXT,
    scan_type TEXT,
    severity TEXT,
    file_name TEXT NOT NULL,
    file_size_kb INTEGER,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.scan_reports ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (since backend python script acts anonymously unless using service key)
CREATE POLICY "Allow anonymous inserts to scan_reports" ON public.scan_reports
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Allow anonymous selects
CREATE POLICY "Allow public reading of scan_reports" ON public.scan_reports
    FOR SELECT TO anon, authenticated
    USING (true);

-- 2. Create the Storage Bucket for PDFs
-- Note: Supabase provides a UI for this, but here is the SQL equivalent
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'reports',
    'reports',
    true, -- Publicly accessible so we can easily share the PDF link
    10485760, -- 10MB limit
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true, 
    allowed_mime_types = ARRAY['application/pdf'];

-- 3. Setup Storage Policies for the 'reports' bucket
CREATE POLICY "Allow public viewing of reports"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'reports' );

CREATE POLICY "Allow public uploads to reports bucket"
    ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = 'reports' );
