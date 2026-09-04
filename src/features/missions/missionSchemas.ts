import { z } from 'zod';

export const MISSION_CATEGORIES = [
  'Numérique',
  'Communication',
  'Services',
] as const;
export const WORK_MODES = ['local', 'remote', 'hybrid'] as const;
export const SKILL_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const;
export const BUDGET_MODELS = ['fixed', 'hourly'] as const;

const prohibitedContent =
  /(arme|explosif|drogue|stupéfiant|violence|piratage|rançongiciel|diagnostic médical|prescription médicale|ordonnance|conseil en investissement|crédit réglementé|blanchiment|mot de passe|numéro de carte|données bancaires|pièce d.identité)/i;

export const missionSkillSchema = z.object({
  level: z.enum(SKILL_LEVELS),
  skillId: z.number().int().positive(),
});

export function getTodayIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function deliverablesFromText(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const missionFormSchema = z
  .object({
    applicationDeadline: z
      .string()
      .refine(isIsoDate, 'Indiquez une échéance valide.'),
    budgetMax: z.number().min(0, 'Le budget maximal doit être positif.'),
    budgetMin: z.number().min(0, 'Le budget minimal doit être positif.'),
    budgetModel: z.enum(BUDGET_MODELS),
    category: z.enum(MISSION_CATEGORIES, {
      message: 'Choisissez une catégorie proposée.',
    }),
    countryCode: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || /^[A-Za-z]{2}$/.test(value),
        'Utilisez un code pays à deux lettres.',
      ),
    deliverablesText: z.string().trim().min(3, 'Ajoutez au moins un livrable.'),
    description: z
      .string()
      .trim()
      .min(30, 'Décrivez le besoin en au moins 30 caractères.')
      .max(10_000, 'La description ne peut pas dépasser 10 000 caractères.')
      .refine(
        (value) => !prohibitedContent.test(value),
        'Ce contenu entre dans une catégorie de mission interdite.',
      ),
    endsOn: z.string().refine(isIsoDate, 'Indiquez une date de fin valide.'),
    flexibleSchedule: z.boolean(),
    presenceDetails: z.string().trim().max(1_000),
    publicCity: z.string().trim().max(100),
    publicRegion: z.string().trim().max(140),
    requiredLevel: z.enum(SKILL_LEVELS),
    skills: z
      .array(missionSkillSchema)
      .min(1, 'Sélectionnez au moins une compétence.')
      .max(12, 'Sélectionnez au plus douze compétences.')
      .refine(
        (skills) =>
          new Set(skills.map((skill) => skill.skillId)).size === skills.length,
        'Une compétence ne peut apparaître qu’une fois.',
      ),
    startsOn: z
      .string()
      .refine(isIsoDate, 'Indiquez une date de début valide.'),
    title: z
      .string()
      .trim()
      .min(5, 'Le titre doit contenir au moins 5 caractères.')
      .max(140, 'Le titre ne peut pas dépasser 140 caractères.')
      .refine(
        (value) => !prohibitedContent.test(value),
        'Ce contenu entre dans une catégorie de mission interdite.',
      ),
    workMode: z.enum(WORK_MODES),
  })
  .superRefine((values, context) => {
    if (
      isIsoDate(values.applicationDeadline) &&
      values.applicationDeadline < getTodayIsoDate()
    ) {
      context.addIssue({
        code: 'custom',
        message: 'L’échéance de candidature ne peut pas être dépassée.',
        path: ['applicationDeadline'],
      });
    }
    if (
      values.workMode !== 'remote' &&
      !values.publicCity &&
      !values.publicRegion
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Indiquez une ville ou une région approximative.',
        path: ['publicCity'],
      });
    }
    if (values.workMode === 'hybrid' && values.presenceDetails.length < 5) {
      context.addIssue({
        code: 'custom',
        message: 'Précisez les présences nécessaires pour le mode hybride.',
        path: ['presenceDetails'],
      });
    }
    if (values.budgetMax < values.budgetMin) {
      context.addIssue({
        code: 'custom',
        message: 'Le maximum doit être supérieur ou égal au minimum.',
        path: ['budgetMax'],
      });
    }
    if (values.applicationDeadline > values.startsOn) {
      context.addIssue({
        code: 'custom',
        message: 'L’échéance de candidature doit précéder le démarrage.',
        path: ['applicationDeadline'],
      });
    }
    if (values.startsOn > values.endsOn) {
      context.addIssue({
        code: 'custom',
        message: 'La date de fin doit suivre la date de début.',
        path: ['endsOn'],
      });
    }

    const deliverables = deliverablesFromText(values.deliverablesText);
    if (deliverables.length < 1 || deliverables.length > 10) {
      context.addIssue({
        code: 'custom',
        message: 'Indiquez entre un et dix livrables, un par ligne.',
        path: ['deliverablesText'],
      });
    } else if (
      deliverables.some((item) => item.length < 3 || item.length > 300)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Chaque livrable doit contenir entre 3 et 300 caractères.',
        path: ['deliverablesText'],
      });
    }
  });

export type MissionFormValues = z.infer<typeof missionFormSchema>;
export type MissionSkillValue = z.infer<typeof missionSkillSchema>;
export type WorkMode = (typeof WORK_MODES)[number];
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export type BudgetModel = (typeof BUDGET_MODELS)[number];

export const defaultMissionValues: MissionFormValues = {
  applicationDeadline: '',
  budgetMax: 0,
  budgetMin: 0,
  budgetModel: 'fixed',
  category: 'Numérique',
  countryCode: '',
  deliverablesText: '',
  description: '',
  endsOn: '',
  flexibleSchedule: false,
  presenceDetails: '',
  publicCity: '',
  publicRegion: '',
  requiredLevel: 'intermediate',
  skills: [],
  startsOn: '',
  title: '',
  workMode: 'remote',
};

export const missionStepFields: Record<number, (keyof MissionFormValues)[]> = {
  1: ['title', 'category', 'description'],
  2: ['skills', 'requiredLevel'],
  3: ['workMode'],
  4: ['publicCity', 'publicRegion', 'countryCode', 'presenceDetails'],
  5: ['budgetModel', 'budgetMin', 'budgetMax'],
  6: ['applicationDeadline', 'startsOn', 'endsOn', 'flexibleSchedule'],
  7: ['deliverablesText'],
  8: [],
  9: [],
};
