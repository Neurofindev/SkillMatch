import { zodResolver } from '@hookform/resolvers/zod';
import { Send, ShieldAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Card,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { emailSchema } from '@/lib/validation';

const contactSchema = z.object({
  email: emailSchema,
  reason: z.enum(['question', 'other']),
  message: z
    .string()
    .trim()
    .min(20, 'Décrivez la situation en au moins 20 caractères.')
    .max(1500, 'Le message ne peut pas dépasser 1 500 caractères.'),
});

type ContactValues = z.infer<typeof contactSchema>;

export function ContactPage() {
  useDocumentTitle('Contact');
  const { notify } = useToast();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ContactValues>({
    defaultValues: { reason: 'question' },
    resolver: zodResolver(contactSchema),
  });

  const submit = () => {
    notify({
      title: 'Message non transmis',
      description:
        'Le canal de contact général n’est pas encore opéré. Aucune donnée de ce formulaire n’a été conservée.',
      tone: 'warning',
    });
    reset();
  };

  return (
    <main className="page-shell" id="contenu">
      <header className="page-hero">
        <p className="eyebrow">Contact général</p>
        <h1>Préparer une question sans exposer de données sensibles.</h1>
        <p>
          Pour signaler une mission, un profil ou un message, connectez-vous et
          utilisez l’action « Signaler » directement sur la ressource. Ce
          formulaire général ne transmet encore aucune donnée.
        </p>
      </header>
      <div className="contact-layout">
        <Card className="safety-note">
          <ShieldAlert aria-hidden="true" />
          <h2>Avant d’écrire</h2>
          <p>
            Ne partagez pas de mot de passe, document d’identité, donnée
            médicale ou information financière sensible.
          </p>
          <p>
            En cas de danger immédiat, contactez les services d’urgence de votre
            pays.
          </p>
        </Card>
        <Card className="contact-form-card">
          <form
            onSubmit={(event) => void handleSubmit(submit)(event)}
            noValidate
          >
            <FormField
              error={errors.email?.message}
              id="contact-email"
              label="Adresse e-mail de réponse"
              required
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('email')}
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                />
              )}
            </FormField>
            <FormField
              error={errors.reason?.message}
              id="contact-reason"
              label="Motif"
              required
            >
              {(field) => (
                <Select {...field} {...register('reason')}>
                  <option value="question">Question générale</option>
                  <option value="other">Autre situation</option>
                </Select>
              )}
            </FormField>
            <FormField
              description="N’ajoutez que les éléments nécessaires à la compréhension."
              error={errors.message?.message}
              id="contact-message"
              label="Votre message"
              required
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...register('message')}
                  maxLength={1500}
                />
              )}
            </FormField>
            <Button isLoading={isSubmitting} type="submit">
              <Send aria-hidden="true" size={18} /> Vérifier le message
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
