-- Provide a fast, public HTTPS bucket for the chatbot to temporarily upload 
-- images for Puter.js AI vision analysis.

-- 1. Create the Storage Bucket for Chat Images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat_images',
    'chat_images',
    true, -- Publicly accessible so Puter.js can read the image URL online
    5242880, -- 5MB limit for single chat images
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true, 
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];

-- 2. Setup Storage Policies for the 'chat_images' bucket

-- Allow anyone to view the images so the AI can safely download them
CREATE POLICY "Allow public viewing of chat images"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'chat_images' );

-- Allow users to upload temporary chat images
CREATE POLICY "Allow public uploads to chat_images bucket"
    ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = 'chat_images' );

-- Allow users to delete their images after analysis (optional cleanup)
CREATE POLICY "Allow public deletions of chat_images"
    ON storage.objects FOR DELETE
    USING ( bucket_id = 'chat_images' );
