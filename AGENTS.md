# SkillMatch — règles permanentes

Ce fichier s’applique à tout le dépôt. Le prototype HTML/CSS/JavaScript historique est une source d’observation, pas une architecture ni une référence visuelle à réparer pixel par pixel.

## Invariants produit

- SkillMatch met en relation un client qui publie un besoin et un talent qui propose ses compétences.
- Un utilisateur possède un compte unique. Il peut activer la capacité « trouver une mission », « publier une mission », ou les deux ; ces capacités ne créent jamais deux identités séparées.
- Les parcours et contenus visibles par l’utilisateur sont en français. Le code, les identifiants, les schémas et les noms de fichiers utilisent un anglais cohérent.
- L’utilisateur déclare avoir au moins 18 ans pendant l’inscription ou l’onboarding.
- Les missions illégales, dangereuses, médicales, financières réglementées ou exigeant des données sensibles sont interdites. La validation existe côté client pour l’ergonomie et côté serveur pour l’autorité.
- Toute donnée de démonstration est explicitement marquée « Démonstration ». Une métrique, un avis, un classement ou un badge ne doit jamais être présenté comme réel sans source réelle.
- Seul le badge « e-mail vérifié » peut être attribué automatiquement, et seulement à partir d’un e-mail effectivement confirmé par Supabase Auth. Les autres badges nécessitent une règle et une preuve documentées.

## Invariant absolu : aucun paiement

- SkillMatch ne reçoit, ne conserve, ne garantit et ne transfère jamais d’argent.
- Aucun Wallet, solde, retrait, transaction, facture, commission, moyen bancaire, Stripe, PayPal, séquestre ou service financier n’est autorisé, même comme faux composant ou réserve « pour plus tard ».
- Le budget d’une mission et le montant proposé dans une candidature sont des informations de mise en relation uniquement. Ils ne déclenchent aucun flux financier.
- Les textes « paiement sécurisé », « paiement bloqué », « paiement libéré », « paiement garanti » et toute promesse équivalente sont interdits.
- L’accord de mission affiche exactement : “SkillMatch facilite la mise en relation et ne traite aucun paiement. Les modalités de rémunération sont gérées directement entre les participants.”
- Une revue de code doit refuser toute réintroduction de schéma, route, composant, événement, notification ou dépendance de paiement.

## Modes de mission et matching

- Chaque mission possède un mode explicite : local, remote ou hybrid.
- Local exige un lieu ou une zone d’intervention pertinente.
- Remote ne doit jamais être filtré, classé ou pénalisé selon la distance géographique. La distance est absente du calcul et de son dénominateur.
- Hybrid décrit les contraintes de présence et peut utiliser la distance uniquement pour la partie en présentiel.
- Le matching est déterministe, testable et explicable. Aucune API d’intelligence artificielle n’est utilisée.
- L’interface expose les facteurs de score et permet de comprendre pourquoi une mission ou un profil est recommandé.

## Stack et coût

- Frontend cible : React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS et Lucide. Radix UI est limité aux primitives qui apportent un bénéfice d’accessibilité réel.
- Backend cible : Supabase Free pour PostgreSQL, Auth, Storage et Realtime.
- Déploiement cible : Cloudflare Pages Free sur un sous-domaine pages.dev.
- Tests : Vitest, Testing Library, Playwright et tests SQL/RLS avec Supabase local lorsque l’environnement le permet.
- Le petit MVP doit fonctionner avec un coût fixe de 0 € : aucun abonnement, domaine personnalisé, API commerciale ni carte bancaire requis.
- Toute nouvelle dépendance doit être justifiée, maintenue, compatible avec la licence du projet et ne pas rompre le fonctionnement gratuit.

## Architecture et données

- Organiser le code par domaine produit, avec des limites claires entre interface, validation, accès aux données et règles métier.
- TanStack Query gère les données serveur ; l’état local d’interface ne doit pas devenir une seconde base de données.
- React Hook Form et les schémas Zod partagés gèrent les formulaires. La validation serveur reste obligatoire.
- Les migrations SQL sont versionnées. Les tables exposées disposent de politiques RLS testées et du principe du moindre privilège.
- Le frontend n’embarque que la configuration publique nécessaire. Aucun secret, clé service_role, jeton d’administration ou identifiant privé n’est commité ou livré au navigateur.
- Les actions sensibles sont autorisées par l’identité serveur et l’appartenance aux ressources, jamais par un simple rôle ou booléen fourni par le client.
- Les fichiers envoyés sont limités en type et taille, rangés dans des chemins appartenant à l’utilisateur et protégés par des politiques Storage.
- Les journaux ne contiennent ni secret, ni message privé complet, ni donnée sensible inutile.

## Qualité d’interface

- Concevoir mobile-first, puis vérifier les formats mobile étroit, mobile paysage, tablette et desktop.
- Viser WCAG 2.2 AA : navigation clavier complète, focus visible, ordre de lecture logique, libellés explicites, erreurs associées aux champs, annonces live sobres, contrastes vérifiés et respect de prefers-reduced-motion.
- Une modale gère le focus initial, le piège de focus, Échap, la restitution du focus et l’inertie du contenu arrière.
- Ne jamais dépendre uniquement de la couleur, du survol, d’un geste de swipe ou d’une icône sans nom accessible.
- Les états loading, empty, error, offline et success sont prévus pour chaque flux asynchrone.

## Tests et livraison

- Toute règle métier critique a un test unitaire ; tout parcours P0 a au moins un test d’intégration et un scénario Playwright.
- Les politiques RLS sont testées pour le propriétaire, l’autre participant, un utilisateur tiers et un visiteur anonyme.
- Avant livraison : formatage, lint, typecheck, tests unitaires, tests d’intégration, build et tests E2E pertinents doivent réussir.
- Les données de démonstration ne sont jamais utilisées pour faire réussir artificiellement un test de production.
- Les modifications utilisateur hors périmètre sont conservées. Inspecter l’état Git avant et après, ne pas réécrire un fichier sans nécessité et documenter toute limitation si le dossier n’est pas un dépôt Git.

## Garde de phase

- Les phases 00 à 12 sont validées localement ; ne pas les rouvrir sans régression démontrée.
- Aucun prompt de phase supplémentaire n’est autorisé par `docs/STATUS.md`.
- Les décisions de référence vivent dans `docs/PRODUCT_SPEC.md`, `docs/architecture.md`, `docs/ROADMAP.md` et `docs/STATUS.md`. Toute divergence doit être décidée et documentée avant implémentation.
