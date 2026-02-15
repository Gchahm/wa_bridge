-- Add media_path column to messages
ALTER TABLE wa_bridge.messages ADD COLUMN media_path text;

-- Create private storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('wa-media', 'wa-media', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: authenticated users can read media files
CREATE POLICY "auth_users_read_wa_media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'wa-media');
