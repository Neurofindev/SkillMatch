# SkillMatch — rapport QA de phase 11

Date d’exécution : 2026-09-01
Statut : validé sur l’environnement local décrit ci-dessous

## Environnement

- Windows, Node.js 24.16.0 et npm ;
- Docker Desktop 29.6.2 ;
- Supabase CLI 2.115.0, PostgreSQL/Auth/Storage/Realtime et Mailpit locaux ;
- Vite 8.2.1, Vitest 4.1.11 et Playwright Chromium ;
- application Vite sur `http://127.0.0.1:5173` et preview Playwright sur `http://127.0.0.1:4173` ;
- viewports Playwright : 320 × 720, 390 × 844, 844 × 390, 768 × 1024, desktop Chromium et 1920 × 1080.

Le dossier `SkillMatch` reste non suivi dans le dépôt Git parent : `git status --short` renvoie `?? ../`. Aucun commit n’a donc été créé et Git ne peut pas fournir un diff fiable fichier par fichier.

## Résultats reproductibles

### Chaîne rapide

`npm run verify` termine avec le code 0 :

- TypeScript : 0 erreur ;
- ESLint : 0 erreur et 0 avertissement ;
- Vitest : 26 fichiers réussis, 74 tests réussis, 0 échec, 0 ignoré ;
- build Vite : 2 067 modules transformés, code 0.

### Base et sécurité

`npm run db:verify` termine avec le code 0 après reconstruction complète :

- 14 migrations et le seed local rejoués ;
- lint PostgreSQL : `No schema errors found` ;
- deux smoke tests SQL : `DO`, `DO` ;
- pgTAP : 10 fichiers, 471 tests réussis, 0 échec ;
- concurrence d’acceptation : `matches=1`, `conversations=1`, `agreements=1`, `members=2`, `accepted=1`, `rejected=1` ;
- types TypeScript régénérés depuis le schéma local.

Les tests négatifs couvrent notamment l’anonyme, le propriétaire, l’autre participant, le tiers, l’auto-attribution de rôle, les écritures directes, le blocage, les ressources masquées, les pièces jointes privées et les transitions interdites.

### Parcours réels multi-comptes

`npm run verify:full` termine avec le code 0. Après `verify` et `db:verify`, il exécute une chaîne E2E modulaire sur la même base fraîche :

1. inscription et confirmation locale par Mailpit ;
2. onboarding en neuf étapes, capacité double, compétence et disponibilité persistées ;
3. restauration de session après rechargement à 320 px ;
4. création d’une mission, sauvegarde du wizard, erreur de fichier, publication et annulation ;
5. découverte avec filtre URL, remote sans distance et favori persistant ;
6. deux candidatures explicitement prévisualisées et confirmées ;
7. lecture client, comparaison de deux profils, présélection et swipe sans envoi automatique ;
8. acceptation confirmée et retry idempotent ;
9. création unique du match, de la conversation, de l’accord et de deux membres ;
10. Realtime bidirectionnel sans doublon, persistance, retry, non-lus et lien de notification ;
11. confirmation indépendante de l’accord par les deux participants ;
12. démarrage, livraison, note d’avancement, double confirmation de fin et clôture ;
13. avis dans les deux sens, moyennes exactes 4/5 et 5/5, doublon refusé ;
14. dashboard client, nouveau profil et double mode alimentés par les données réelles ;
15. blocage réellement appliqué à l’écriture et signalement persisté ;
16. accès normal refusé à la modération, mise en examen puis masquage avec exactement deux actions d’audit ;
17. vérifications SQL et recherches statiques confirmant l’absence de Wallet ou de mécanisme de paiement.

Chaque script crée ses comptes isolés pour rendre l’échec localisable et le scénario rejouable. Tous utilisent Supabase Auth, les tables, RPC et politiques RLS réelles ; aucune liste métier en mémoire ne sert de preuve.

### Playwright, Axe et responsive

`npm run test:e2e` exécute 162 cas :

- 152 réussis ;
- 10 ignorés intentionnellement : les deux assertions nommément réservées à 320 px sont ignorées dans les cinq autres projets ;
- 0 échec.

Trente-six scans Axe publics ont été exécutés, soit six routes sur six viewports. Le parcours modérateur ajoute un scan authentifié à 390 px. Résultat cumulé : aucune violation d’impact critique ou sérieux.

Les contrôles automatisés vérifient l’absence de débordement horizontal, les cibles principales de 44 px, `prefers-reduced-motion`, le lien d’évitement, les chargements directs, les erreurs, les pages légales et le refus de la modération sans session. Les parcours locaux ajoutent les formulaires, la comparaison, le swipe, l’accord, la messagerie, les erreurs de fichier et les états réels authentifiés à 320 px.

