import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  MailCheck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '@/app/providers/AuthProvider';
import { Button, Card, Checkbox, FormField, Input } from '@/components/ui';
import { getFrenchAuthError } from '@/features/auth/authErrors';
import { capabilitySchema } from '@/features/profiles/profileSchemas';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getSupabaseClient } from '@/lib/supabase/client';
import { emailSchema, passwordSchema } from '@/lib/validation';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est obligatoire.'),
});

export const signupSchema = z
  .object({
    adultConfirmed: z
      .boolean()
      .refine(Boolean, 'Vous devez déclarer avoir au moins 18 ans.'),
    capability: capabilitySchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Confirmez votre mot de passe.'),
    rulesAccepted: z
      .boolean()
      .refine(Boolean, 'Vous devez accepter les règles de communauté.'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['passwordConfirmation'],
  });

export const resetRequestSchema = z.object({ email: emailSchema });
export const passwordUpdateSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Confirmez le mot de passe.'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['passwordConfirmation'],
  });

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;
type ResetRequestValues = z.infer<typeof resetRequestSchema>;
type PasswordUpdateValues = z.infer<typeof passwordUpdateSchema>;

function AuthAside() {
  return (
    <aside className="auth-aside">
      <span className="card-icon">
        <LockKeyhole aria-hidden="true" />
      </span>
      <h2>Un compte, deux capacités.</h2>
      <p>
        Vous pouvez chercher des missions, en publier, ou faire les deux sans
        créer une seconde identité.
      </p>
      <ul>
        <li>Session conservée par Supabase Auth</li>
        <li>Coordonnées exactes jamais rendues publiques</li>
        <li>Aucun paiement traité par SkillMatch</li>
      </ul>
    </aside>
  );
}

function AuthConfigurationNotice() {
  const auth = useAuth();
  if (auth.configured) return null;
  return (
    <div className="form-alert" role="alert">
      <strong>Supabase n’est pas configuré.</strong>
      <span>{auth.configurationIssue}</span>
    </div>
  );
}

function SubmitError({ message }: { message: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  return message ? (
    <div
      className="form-alert form-alert-error"
      ref={ref}
      role="alert"
      tabIndex={-1}
    >
      {message}
    </div>
  ) : null;
}

function safeReturnPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return '/espace';
  }
  const from = (state as { from?: unknown }).from;
  return typeof from === 'string' && from.startsWith('/') ? from : '/espace';
}

export function LoginPage() {
  useDocumentTitle('Connexion');
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const submit = async (values: LoginValues) => {
    const client = getSupabaseClient();
    if (!client) return;
    setSubmitError(null);
    const { error } = await client.auth.signInWithPassword(values);
    if (error) {
      setSubmitError(getFrenchAuthError(error, 'login'));
      return;
    }
    navigate(safeReturnPath(location.state), { replace: true });
  };

  return (
    <main className="auth-page" id="contenu">
      <AuthAside />
      <Card className="auth-card">
        <Link className="back-link" to="/">
          <ArrowLeft aria-hidden="true" size={17} /> Retour à l’accueil
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">Connexion</p>
          <h1>Retrouver mon espace</h1>
          <p>Votre session est restaurée automatiquement sur cet appareil.</p>
        </div>
        <AuthConfigurationNotice />
        <SubmitError message={submitError} />
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          <FormField
            error={errors.email?.message}
            id="login-email"
            label="Adresse e-mail"
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
            error={errors.password?.message}
            id="login-password"
            label="Mot de passe"
            required
          >
            {(field) => (
              <Input
                {...field}
                {...register('password')}
                autoComplete="current-password"
                type="password"
              />
            )}
          </FormField>
          <Link className="form-secondary-link" to="/mot-de-passe-oublie">
            Mot de passe oublié ?
          </Link>
          <Button
            className="w-full"
            disabled={!auth.configured}
            isLoading={isSubmitting}
            type="submit"
          >
            Se connecter <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </form>
        <p className="auth-switch">
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </Card>
    </main>
  );
}

