import { CheckCircle2, FileText, MessageCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, Tabs } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const sharedSteps = [
  {
    icon: FileText,
    title: 'Compléter son profil',
    text: 'Les compétences, disponibilités et préférences de mode rendent la recherche plus pertinente.',
  },
  {
    icon: Search,
    title: 'Publier ou découvrir',
    text: 'Chaque mission précise son contexte, son mode et les compétences attendues.',
  },
  {
    icon: MessageCircle,
    title: 'Échanger après acceptation',
    text: 'La conversation privée commence lorsque la candidature est acceptée.',
  },
  {
    icon: CheckCircle2,
    title: 'Convenir et clôturer',
    text: 'Les participants confirment ensemble le cadre puis la fin de la mission.',
  },
] as const;

function Journey({ perspective }: { perspective: 'talent' | 'client' }) {
  return (
    <div className="how-steps">
      {sharedSteps.map(({ icon: Icon, text, title }, index) => (
        <Card key={title}>
          <div className="step-heading">
            <span>{index + 1}</span>
            <Icon aria-hidden="true" />
          </div>
          <h3>{title}</h3>
          <p>{text}</p>
          {index === 1 ? (
            <small>
              {perspective === 'talent'
                ? 'Le talent candidate sur les missions qui lui correspondent.'
                : 'Le client reçoit et présélectionne les candidatures.'}
            </small>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export function HowItWorksPage() {
  useDocumentTitle('Fonctionnement');
  return (
    <main className="page-shell" id="contenu">
      <header className="page-hero">
        <p className="eyebrow">Fonctionnement</p>
        <h1>Un parcours commun, deux points de vue.</h1>
        <p>
          Le compte reste unique. Seuls les raccourcis et les actions utiles
          changent selon que vous cherchez ou publiez une mission.
        </p>
      </header>
      <Tabs
        label="Choisir un point de vue"
        items={[
          {
            value: 'talent',
            label: 'Je cherche une mission',
            content: <Journey perspective="talent" />,
          },
          {
            value: 'client',
            label: 'Je publie une mission',
            content: <Journey perspective="client" />,
          },
        ]}
      />
      <section className="inline-cta">
        <div>
          <h2>Prêt à préparer votre compte ?</h2>
          <p>L’inscription présente clairement les capacités activables.</p>
        </div>
        <Link className="button button-primary" to="/inscription">
          Voir l’inscription
        </Link>
      </section>
    </main>
  );
}
