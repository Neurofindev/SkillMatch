import { z } from 'zod';

export const capabilitySchema = z.enum(['find', 'publish', 'both'], {
  message: 'Choisissez au moins une capacité.',
});

export const workPreferenceSchema = z.enum(['local', 'remote', 'both'], {
  message: 'Choisissez au moins un mode de travail.',
});

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Le username doit contenir au moins 3 caractères.')
  .max(30, 'Le username ne peut pas dépasser 30 caractères.')
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
    'Utilisez uniquement des lettres, chiffres, tirets et underscores.',
  )
  .transform((value) => value.toLowerCase());

export const skillLevelSchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

export const availabilityVisibilitySchema = z.enum([
  'private',
  'matched',
  'public',
]);

const dateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}, 'Choisissez une date valide.');

const baseProfileObject = z.object({
  avatarPath: z.string().max(500).nullable(),
  availabilityEnd: dateSchema,
  availabilityStart: dateSchema,
  availabilityVisibility: availabilityVisibilitySchema,
  bio: z
    .string()
    .trim()
    .min(20, 'Présentez-vous en au moins 20 caractères.')
    .max(2000, 'La bio ne peut pas dépasser 2 000 caractères.'),
  capability: capabilitySchema,
  city: z.string().trim().max(100, 'La ville est trop longue.'),
  countryCode: z
    .string()
    .trim()
    .max(2, 'Utilisez le code pays sur 2 lettres.')
    .transform((value) => value.toUpperCase()),
  displayName: z
    .string()
    .trim()
    .min(2, 'Le nom affiché doit contenir au moins 2 caractères.')
    .max(80, 'Le nom affiché ne peut pas dépasser 80 caractères.'),
  headline: z
    .string()
    .trim()
    .max(140, 'L’accroche ne peut pas dépasser 140 caractères.')
    .refine(
      (value) => value.length === 0 || value.length >= 3,
      'L’accroche doit contenir au moins 3 caractères.',
    ),
  showApproximateLocation: z.boolean(),
  skills: z
    .array(
      z.object({
        level: skillLevelSchema,
        skillId: z.coerce.number().int().positive(),
      }),
    )
    .min(1, 'Choisissez au moins une compétence.')
    .max(12, 'Choisissez au maximum 12 compétences.')
    .superRefine((skills, context) => {
      const ids = new Set<number>();
      for (const skill of skills) {
        if (ids.has(skill.skillId)) {
          context.addIssue({
            code: 'custom',
            message: 'Une compétence ne peut être ajoutée qu’une fois.',
          });
          return;
        }
        ids.add(skill.skillId);
      }
    }),
  username: usernameSchema,
  workPreference: workPreferenceSchema,
});

function refineProfile(
  values: z.infer<typeof baseProfileObject>,
  context: z.RefinementCtx,
) {
  if (values.workPreference !== 'remote') {
    if (values.city.length < 2) {
      context.addIssue({
        code: 'custom',
        message: 'Indiquez une ville ou zone approximative.',
        path: ['city'],
      });
    }
    if (!/^[A-Z]{2}$/.test(values.countryCode)) {
      context.addIssue({
        code: 'custom',
        message: 'Indiquez le code pays sur 2 lettres.',
        path: ['countryCode'],
      });
    }
  } else if (
    values.countryCode.length > 0 &&
    !/^[A-Z]{2}$/.test(values.countryCode)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Indiquez le code pays sur 2 lettres.',
      path: ['countryCode'],
    });
  }

  if (values.availabilityEnd <= values.availabilityStart) {
    context.addIssue({
      code: 'custom',
      message: 'La fin doit être postérieure au début.',
      path: ['availabilityEnd'],
    });
  }
}

export const profileFormSchema = baseProfileObject.superRefine(refineProfile);
export const onboardingSchema = baseProfileObject
  .extend({
    adultConfirmed: z.literal(true, {
      message: 'Vous devez déclarer avoir au moins 18 ans.',
    }),
  })
  .superRefine(refineProfile);

export type Capability = z.infer<typeof capabilitySchema>;
export type OnboardingValues = z.input<typeof onboardingSchema>;
export type ProfileFormValues = z.input<typeof profileFormSchema>;
export type SkillLevel = z.infer<typeof skillLevelSchema>;
export type WorkPreference = z.infer<typeof workPreferenceSchema>;

export function getDefaultProfileValues(): ProfileFormValues {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 30);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return {
    avatarPath: null,
    availabilityEnd: format(end),
    availabilityStart: format(today),
    availabilityVisibility: 'matched',
    bio: '',
    capability: 'both',
    city: '',
    countryCode: '',
    displayName: '',
    headline: '',
    showApproximateLocation: true,
    skills: [],
    username: '',
    workPreference: 'both',
  };
}

export function getDefaultOnboardingValues(): OnboardingValues {
  return { ...getDefaultProfileValues(), adultConfirmed: true };
}