export function SignupPage() {
  useDocumentTitle('Inscription');
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<SignupValues>({
    defaultValues: {
      adultConfirmed: false,
      capability: 'both',
      email: '',
      password: '',
      passwordConfirmation: '',
      rulesAccepted: false,
    },
    resolver: zodResolver(signupSchema),
  });

  const submit = async (values: SignupValues) => {
    const client = getSupabaseClient();
    if (!client) return;
    setSubmitError(null);
    const { data, error } = await client.auth.signUp({
      email: values.email,
      options: {
        data: {
          adult_confirmed: values.adultConfirmed,
          community_rules_accepted_at: new Date().toISOString(),
          initial_capability: values.capability,
        },
        emailRedirectTo: `${window.location.origin}/auth/retour`,
      },
      password: values.password,
    });
    if (error) {
      setSubmitError(getFrenchAuthError(error, 'signup'));
      return;
    }
    if (data.session) {
      navigate('/onboarding', { replace: true });
      return;
    }
    setPendingEmail(values.email);
  };

  if (pendingEmail) {
    return (
      <main className="page-shell state-page" id="contenu">
        <Card className="auth-result-card">
          <MailCheck aria-hidden="true" />
          <p className="eyebrow">Adresse à confirmer</p>
          <h1>Consultez votre messagerie</h1>
          <p>
            Un lien de confirmation a été demandé pour{' '}
            <strong>{pendingEmail}</strong>. Le compte ne pourra pas terminer
            l’onboarding avant cette confirmation.
          </p>
          <Link className="button button-secondary" to="/connexion">
            Revenir à la connexion
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="auth-page" id="contenu">
      <AuthAside />
      <Card className="auth-card auth-card-wide">
        <Link className="back-link" to="/">
          <ArrowLeft aria-hidden="true" size={17} /> Retour à l’accueil
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">Inscription</p>
          <h1>Créer mon compte unique</h1>
          <p>
            Vous pourrez modifier vos capacités plus tard depuis votre profil.
          </p>
        </div>
        <AuthConfigurationNotice />
        <SubmitError message={submitError} />
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          <FormField
            error={errors.email?.message}
            id="signup-email"
            label="Adresse e-mail"
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
            description="12 caractères minimum. N’utilisez pas un mot de passe employé ailleurs."
            error={errors.password?.message}
            id="signup-password"
            label="Mot de passe"
            required
          >
            {(field) => (
              <Input
                {...field}
                {...register('password')}
                autoComplete="new-password"
                type="password"
              />
            )}
          </FormField>
          <FormField
            error={errors.passwordConfirmation?.message}
            id="signup-password-confirmation"
            label="Confirmer le mot de passe"
            required
          >
            {(field) => (
              <Input
                {...field}
                {...register('passwordConfirmation')}
                autoComplete="new-password"
                type="password"
              />
            )}
          </FormField>
          <fieldset className="choice-fieldset">
            <legend>Je souhaite *</legend>
            <label>
              <input type="radio" value="find" {...register('capability')} />
              Trouver une mission
            </label>
            <label>
              <input type="radio" value="publish" {...register('capability')} />
              Publier une mission
            </label>
            <label>
              <input type="radio" value="both" {...register('capability')} />
              Faire les deux
            </label>
            {errors.capability ? (
              <p className="field-error" role="alert">
                {errors.capability.message}
              </p>
            ) : null}
          </fieldset>
          <div className="checkbox-stack">
            <Checkbox
              {...register('adultConfirmed')}
              aria-describedby={
                errors.adultConfirmed ? 'adult-error' : undefined
              }
              aria-invalid={Boolean(errors.adultConfirmed)}
              label="Je déclare avoir au moins 18 ans."
            />
            {errors.adultConfirmed ? (
              <p className="field-error" id="adult-error" role="alert">
                {errors.adultConfirmed.message}
              </p>
            ) : null}
            <Checkbox
              {...register('rulesAccepted')}
              aria-describedby={
                errors.rulesAccepted ? 'rules-error' : undefined
              }
              aria-invalid={Boolean(errors.rulesAccepted)}
              label={
                <>
                  J’accepte les{' '}
                  <Link to="/regles-communaute">règles de communauté</Link>.
                </>
              }
            />
            {errors.rulesAccepted ? (
              <p className="field-error" id="rules-error" role="alert">
                {errors.rulesAccepted.message}
              </p>
            ) : null}
          </div>
          <Button
            className="w-full"
            disabled={!auth.configured}
            isLoading={isSubmitting}
            type="submit"
          >
            Créer mon compte <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </form>
        <p className="auth-switch">
          Déjà un compte ? <Link to="/connexion">Se connecter</Link>
        </p>
      </Card>
    </main>
  );
}

export function ResetPasswordRequestPage() {
  useDocumentTitle('Mot de passe oublié');
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ResetRequestValues>({
    resolver: zodResolver(resetRequestSchema),
  });

  const submit = async ({ email }: ResetRequestValues) => {
    const client = getSupabaseClient();
    if (!client) return;
    setSubmitError(null);
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/mot-de-passe/nouveau`,
    });
    if (error) {
      setSubmitError(getFrenchAuthError(error, 'reset-request'));
      return;
    }
    setSent(true);
  };

  return (
    <main className="page-shell state-page" id="contenu">
      <Card className="auth-card standalone-auth-card">
        <KeyRound aria-hidden="true" />
        <p className="eyebrow">Récupération</p>
        <h1>Réinitialiser le mot de passe</h1>
        {sent ? (
          <div className="form-alert" role="status">
            Si un compte correspond à cette adresse, un lien de réinitialisation
            a été envoyé.
          </div>
        ) : (
          <>
            <p>
              Indiquez l’adresse du compte. La réponse reste volontairement
              identique, qu’un compte existe ou non.
            </p>
            <AuthConfigurationNotice />
            <SubmitError message={submitError} />
            <form
              onSubmit={(event) => void handleSubmit(submit)(event)}
              noValidate
            >
              <FormField
                error={errors.email?.message}
                id="reset-email"
                label="Adresse e-mail"
                required
              >
                {(field) => (
                  <Input
                    {...field}
                    {...register('email')}
                    autoComplete="email"
                    type="email"
                  />
                )}
              </FormField>
              <Button
                disabled={!auth.configured}
                isLoading={isSubmitting}
                type="submit"
              >
                Envoyer le lien
              </Button>
            </form>
          </>
        )}
        <Link className="back-link" to="/connexion">
          <ArrowLeft aria-hidden="true" size={17} /> Retour à la connexion
        </Link>
      </Card>
    </main>
  );
}

export function UpdatePasswordPage() {
  useDocumentTitle('Nouveau mot de passe');
  const auth = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<PasswordUpdateValues>({
    resolver: zodResolver(passwordUpdateSchema),
  });

  const submit = async ({ password }: PasswordUpdateValues) => {
    const client = getSupabaseClient();
    if (!client) return;
    setSubmitError(null);
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setSubmitError(getFrenchAuthError(error, 'password-update'));
      return;
    }
    navigate('/espace', { replace: true });
  };

  return (
    <main className="page-shell state-page" id="contenu">
      <Card className="auth-card standalone-auth-card">
        <KeyRound aria-hidden="true" />
        <p className="eyebrow">Sécurité</p>
        <h1>Choisir un nouveau mot de passe</h1>
        {auth.status === 'anonymous' ? (
          <div className="form-alert form-alert-error" role="alert">
            Ce lien est expiré ou invalide. Demandez un nouveau lien.
          </div>
        ) : null}
        <SubmitError message={submitError} />
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          <FormField
            error={errors.password?.message}
            id="new-password"
            label="Nouveau mot de passe"
            required
          >
            {(field) => (
              <Input
                {...field}
                {...register('password')}
                autoComplete="new-password"
                type="password"
              />
            )}
          </FormField>
          <FormField
            error={errors.passwordConfirmation?.message}
            id="new-password-confirmation"
            label="Confirmer le mot de passe"
            required
          >
            {(field) => (
              <Input
                {...field}
                {...register('passwordConfirmation')}
                autoComplete="new-password"
                type="password"
              />
            )}
          </FormField>
          <Button
            disabled={auth.status !== 'authenticated'}
            isLoading={isSubmitting}
            type="submit"
          >
            Enregistrer le mot de passe
          </Button>
        </form>
      </Card>
    </main>
  );
}

export function AuthCallbackPage() {
  useDocumentTitle('Confirmation de l’adresse e-mail');
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('Validation du lien en cours…');

  useEffect(() => {
    let active = true;
    const complete = async () => {
      const client = getSupabaseClient();
      if (!client) {
        if (active) {
          setStatus('error');
          setMessage('Supabase n’est pas configuré sur cet environnement.');
        }
        return;
      }
      try {
        const existing = await client.auth.getSession();
        if (existing.error) throw existing.error;
        if (!existing.data.session) {
          const code = searchParams.get('code');
          if (!code) throw new Error('missing callback code');
          const exchanged = await client.auth.exchangeCodeForSession(code);
          if (exchanged.error) throw exchanged.error;
        }
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        if (!data.user.email_confirmed_at)
          throw new Error('email not confirmed');
        if (active) {
          setStatus('success');
          setMessage(
            'Votre adresse e-mail est confirmée. Vous pouvez poursuivre.',
          );
        }
      } catch (error) {
        if (active) {
          setStatus('error');
          setMessage(getFrenchAuthError(error, 'callback'));
        }
      }
    };
    void complete();
    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <main className="page-shell state-page" id="contenu">
      <Card className="auth-result-card" aria-live="polite">
        {status === 'success' ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <MailCheck aria-hidden="true" />
        )}
        <p className="eyebrow">Confirmation e-mail</p>
        <h1>
          {status === 'loading'
            ? 'Vérification en cours'
            : status === 'success'
              ? 'Adresse confirmée'
              : 'Lien non validé'}
        </h1>
        <p>{message}</p>
        {status === 'success' ? (
          <Link className="button button-primary" to="/onboarding">
            Commencer l’onboarding
          </Link>
        ) : null}
        {status === 'error' ? (
          <Link className="button button-secondary" to="/connexion">
            Revenir à la connexion
          </Link>
        ) : null}
      </Card>
    </main>
  );
}
