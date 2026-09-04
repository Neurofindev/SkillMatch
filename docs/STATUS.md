# SkillMatch — état final du projet

Dernière mise à jour : 2026-09-04
Phase courante : 12 — documentation, déploiement gratuit et audit final
État : validée localement et déployée ; recette de production partielle effectuée

## Terminé

- Les phases 00 à 12 sont validées localement. Aucun prompt de phase supplémentaire n’est autorisé.
- La documentation de référence, l’architecture, la sécurité, la feuille de route, l’audit du prototype, le rapport QA, les contraintes Free et la procédure de déploiement sont alignés.
- Le prototype historique reste une archive externe et ne participe pas au runtime, au build ou aux données.
- La configuration navigateur contient uniquement l’URL Supabase et la clé publishable ; les variantes `.env` sont ignorées sauf `.env.example`.
- Cloudflare Pages fournit le fallback SPA natif ; le build `dist` contient une CSP compatible Supabase Cloud, HSTS, anti-frame, `nosniff`, COOP, Permissions-Policy et le cache immuable des actifs hachés.
- `npm run verify:full` est autonome : il reconstruit la base, démarre son preview, joue tous les parcours puis nettoie le serveur.
- Deux défauts découverts pendant l’audit ont été corrigés : timeout trop court sur les routes lazy et perte possible d’une saisie très rapide au premier écran du wizard mission.
- La régression de reprise de l’onboarding publiée le 2 septembre a été corrigée : le brouillon attend désormais la restauration effective de la session.
- La publication de mission est désormais visible sur mobile et depuis l’en-tête applicatif ; un compte sans capacité client est guidé vers l’activation avant d’ouvrir le wizard. Les compétences sont saisies librement par les utilisateurs et seulement normalisées en interne pour le matching.
- Une candidature refusée par la capacité `can_work` affiche désormais une explication exploitable et guide vers l’activation de « trouver une mission » au lieu du message générique sur l’état.
- Une conversation privée unique peut être ouverte par le talent ou le client dès qu’une candidature réelle est envoyée et reçue. Elle devient lisible seule après refus/retrait et le même historique est réutilisé si la candidature est acceptée.
- L’échéance tronquée de la mission « Recrutement de copywriter » a été réparée de `0026-09-05` vers `2026-09-05`. Le wizard refuse désormais les années antérieures à 2000 et les échéances passées ; Supabase applique la même règle à la publication et aux modifications d’une mission découvrable.

## Résultats exacts

- `npm ci` : 323 paquets installés depuis le lockfile.
- `npm audit --audit-level=high` : 0 vulnérabilité.
- `npm run verify:full` : succès, code 0.
- TypeScript/ESLint : 0 erreur, 0 avertissement.
- Vitest : 31 fichiers, 89 tests réussis, 0 échec, 0 ignoré.
- Base : 18 migrations rejouées, 3 buckets et lint sans problème.
- pgTAP : 13 fichiers, 504 assertions réussies, 0 échec.
- Concurrence : 1 acceptation, 1 rejet, 1 match, 1 conversation, 1 accord, 2 membres.
- Harnais messagerie : 3 comptes Auth confirmés ; conversation créée par les deux parties avant acceptation, messages persistés, même conversation après acceptation, accès tiers refusé `42501`, Realtime sans doublon, clavier et 320 px validés.
- Harnais persistés : 7 parcours applicatifs multi-comptes plus 1 test de concurrence, couvrant Auth/onboarding, missions, candidatures, match/accord, Realtime, avis/dashboard et modération.
- Playwright : 162 scénarios, 152 réussis, 10 ignorés intentionnellement, 0 échec, 6 viewports.
- Axe : 36 scans publics et 1 scan modérateur authentifié, aucune violation critique ou sérieuse.
- Build : entrée 29,43 kB/8,90 kB gzip ; plus gros chunk 284,64 kB/90,59 kB gzip.
- Configuration de déploiement : fallback SPA natif, CSP, en-têtes, artefacts et variables publiques validés statiquement et sur Pages.
- Format et `git diff --check` : succès.

## Partiel ou non testé

- E-mails : confirmation Mailpit locale et confirmation externe via Brevo validées de bout en bout ; récupération de mot de passe externe non encore testée.
- Navigateurs : Chromium validé ; Firefox, WebKit, appareils physiques et lecteur d’écran réel non testés.
- Exploitation : aucune charge, reprise cloud, restauration de sauvegarde ou recette Realtime multi-région.
- Confidentialité : export et demande de suppression honnêtes ; effacement/anonymisation définitifs Auth/Storage encore opérés manuellement.
- Sécurité HTTP : CSP, HSTS, COOP, anti-frame, `nosniff`, Permissions-Policy et cache immuable observés sur Cloudflare Pages.
- Git : dépôt dédié propre, branche `main`, origine `https://github.com/Neurofindev/SkillMatch.git` et déploiement automatique Cloudflare actif.

## Déploiement

- Supabase local : exécuté et validé.
- Supabase Cloud : projet `omsrvbgurjfpqqompacp` lié, 18 migrations alignées et lint local sans erreur.
- Auth : SMTP Brevo actif, cinq modèles transactionnels français enregistrés, URL du site et trois retours exacts autorisés.
- Cloudflare Pages : projet `skillmatch`, branche `main`, déploiements automatiques activés.
- URL de production : [https://skillmatch-wo9.pages.dev](https://skillmatch-wo9.pages.dev).
- Révision fonctionnelle déployée : `d8d2fd14c4b4fa216051f1fb761ccce766a70313`.
- Le bundle public contient l’action « Échanger sur la candidature » et les RPC de conversation par candidature ; le wizard de mission borne désormais les dates à partir du jour courant.

## Décision de sortie

Le MVP est techniquement validé et publié. Il ne doit pas être présenté comme prêt pour une ouverture publique générale avant validation de la récupération de mot de passe externe, d’une sauvegarde/restauration et des contrôles navigateurs/lecteur d’écran restants.

PHASE 12 : VALIDÉE
