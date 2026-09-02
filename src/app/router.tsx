import { lazy, Suspense, type ReactNode } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';

import { RouteErrorPage } from '@/app/errors/RouteErrorPage';
import { AppShell } from '@/app/layouts/AppShell';
import { PublicLayout } from '@/app/layouts/PublicLayout';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/AuthGuards';

const LandingPage = lazy(() =>
  import('@/features/marketing/LandingPage').then((module) => ({
    default: module.LandingPage,
  })),
);
const HowItWorksPage = lazy(() =>
  import('@/features/marketing/HowItWorksPage').then((module) => ({
    default: module.HowItWorksPage,
  })),
);
const LoginPage = lazy(() =>
  import('@/features/auth/AuthPages').then((module) => ({
    default: module.LoginPage,
  })),
);
const SignupPage = lazy(() =>
  import('@/features/auth/AuthPages').then((module) => ({
    default: module.SignupPage,
  })),
);
const ResetPasswordRequestPage = lazy(() =>
  import('@/features/auth/AuthPages').then((module) => ({
    default: module.ResetPasswordRequestPage,
  })),
);
const UpdatePasswordPage = lazy(() =>
  import('@/features/auth/AuthPages').then((module) => ({
    default: module.UpdatePasswordPage,
  })),
);
const AuthCallbackPage = lazy(() =>
  import('@/features/auth/AuthPages').then((module) => ({
    default: module.AuthCallbackPage,
  })),
);
const OnboardingPage = lazy(() =>
  import('@/features/onboarding/OnboardingPage').then((module) => ({
    default: module.OnboardingPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/features/profiles/ProfilePage').then((module) => ({
    default: module.ProfilePage,
  })),
);
const PrivacyPage = lazy(() =>
  import('@/features/legal/LegalPages').then((module) => ({
    default: module.PrivacyPage,
  })),
);
const TermsPage = lazy(() =>
  import('@/features/legal/LegalPages').then((module) => ({
    default: module.TermsPage,
  })),
);
const CommunityRulesPage = lazy(() =>
  import('@/features/legal/LegalPages').then((module) => ({
    default: module.CommunityRulesPage,
  })),
);
const ContactPage = lazy(() =>
  import('@/features/safety/ContactPage').then((module) => ({
    default: module.ContactPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('@/features/marketing/NotFoundPage').then((module) => ({
    default: module.NotFoundPage,
  })),
);
const ConversationListPage = lazy(() =>
  import('@/features/conversations/ConversationListPage').then((module) => ({
    default: module.ConversationListPage,
  })),
);
const ConversationPage = lazy(() =>
  import('@/features/conversations/ConversationPage').then((module) => ({
    default: module.ConversationPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((module) => ({
    default: module.NotificationsPage,
  })),
);
const ApplicationsPage = lazy(() =>
  import('@/features/applications/ApplicationsPage').then((module) => ({
    default: module.ApplicationsPage,
  })),
);
const ApplicationFormPage = lazy(() =>
  import('@/features/applications/ApplicationFormPage').then((module) => ({
    default: module.ApplicationFormPage,
  })),
);
const ApplicationDetailPage = lazy(() =>
  import('@/features/applications/ApplicationDetailPage').then((module) => ({
    default: module.ApplicationDetailPage,
  })),
);
const SwipePage = lazy(() =>
  import('@/features/applications/SwipePage').then((module) => ({
    default: module.SwipePage,
  })),
);
const MissionDiscoveryPage = lazy(() =>
  import('@/features/missions/MissionDiscoveryPage').then((module) => ({
    default: module.MissionDiscoveryPage,
  })),
);
const FavoriteMissionsPage = lazy(() =>
  import('@/features/missions/MissionDiscoveryPage').then((module) => ({
    default: module.FavoriteMissionsPage,
  })),
);
const MyMissionsPage = lazy(() =>
  import('@/features/missions/MyMissionsPage').then((module) => ({
    default: module.MyMissionsPage,
  })),
);
const MissionDetailPage = lazy(() =>
  import('@/features/missions/MissionDetailPage').then((module) => ({
    default: module.MissionDetailPage,
  })),
);
const MissionWizardPage = lazy(() =>
  import('@/features/missions/MissionWizardPage').then((module) => ({
    default: module.MissionWizardPage,
  })),
);
const MatchesPage = lazy(() =>
  import('@/features/matches/MatchesPage').then((module) => ({
    default: module.MatchesPage,
  })),
);
const MatchWorkspacePage = lazy(() =>
  import('@/features/matches/MatchWorkspacePage').then((module) => ({
    default: module.MatchWorkspacePage,
  })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const ReviewsPage = lazy(() =>
  import('@/features/reviews/ReviewsPage').then((module) => ({
    default: module.ReviewsPage,
  })),
);
const ReviewFormPage = lazy(() =>
  import('@/features/reviews/ReviewFormPage').then((module) => ({
    default: module.ReviewFormPage,
  })),
);
const SecurityPrivacyPage = lazy(() =>
  import('@/features/safety/SecurityPrivacyPage').then((module) => ({
    default: module.SecurityPrivacyPage,
  })),
);
const ModerationQueuePage = lazy(() =>
  import('@/features/safety/ModerationPages').then((module) => ({
    default: module.ModerationQueuePage,
  })),
);
const ModerationDetailPage = lazy(() =>
  import('@/features/safety/ModerationPages').then((module) => ({
    default: module.ModerationDetailPage,
  })),
);

function pending(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <main className="page-shell state-page" id="contenu">
          <Skeleton label="Chargement de la page" lines={5} />
        </main>
      }
    >
      {element}
    </Suspense>
  );
}

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: pending(<LandingPage />) },
      { path: 'fonctionnement', element: pending(<HowItWorksPage />) },
      {
        path: 'connexion',
        element: <PublicOnlyRoute>{pending(<LoginPage />)}</PublicOnlyRoute>,
      },
      {
        path: 'inscription',
        element: <PublicOnlyRoute>{pending(<SignupPage />)}</PublicOnlyRoute>,
      },
      {
        path: 'mot-de-passe-oublie',
        element: (
          <PublicOnlyRoute>
            {pending(<ResetPasswordRequestPage />)}
          </PublicOnlyRoute>
        ),
      },
      {
        path: 'mot-de-passe/nouveau',
        element: pending(<UpdatePasswordPage />),
      },
      { path: 'auth/retour', element: pending(<AuthCallbackPage />) },
      { path: 'confidentialite', element: pending(<PrivacyPage />) },
      { path: 'conditions', element: pending(<TermsPage />) },
      {
        path: 'regles-communaute',
        element: pending(<CommunityRulesPage />),
      },
      { path: 'contact', element: pending(<ContactPage />) },
      { path: '*', element: pending(<NotFoundPage />) },
    ],
  },
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute allowIncompleteProfile>
        {pending(<OnboardingPage />)}
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/espace',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: pending(<DashboardPage />) },
      {
        path: 'decouvrir',
        element: pending(<MissionDiscoveryPage />),
      },
      {
        path: 'missions',
        element: pending(<MyMissionsPage />),
      },
      { path: 'favoris', element: pending(<FavoriteMissionsPage />) },
      { path: 'missions/nouvelle', element: pending(<MissionWizardPage />) },
      {
        path: 'missions/brouillons/:draftId',
        element: pending(<MissionWizardPage />),
      },
      {
        path: 'missions/:missionId/modifier',
        element: pending(<MissionWizardPage />),
      },
      {
        path: 'missions/:missionId',
        element: pending(<MissionDetailPage />),
      },
      {
        path: 'missions/:missionId/candidature',
        element: pending(<ApplicationFormPage />),
      },
      { path: 'candidatures', element: pending(<ApplicationsPage />) },
      {
        path: 'candidatures/:applicationId',
        element: pending(<ApplicationDetailPage />),
      },
      { path: 'swipe', element: pending(<SwipePage />) },
      { path: 'matches', element: pending(<MatchesPage />) },
      {
        path: 'matches/:matchId',
        element: pending(<MatchWorkspacePage />),
      },
      {
        path: 'messages',
        element: pending(<ConversationListPage />),
      },
      {
        path: 'messages/:conversationId',
        element: pending(<ConversationPage />),
      },
      { path: 'notifications', element: pending(<NotificationsPage />) },
      { path: 'avis', element: pending(<ReviewsPage />) },
      { path: 'avis/:matchId', element: pending(<ReviewFormPage />) },
      { path: 'profil', element: pending(<ProfilePage />) },
      { path: 'securite', element: pending(<SecurityPrivacyPage />) },
      { path: 'moderation', element: pending(<ModerationQueuePage />) },
      {
        path: 'moderation/:reportId',
        element: pending(<ModerationDetailPage />),
      },
    ],
  },
];

export function createTestRouter(initialEntries: string[]) {
  return createMemoryRouter(appRoutes, { initialEntries });
}

const router = createBrowserRouter(appRoutes);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
