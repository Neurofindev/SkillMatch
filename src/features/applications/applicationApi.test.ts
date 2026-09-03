import { describe, expect, it } from 'vitest';

import { getFrenchApplicationError } from '@/features/applications/applicationApi';

describe('messages d’erreur des candidatures', () => {
  it.each([
    [
      'application requires an active work capability',
      'Activez « trouver une mission » dans votre profil avant de candidater.',
    ],
    [
      'the mission application limit has been reached',
      'Cette mission a atteint sa limite de candidatures.',
    ],
    [
      'applications require a discoverable mission',
      'Cette mission n’accepte plus de nouvelles candidatures.',
    ],
    [
      'invalid application content',
      'Vérifiez le message, la disponibilité et la proposition avant de recommencer.',
    ],
  ])('traduit précisément « %s »', (message, expected) => {
    expect(getFrenchApplicationError({ code: '23514', message })).toBe(
      expected,
    );
  });
});