Un contrôle clavier dans le navigateur intégré a vérifié :

- premier `Tab` sur « Aller au contenu principal » ;
- `Entrée` déplaçant réellement le focus sur `<main id="contenu">` ;
- ouverture du menu mobile par `Entrée`, focus initial sur le premier élément ;
- fermeture par `Échap` et restitution du focus au bouton ;
- inscription sans débordement horizontal dans un viewport de 320 px avec barre de défilement classique ;
- aucune erreur console pendant ce contrôle.

## Performance et réseau

Le découpage par route existant a été complété par des groupes stables pour React, Supabase, les formulaires, TanStack Query et les primitives d’interface. Le chunk d’entrée est passé de 630,06 kB minifié à 29,05 kB (8,78 kB gzip). Le plus gros chunk final est `react-core`, 284,64 kB (90,59 kB gzip), suivi de Supabase à 208,54 kB (53,91 kB gzip). Vite ne produit plus d’avertissement de chunk supérieur à 500 kB.

Les routes métier restent paresseuses, les listes serveur sont paginées, les recherches sont agrégées, les abonnements Realtime sont limités à la conversation visible et les scripts vérifient leur déduplication. Aucun hotlink HTTP(S) n’est présent dans `src` ou `public`.

## Recherches de sécurité et d’artefacts interdits

Les recherches ont porté sur `wallet`, `payment`, `payout`, `transaction`, `invoice`, `escrow`, `Stripe`, `PayPal`, `solde`, `retrait` et `paiement sécurisé`, ainsi que sur les secrets et le rendu actif.

- Aucun schéma, route, composant, dépendance, notification ou action financière n’existe.
- Les occurrences restantes sont les interdictions de documentation, les tests négatifs de schéma, le terme technique « transactionnel » et la mention obligatoire expliquant que SkillMatch ne traite aucun paiement.
- Aucun `dangerouslySetInnerHTML` dans l’application.
- Aucun `console.log` dans `src` ; les sorties présentes dans `scripts` sont des résumés de tests sans donnée personnelle.
- Aucune clé codée en dur. `service_role` apparaît seulement dans la documentation, les contrôles défensifs, la configuration commentée et un test de refus.
- `npm install --save-dev @axe-core/playwright` a terminé avec 0 vulnérabilité npm signalée.

## Correctifs réalisés

- ajout des tests de formatage français, modes/capacités, budget informatif, score explicable, nouveau profil, mission remote et boutons accessibles ;
- ajout d’Axe, de six projets responsive et de contrôles d’overflow, cibles tactiles et réduction des animations ;
- correction du rôle accessible de la région de notifications ;
- correction du lien d’évitement public afin que sa cible reçoive réellement le focus ;
- suppression des `min-width: 320px` globaux qui créaient 15 px de débordement avec une barre de défilement non superposée ;
- découpage du bundle de production ;
- stabilisation des parcours locaux face au nouveau dashboard et aux mutations optimistes asynchrones ;
- ajout du parcours modérateur local réel et de `verify:full`.

## Limites non testées

- Aucun e-mail n’a été délivré par un fournisseur externe : seule la capture Mailpit locale a été vérifiée.
- Firefox, WebKit, Safari/iOS et de vrais appareils tactiles n’ont pas été exécutés ; la matrice utilise Chromium avec six tailles.
- Aucun lecteur d’écran physique n’a été utilisé. La sémantique, les noms accessibles, le focus et Axe ont été vérifiés, mais VoiceOver/NVDA restent à contrôler avant ouverture publique.
- Les en-têtes `public/_headers` sont intégrés au build, mais leur émission HTTP réelle nécessite une préproduction Cloudflare Pages.
- Aucun test de charge, de réseau mobile dégradé prolongé ou de délivrabilité Realtime multi-région n’a été effectué.
- La suppression totale Auth/Storage reste une procédure serveur documentée, pas une réussite simulée dans l’interface.

Ces limites n’affectent pas la validation locale de la phase, mais elles restent des contrôles de préproduction obligatoires.

---

## Audit final de phase 12

Date : 2026-09-01

### Installation et dépendances

- `npm ci` : succès après arrêt de l’ancien processus Vite qui verrouillait `lightningcss` sous Windows ; 323 paquets installés depuis `package-lock.json`.
- `npm audit --audit-level=high` : succès via le registre officiel, 0 vulnérabilité.
- `npm run format:check` : succès, tous les fichiers reconnus sont conformes.

