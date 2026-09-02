import { Link } from 'react-router-dom';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface DocumentSection {
  paragraphs?: readonly string[];
  points?: readonly string[];
  title: string;
}

interface DocumentPageProps {
  intro: string;
  sections: readonly DocumentSection[];
  title: string;
}

function DocumentPage({ intro, sections, title }: DocumentPageProps) {
  useDocumentTitle(title);
  return (
    <main className="document-page page-shell" id="contenu">
      <header className="page-hero document-hero">
        <p className="eyebrow">Information publique</p>
        <h1>{title}</h1>
        <p>{intro}</p>
        <small>Version de travail — 18 août 2026</small>
      </header>
      <div className="document-layout">
        <nav aria-label={`Sommaire : ${title}`}>
          {sections.map((section, index) => (
            <a href={`#section-${index + 1}`} key={section.title}>
              {section.title}
            </a>
          ))}
        </nav>
        <article>
          {sections.map((section, index) => (
            <section id={`section-${index + 1}`} key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.points ? (
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <p className="document-contact">
            Une question ou un signalement ?{' '}
            <Link to="/contact">Nous contacter</Link>.
          </p>
        </article>
      </div>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <DocumentPage
      intro="Cette page décrit les données réellement utilisées par SkillMatch et les limites opérationnelles du MVP."
      sections={[
        {
          title: 'Données minimales',
          paragraphs: [
            'SkillMatch doit demander uniquement les informations nécessaires à la mise en relation et au fonctionnement du compte.',
            'Aucune adresse précise ne doit être rendue publique. Une zone approximative suffit avant l’acceptation d’une candidature.',
            'L’e-mail, les données Supabase Auth, les coordonnées exactes, les conversations et les pièces jointes privées ne sont pas inclus dans les réponses publiques.',
          ],
        },
        {
          title: 'Accès, export et suppression',
          points: [
            'Les conversations et accords sont réservés aux participants concernés.',
            'L’utilisateur peut corriger son profil et télécharger un export JSON limité à ses données autorisées.',
            'Une demande de suppression est enregistrée mais ne prétend pas effacer immédiatement le compte : un traitement serveur doit vérifier la conservation nécessaire, anonymiser les relations historiques et supprimer les fichiers applicables.',
          ],
        },
        {
          title: 'Conservation et sécurité',
          paragraphs: [
            'Les données de compte actives sont conservées tant que le compte fonctionne. Les signalements et journaux de modération sont conservés pour la sécurité et l’audit pendant une durée à fixer avant ouverture publique.',
            'Le MVP applique le moindre privilège, des politiques RLS, des fichiers privés pour les conversations et missions, et une journalisation de modération sans message privé complet dans les logs applicatifs.',
            'Cette documentation technique ne remplace pas un avis juridique. Les durées exactes, l’identité du responsable de traitement et le canal de contact légal restent à finaliser avant une ouverture réelle.',
          ],
        },
      ]}
      title="Confidentialité"
    />
  );
}

export function TermsPage() {
  return (
    <DocumentPage
      intro="Ces conditions de travail posent les limites du service et seront complétées avant son ouverture."
      sections={[
        {
          title: 'Objet du service',
          paragraphs: [
            'SkillMatch facilite la rencontre entre une personne qui exprime un besoin et une personne qui propose ses compétences.',
            'Les participants restent responsables des informations qu’ils publient et des engagements qu’ils acceptent.',
          ],
        },
        {
          title: 'Compte unique',
          points: [
            'Un compte peut chercher et publier des missions.',
            'L’utilisateur déclare avoir au moins 18 ans.',
            'Les accès personnels ne doivent pas être partagés.',
          ],
        },
        {
          title: 'Rémunération et accord',
          paragraphs: [
            'Les modalités de rémunération sont convenues et gérées directement entre les participants. SkillMatch se limite à la mise en relation.',
          ],
        },
        {
          title: 'Contenus interdits',
          paragraphs: [
            'Les missions illégales, dangereuses, médicales, financières réglementées, frauduleuses, discriminatoires, abusives ou exigeant des données sensibles sont interdites.',
          ],
        },
      ]}
      title="Conditions d’utilisation"
    />
  );
}

export function CommunityRulesPage() {
  return (
    <DocumentPage
      intro="Ces règles protègent la qualité des échanges et indiquent ce qui n’a pas sa place sur SkillMatch."
      sections={[
        {
          title: 'Publier avec précision',
          points: [
            'Décrire le résultat attendu et les contraintes utiles.',
            'Choisir correctement le mode sur place, à distance ou hybride.',
            'Ne pas publier de coordonnées privées dans les zones publiques.',
          ],
        },
        {
          title: 'Respecter les personnes',
          points: [
            'Aucun harcèlement, menace, discrimination, fraude, abus ou pression.',
            'Aucune collecte de document sensible sans nécessité légitime.',
            'Les désaccords se signalent sans exposition publique.',
          ],
        },
        {
          title: 'Missions exclues',
          points: [
            'Activités illégales ou dangereuses.',
            'Actes médicaux ou conseils financiers réglementés.',
            'Demandes d’accès à des comptes, secrets ou données sensibles.',
            'Contenus frauduleux, discriminatoires, trompeurs ou abusifs.',
          ],
        },
        {
          title: 'Signaler un problème',
          paragraphs: [
            'Depuis une mission, un profil ou un message accessible, l’action « Signaler » enregistre une catégorie, une description limitée et une référence contrôlée. La cible doit être accessible au déclarant et l’envoi doit être confirmé.',
            'Le signalement est privé. Seul son auteur et un rôle modérateur attribué côté serveur peuvent le consulter. Les abus évidents sont limités par déduplication et cadence côté base.',
            'Le blocage empêche les nouvelles candidatures, les nouveaux matchs et les nouveaux messages. L’historique déjà partagé reste disponible aux participants afin de conserver le contexte.',
          ],
        },
      ]}
      title="Règles de communauté"
    />
  );
}
