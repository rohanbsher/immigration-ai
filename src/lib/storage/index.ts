import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Re-export utilities for backward compatibility (but prefer direct import from utils.ts in client components)
export {
  formatFileSize,
  isAllowedFileType,
  getFileExtension,
  generateFilePath,
} from './utils';

/**
 * Security-focused expiration times for signed URLs.
 * Shorter durations reduce the window of exposure if URLs are leaked.
 */
export const SIGNED_URL_EXPIRATION = {
  /** For AI processing - 10 minutes is sufficient for most operations */
  AI_PROCESSING: 600, // 10 minutes
  /** For user downloads - 5 minutes is enough for most downloads */
  USER_DOWNLOAD: 300, // 5 minutes
  /** For preview/viewing - 15 minutes for viewing in the UI */
  PREVIEW: 900, // 15 minutes
  /** Legacy default - 1 hour (use more specific durations when possible) */
  DEFAULT: 3600, // 1 hour
} as const;

export interface UploadOptions {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
}

export interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, unknown>;
}

// Client-side storage functions
export const storage = {
  async uploadFile({ bucket, path, file, upsert = false }: UploadOptions) {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert,
        contentType: file.type,
      });

    if (error) {
      throw error;
    }

    return data;
  },

  async downloadFile(bucket: string, path: string) {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) {
      throw error;
    }

    return data;
  },

  async deleteFile(bucket: string, path: string) {
    const supabase = createClient();

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw error;
    }
  },

  async deleteFiles(bucket: string, paths: string[]) {
    const supabase = createClient();

    const { error } = await supabase.storage
      .from(bucket)
      .remove(paths);

    if (error) {
      throw error;
    }
  },

  getPublicUrl(bucket: string, path: string) {
    if (bucket === 'documents') {
      throw new Error('Documents bucket requires signed URLs');
    }
    const supabase = createClient();

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  },

  async getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  },

  async listFiles(bucket: string, folder?: string) {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder);

    if (error) {
      throw error;
    }

    return data as StorageFile[];
  },
};

// Server-side storage functions
export const serverStorage = {
  async uploadFile({ bucket, path, file, upsert = false }: UploadOptions) {
    const supabase = await createServerClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert,
        contentType: file.type,
      });

    if (error) {
      throw error;
    }

    return data;
  },

  async deleteFile(bucket: string, path: string) {
    const supabase = await createServerClient();

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw error;
    }
  },

  getPublicUrl(bucket: string, path: string) {
    if (bucket === 'documents') {
      throw new Error('Documents bucket requires signed URLs');
    }
    // Note: This is a sync operation that doesn't need await
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  },

  async getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
    const supabase = await createServerClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  },
};

