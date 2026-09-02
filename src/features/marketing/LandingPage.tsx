import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  MapPin,
  MessagesSquare,
  MonitorUp,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const modes = [
  {
    icon: MapPin,
    title: 'Sur place',
    text: 'Une zone publique utile à la recherche, sans exposer une adresse privée.',
  },
  {
    icon: MonitorUp,
    title: 'À distance',
    text: 'La pertinence repose sur les compétences et les disponibilités, jamais sur la distance.',
  },
  {
    icon: Users,
    title: 'Hybride',
    text: 'Les besoins de présence sont annoncés clairement avant toute candidature.',
  },
] as const;

const steps = [
  ['01', 'Décrivez votre besoin ou vos compétences'],
  ['02', 'Découvrez des profils ou des missions pertinents'],
  ['03', 'Candidatez et échangez après acceptation'],
  ['04', 'Formalisez, réalisez et clôturez la mission'],
] as const;

export function LandingPage() {
  useDocumentTitle('Accueil');
  return (
    <main id="contenu">
      <section className="hero-section">
        <div className="hero-copy">
          <Badge tone="primary">Marketplace de compétences</Badge>
          <h1>Une mission à publier. Une compétence à proposer.</h1>
          <p>
            SkillMatch réunit les deux dans un même compte et rend chaque étape
            compréhensible, du premier besoin à la clôture de la mission.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary button-lg" to="/inscription">
              Créer mon compte <ArrowRight aria-hidden="true" size={19} />
            </Link>
            <Link
              className="button button-secondary button-lg"
              to="/fonctionnement"
            >
              Voir le fonctionnement
            </Link>
          </div>
          <ul className="hero-assurances" aria-label="Principes du service">
            <li>
              <CheckCircle2 aria-hidden="true" /> Un seul compte, deux usages
            </li>
            <li>
              <CheckCircle2 aria-hidden="true" /> Recommandations explicables
            </li>
            <li>
              <CheckCircle2 aria-hidden="true" /> Pensé dès 320 px
            </li>
          </ul>
        </div>
        <div className="journey-board" aria-label="Parcours SkillMatch">
          <div className="journey-board-header">
            <span>Parcours de mission</span>
            <Badge tone="info">Aperçu</Badge>
          </div>
          <div className="journey-card is-current">
            <SearchCheck aria-hidden="true" />
            <div>
              <strong>Explorer</strong>
              <span>Choisir un mode et des compétences</span>
            </div>
          </div>
          <div className="journey-card">
            <BriefcaseBusiness aria-hidden="true" />
            <div>
              <strong>Candidater</strong>
              <span>Présenter sa disponibilité clairement</span>
            </div>
          </div>
          <div className="journey-card">
            <MessagesSquare aria-hidden="true" />
            <div>
              <strong>Échanger</strong>
              <span>Une conversation ouverte après acceptation</span>
            </div>
          </div>
          <div className="journey-board-footer">
            <Sparkles aria-hidden="true" />
            <p>Chaque recommandation pourra expliquer ses critères.</p>
          </div>
        </div>
      </section>

      <section className="section-shell" aria-labelledby="double-capacite">
        <div className="section-heading">
          <p className="eyebrow">Un compte, selon vos besoins</p>
          <h2 id="double-capacite">Vous n’avez pas à choisir un seul rôle.</h2>
          <p>
            Activez la recherche de missions, la publication de besoins, ou les
            deux. Votre profil et vos préférences restent réunis.
          </p>
        </div>
        <div className="two-path-grid">
          <Card>
            <span className="card-icon">
              <SearchCheck aria-hidden="true" />
            </span>
            <h3>Trouver une mission</h3>
            <p>
              Décrivez vos compétences, vos disponibilités et les modes de
              mission qui vous conviennent.
            </p>
          </Card>
          <Card>
            <span className="card-icon card-icon-blue">
              <BriefcaseBusiness aria-hidden="true" />
            </span>
            <h3>Publier une mission</h3>
            <p>
              Présentez le résultat attendu, les contraintes utiles et les
              compétences recherchées.
            </p>
          </Card>
        </div>
      </section>

      <section className="section-shell section-tinted" aria-labelledby="modes">
        <div className="section-heading compact">
          <p className="eyebrow">Trois modes explicites</p>
          <h2 id="modes">La localisation sert le besoin, pas le classement.</h2>
        </div>
        <div className="mode-grid">
          {modes.map(({ icon: Icon, text, title }) => (
            <Card key={title}>
              <span className="card-icon">
                <Icon aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-shell" aria-labelledby="etapes">
        <div className="section-heading compact">
          <p className="eyebrow">Un chemin lisible</p>
          <h2 id="etapes">Quatre repères pour rester maître de la mission.</h2>
        </div>
        <ol className="steps-list">
          {steps.map(([number, label]) => (
            <li key={number}>
              <span>{number}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="section-shell trust-panel"
        aria-labelledby="confiance"
      >
        <div>
          <p className="eyebrow">Confiance par conception</p>
          <h2 id="confiance">Des règles claires avant les effets visuels.</h2>
        </div>
        <div className="trust-list">
          <p>
            <Eye aria-hidden="true" /> Critères de recommandation consultables
          </p>
          <p>
            <ShieldCheck aria-hidden="true" /> Données publiques limitées au
            nécessaire
          </p>
          <p>
            <CheckCircle2 aria-hidden="true" /> Alternatives clavier à chaque
            geste
          </p>
        </div>
      </section>

      <section className="final-cta" aria-labelledby="commencer">
        <h2 id="commencer">Préparez votre prochain échange de compétences.</h2>
        <p>
          L’inscription est préparée sans créer de fausse session dans cette
          première fondation technique.
        </p>
        <Link className="button button-primary button-lg" to="/inscription">
          Découvrir l’inscription <ArrowRight aria-hidden="true" size={19} />
        </Link>
      </section>
    </main>
  );
}