### Chaîne finale autonome

`npm run verify:full` démarre désormais son propre Vite Preview sur `127.0.0.1:4173`, transmet la même URL aux parcours locaux et à Playwright, puis ferme le serveur dans un bloc `finally`. Aucun serveur manuel préalable n’est requis.

Résultat final : succès, code 0.

- TypeScript : 0 erreur.
- ESLint : 0 erreur et 0 avertissement.
- Vitest : 26 fichiers, 74 tests réussis, 0 échec, 0 ignoré.
- Build : 2 067 modules transformés ; entrée 29,05 kB/8,78 kB gzip ; plus gros chunk `react-core` 284,64 kB/90,59 kB gzip ; chunk wizard 16,38 kB/5,49 kB gzip.
- `deployment:check` : fallback SPA, copie des en-têtes, CSP, HSTS, limites de ligne et deux variables publiques validés.
- Base vide : 14 migrations rejouées dans l’ordre, trois buckets réappliqués, seed local séparé.
- Lint base : aucun problème dans `extensions`, `private` ou `public`.
- Smoke SQL : schéma et contraintes, 2 succès.
- pgTAP : 10 fichiers, 471 assertions réussies, 0 échec.
- Concurrence : exactement 1 acceptation, 1 rejet, 1 match, 1 conversation, 1 accord et 2 membres.
- Parcours persistés : Auth/Mailpit/onboarding, missions, candidatures, matches/accord, messages Realtime, avis/dashboard et modération, tous réussis.
- Playwright : 162 scénarios collectés, 152 réussis, 10 ignorés intentionnellement car spécifiques au viewport 320 px, 0 échec, sur six viewports.
- Axe : 36 scans publics plus le scan modérateur authentifié, aucune violation critique ou sérieuse.

### Défauts découverts et corrigés

1. Le test de routage utilisait le délai implicite d’une seconde pour des routes paresseuses et pouvait échouer sous forte concurrence. Les quatre attentes de route ont désormais un délai borné de cinq secondes ; le fichier a réussi trois exécutions parallèles avant la chaîne finale.
2. `verify:full` dépendait d’un preview déjà lancé. Un orchestrateur versionné gère maintenant son cycle de vie et garantit le nettoyage à l’échec.
3. Le wizard mission réinitialisait ses valeurs par `requestAnimationFrame` après le premier rendu. Une saisie très rapide pouvait être effacée avant « Suivant ». Le reset initial redondant a été retiré ; les resets lors d’un vrai changement de brouillon ou mission restent actifs.

### Scan final

- Aucun motif de clé privée détecté. Les occurrences de `service_role` sont des refus explicites, de la documentation, un commentaire de configuration ou une vérification serveur.
- Aucun Stripe, PayPal, Wallet, payout, invoice ou escrow dans l’implémentation. `payment=()` désactive l’API navigateur ; `non-payment` nomme la mention d’absence de paiement ; les autres occurrences sont des tests négatifs. « retrait » concerne uniquement le retrait d’une candidature.
- Aucun `dangerouslySetInnerHTML`. Les `console.log` sont limités aux scripts de vérification et ne contiennent pas de donnée privée.
- Aucun hotlink applicatif ; les seules URL du code sont les domaines Supabase autorisés par CSP et des valeurs de test.
- `.gitignore` exclut `.env` et toutes ses variantes sauf `.env.example`.
- `git diff --check` : succès. `git status --short` reste `?? ../` car le dossier SkillMatch entier n’est pas suivi dans le dépôt parent.

### Déploiement externe

Non exécuté. Les variables `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` et `SUPABASE_ACCESS_TOKEN` étaient absentes, Wrangler n’était pas installé et aucun projet Supabase Cloud n’était lié. Aucune URL n’est inventée.

La procédure manuelle, les redirections Auth, la vérification HTTP/CSP, le rollback et la reprise après pause sont documentés dans `docs/deployment.md`. Les quotas et alertes sont dans `docs/free-tier-constraints.md`.

### Limites restantes avant ouverture publique

- SMTP externe et délivrabilité e-mail non testés ;
- en-têtes non observés sur une vraie réponse Cloudflare Pages ;
- aucune restauration d’une sauvegarde cloud ;
- Firefox, WebKit, appareils physiques et lecteur d’écran réel non exécutés ;
- aucune charge ou recette Realtime multi-région ;
- procédure légale et opérationnelle de suppression Auth/Storage à finaliser.

Le MVP est validé localement sur Chromium et Supabase local. Il n’est pas qualifié comme prêt pour une ouverture publique tant que ces contrôles externes ne sont pas fermés.
