import { describe, expect, it } from 'vitest';

import { validateSupabaseConfiguration } from '@/lib/supabase/client';

describe('configuration publique Supabase', () => {
  it('accepte une URL locale et une clé publique non vide', () => {
    expect(
      validateSupabaseConfiguration(
        'http://127.0.0.1:54321',
        'sb_publishable_test_key_123456789',
      ).configuration,
    ).not.toBeNull();
  });

  it('refuse une URL non sécurisée distante', () => {
    expect(
      validateSupabaseConfiguration(
        'http://example.com',
        'sb_publishable_test_key_123456789',
      ).configuration,
    ).toBeNull();
  });

  it('refuse explicitement une clé service_role', () => {
    expect(
      validateSupabaseConfiguration(
        'https://example.supabase.co',
        'service_role_never_in_browser_123456',
      ).configuration,
    ).toBeNull();
  });
});
