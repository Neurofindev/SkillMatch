import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../types/database.generated';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export interface SupabaseConfiguration {
  key: string;
  url: string;
}

export type SupabaseConfigurationResult =
  | { configuration: SupabaseConfiguration; issue: null }
  | { configuration: null; issue: string };

function keyContainsServiceRole(key: string): boolean {
  if (key.toLowerCase().includes('service_role')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;

  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const decoded = JSON.parse(atob(normalized)) as { role?: unknown };
    return decoded.role === 'service_role';
  } catch {
    return false;
  }
}

export function validateSupabaseConfiguration(
  urlValue: string | undefined,
  keyValue: string | undefined,
): SupabaseConfigurationResult {
  const url = urlValue?.trim();
  const key = keyValue?.trim();
  if (!url || !key) {
    return {
      configuration: null,
      issue: 'La configuration publique Supabase est absente.',
    };
  }

  try {
    const parsed = new URL(url);
    const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (
      parsed.protocol !== 'https:' &&
      !(parsed.protocol === 'http:' && isLocal)
    ) {
      throw new Error('unsupported protocol');
    }
  } catch {
    return {
      configuration: null,
      issue: 'L’URL publique Supabase n’est pas valide.',
    };
  }

  if (key.length < 20 || keyContainsServiceRole(key)) {
    return {
      configuration: null,
      issue: 'La clé publique Supabase n’est pas valide.',
    };
  }

  return { configuration: { key, url }, issue: null };
}

const configurationResult = validateSupabaseConfiguration(
  supabaseUrl,
  supabaseKey,
);

let client: SupabaseClient<Database> | null = null;

export function hasSupabaseConfiguration(): boolean {
  return configurationResult.configuration !== null;
}

export function getSupabaseConfigurationIssue(): string | null {
  return configurationResult.issue;
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!configurationResult.configuration) return null;
  client ??= createClient<Database>(
    configurationResult.configuration.url,
    configurationResult.configuration.key,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        flowType: 'pkce',
      },
    },
  );
  return client;
}
