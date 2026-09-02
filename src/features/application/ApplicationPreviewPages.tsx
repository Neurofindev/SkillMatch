import {
  Compass,
  LayoutDashboard,
  MessagesSquare,
  PanelsTopLeft,
} from 'lucide-react';

import { Badge, Card, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const pageContent = {
  overview: {
    title: 'Structure de l’espace',
    description:
      'Le shell applicatif est prêt, sans session fictive ni donnée métier inventée.',
    icon: LayoutDashboard,
  },
  discover: {
    title: 'Découverte à venir',
    description:
      'La recherche et le matching déterministe seront reliés à des données persistantes dans les phases prévues.',
    icon: Compass,
  },
  missions: {
    title: 'Missions à venir',
    description:
      'La publication et le suivi seront ajoutés après le schéma Supabase et ses politiques d’accès.',
    icon: PanelsTopLeft,
  },
  messages: {
    title: 'Messages à venir',
    description:
      'Aucune conversation de démonstration n’est affichée. Les échanges seront privés et réservés aux participants.',
    icon: MessagesSquare,
  },
} as const;

export function ApplicationPreviewPage({
  page = 'overview',
}: {
  page?: keyof typeof pageContent;
}) {
  const content = pageContent[page];
  useDocumentTitle(content.title);
  return (
    <section className="app-preview-page">
      <header>
        <Badge tone="info">Fondation technique</Badge>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </header>
      <Card>
        <EmptyState
          description="Cette zone reste volontairement vide tant que les données, l’authentification et les autorisations serveur ne sont pas en place."
          icon={<content.icon />}
          title="Aucune donnée de démonstration"
        />
      </Card>
    </section>
  );
}
