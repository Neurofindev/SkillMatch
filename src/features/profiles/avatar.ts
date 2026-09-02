import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.generated';

export const AVATAR_BUCKET = 'avatars';
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function validateAvatarFile(file: File): void {
  if (
    !AVATAR_MIME_TYPES.includes(file.type as (typeof AVATAR_MIME_TYPES)[number])
  ) {
    throw new Error('AVATAR_TYPE');
  }
  if (file.size > AVATAR_INPUT_MAX_BYTES) {
    throw new Error('AVATAR_INPUT_SIZE');
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('AVATAR_COMPRESSION'));
      },
      'image/webp',
      quality,
    );
  });
}

export async function compressAvatar(file: File): Promise<Blob> {
  validateAvatarFile(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(
      1,
      1024 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('AVATAR_COMPRESSION');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.86, 0.74, 0.62, 0.5]) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= AVATAR_MAX_BYTES) return blob;
    }
    throw new Error('AVATAR_OUTPUT_SIZE');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function getAvatarPath(userId: string): string {
  return `${userId}/avatar.webp`;
}

export async function uploadAvatar(
  client: SupabaseClient<Database>,
  userId: string,
  file: File,
  compressor: (source: File) => Promise<Blob> = compressAvatar,
): Promise<string> {
  const compressed = await compressor(file);
  if (compressed.size > AVATAR_MAX_BYTES) throw new Error('AVATAR_OUTPUT_SIZE');
  const path = getAvatarPath(userId);
  const { error } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(path, compressed, {
      cacheControl: '3600',
      contentType: 'image/webp',
      upsert: true,
    });
  if (error) throw new Error('AVATAR_UPLOAD');
  return path;
}

export async function removeAvatar(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { error } = await client.storage
    .from(AVATAR_BUCKET)
    .remove([getAvatarPath(userId)]);
  if (error) throw new Error('AVATAR_REMOVE');
}

export function getAvatarPublicUrl(
  client: SupabaseClient<Database>,
  path: string | null,
): string | undefined {
  if (!path) return undefined;
  return client.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function getFrenchAvatarError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AVATAR_TYPE') {
    return 'Choisissez une image JPEG, PNG ou WebP.';
  }
  if (code === 'AVATAR_INPUT_SIZE') {
    return 'L’image source ne peut pas dépasser 8 Mio.';
  }
  if (code === 'AVATAR_OUTPUT_SIZE') {
    return 'L’image reste trop volumineuse après compression (maximum 2 Mio).';
  }
  if (code === 'AVATAR_REMOVE') {
    return 'L’ancien avatar n’a pas pu être supprimé. Réessayez.';
  }
  return 'L’avatar n’a pas pu être envoyé. L’image précédente est conservée.';
}
