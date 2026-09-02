# SkillMatch — feuille de route livrée

Dernière mise à jour : 2026-09-01
Périmètre : phases 00 à 12

Cette feuille de route reflète les phases réellement exécutées. Elle remplace l’ancien découpage indicatif jusqu’à une phase 13, qui ne correspondait plus aux prompts validés.

## Principes de livraison

- un seul compte peut activer les capacités talent, client, ou les deux ;
- aucune fonction de paiement, Wallet, transaction ou garantie financière ;
- Supabase et ses règles RLS constituent l’autorité ;
- le matching est déterministe, explicable et non discriminatoire ;
- les données fictives restent locales et marquées « Démonstration » ;
- chaque phase s’arrête sur des preuves reproductibles et ses limites réelles.

## Phases validées

| Phase | Résultat principal                                                           | État               |
| ----: | ---------------------------------------------------------------------------- | ------------------ |
|    00 | audit du prototype, règles permanentes, spécification et architecture cible  | validée            |
|    01 | fondations React/TypeScript, design system et navigation accessible          | validée            |
|    02 | schéma PostgreSQL, migrations, contraintes et types                          | validée            |
|    03 | RLS, RPC transactionnelles, Storage, seed et tests négatifs                  | validée            |
|    04 | Supabase Auth, session, onboarding reprenable et profils                     | validée            |
|    05 | missions, recherche, filtres URL, favoris et pièces jointes                  | validée            |
|    06 | candidatures, score `relevance-v1`, comparaison et swipe secondaire          | validée            |
|    07 | acceptation atomique, match, accord bilatéral et timeline                    | validée            |
|    08 | messagerie persistante/Realtime et notifications réelles                     | validée            |
|    09 | avis vérifiés, réputation, dashboard et activité hebdomadaire sous seuil     | validée            |
|    10 | signalement, blocage, modération, confidentialité et sécurité produit        | validée            |
|    11 | QA E2E, accessibilité, responsive, performance et correction des régressions | validée            |
|    12 | documentation finale, audit du gratuit et procédure de déploiement           | validée localement |

## Décisions de sortie

Le classement hebdomadaire est conservé uniquement comme activité réelle sur sept jours avec seuil de trois missions et trois talents ; sous ce seuil, l’interface affiche « Données insuffisantes ». Les snapshots historiques, les mécanismes anti-manipulation avancés et toute interprétation qualitative restent hors MVP.

La cible d’hébergement est Cloudflare Pages statique avec Supabase Cloud Free. Aucun accès cloud authentifié n’était disponible en phase 12 : le déploiement externe est non exécuté et aucune URL n’est déclarée. La recette locale et la procédure manuelle sont terminées.

## Après le MVP

Les travaux suivants nécessitent une décision produit ou opérationnelle distincte, pas un nouveau prompt implicite :

- SMTP externe et test de délivrabilité ;
- sauvegarde/restauration et procédure d’incident ;
- suppression/anonymisation Auth et Storage opérée de bout en bout ;
- essais Firefox, WebKit, appareils physiques, NVDA/VoiceOver ;
- tests de charge et de Realtime multi-région ;
- dispositif légal, contact et modération d’exploitation ;
- déploiement preview puis production avec recette HTTP/CSP.

Aucune extension fonctionnelle ne doit précéder la résolution des limites nécessaires à une ouverture publique.
