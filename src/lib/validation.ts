import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'L’adresse e-mail est obligatoire.')
  .email('Saisissez une adresse e-mail valide.');

export const passwordSchema = z
  .string()
  .min(12, 'Utilisez au moins 12 caractères.')
  .max(128, 'Le mot de passe est trop long.');
