import { describe, expect, it } from 'vitest';

import { formatWorkMode } from '@/lib/format';
import { hasCapability } from '@/lib/permissions';

describe('formatage français et permissions métier', () => {
  it.each([
    ['local', 'Sur place'],
    ['remote', 'À distance'],
    ['hybrid', 'Hybride'],
  ] as const)('traduit le mode %s en français', (mode, expected) => {
    expect(formatWorkMode(mode)).toBe(expected);
  });

  it('distingue les capacités actives sans fabriquer un second compte', () => {
    const capabilities = ['find_missions', 'publish_missions'] as const;
    expect(hasCapability(capabilities, 'find_missions')).toBe(true);
    expect(hasCapability(capabilities, 'publish_missions')).toBe(true);
    expect(hasCapability(['find_missions'], 'publish_missions')).toBe(false);
  });
});
