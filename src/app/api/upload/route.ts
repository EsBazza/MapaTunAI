import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { jsonError } from '@/lib/api';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET_NAME = 'review-photos';

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError(400, 'Please attach a photo.');
    }
    const fileEntry = formData.get('file');
    const file = fileEntry instanceof File ? fileEntry : null;
    // Used as a storage folder name: allow only safe characters (prevents path traversal).
    const rawProjectId = formData.get('projectId');
    const projectId =
      (typeof rawProjectId === 'string' ? rawProjectId : '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) ||
      'general';

    if (!file) {
      return Response.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate MIME type (whitelist only; e.g. image/svg+xml can carry scripts)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return Response.json(
        { error: 'Invalid file format. Please upload an image (JPG, PNG, WebP, etc.).' },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: 'File size exceeds 10MB limit.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Derive the extension from the validated MIME type, never from the user's filename.
    const ext = MIME_EXTENSIONS[file.type] ?? '.jpg';

    const uniqueId = crypto.randomUUID();
    const filePath = `${projectId}/${Date.now()}_${uniqueId}${ext}`;

    const supabaseUrl = env.SUPABASE_URL();
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY();

    // If Supabase Storage is configured, upload to cloud storage
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('Supabase storage upload error:', error);
        return Response.json(
          { error: "Could not save your photo. Please try again." },
          { status: 500 }
        );
      }

      const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      return Response.json({
        success: true,
        url: publicData.publicUrl,
        fileName: filePath,
        provider: 'supabase',
      });
    }

    // Without cloud storage, production refuses uploads instead of stuffing a
    // multi-MB base64 data URL into the database.
    if (process.env.NODE_ENV === 'production') {
      return jsonError(503, "Photo upload isn't set up yet. Please try again later.");
    }

    // Local development fallback only: inline data URL.
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${file.type || 'image/jpeg'};base64,${base64Data}`;

    return Response.json({
      success: true,
      url: dataUrl,
      fileName: filePath,
      provider: 'inline_fallback',
    });
  } catch (error) {
    console.error('Error handling file upload:', error);
    return Response.json(
      { error: 'Failed to process image upload' },
      { status: 500 }
    );
  }
}
