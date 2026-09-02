import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  getAvatarPath,
  uploadAvatar,
  validateAvatarFile,
} from '@/features/profiles/avatar';
import type { Database } from '@/types/database.generated';

describe('upload d’avatar', () => {
  it('construit un chemin stable appartenant au compte', () => {
    expect(getAvatarPath('user-id')).toBe('user-id/avatar.webp');
  });

  it('refuse un type MIME non autorisé avant envoi', () => {
    const file = new File(['contenu'], 'avatar.svg', {
      type: 'image/svg+xml',
    });
    expect(() => validateAvatarFile(file)).toThrow('AVATAR_TYPE');
  });

  it('remonte un échec Storage sans annoncer un succès', async () => {
    const upload = vi.fn().mockResolvedValue({ error: new Error('storage') });
    const client = {
      storage: { from: () => ({ upload }) },
    } as unknown as SupabaseClient<Database>;
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });

    await expect(
      uploadAvatar(client, 'user-id', file, async () =>
        Promise.resolve(new Blob(['compressed'], { type: 'image/webp' })),
      ),
    ).rejects.toThrow('AVATAR_UPLOAD');
    expect(upload).toHaveBeenCalledOnce();
  });
});
