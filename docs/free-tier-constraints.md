# Contraintes des offres gratuites

Vérification documentaire : 2026-09-01
Périmètre : petit MVP SkillMatch, sans option payante ni carte bancaire engagée

Les quotas ci-dessous sont des conditions fournisseurs, pas des garanties contractuelles de SkillMatch. Ils doivent être revérifiés avant chaque ouverture publique et au moins une fois par trimestre.

## Supabase Free

Sources officielles : [tarification](https://supabase.com/pricing), [facturation et quotas](https://supabase.com/docs/guides/platform/billing-on-supabase), [mise en pause](https://supabase.com/docs/guides/platform/free-project-pausing), [limites Realtime](https://supabase.com/docs/guides/realtime/limits), [limites Storage](https://supabase.com/docs/guides/storage/uploads/file-limits), [limites Auth](https://supabase.com/docs/guides/auth/rate-limits) et [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

| Ressource                            |                     Limite Free vérifiée | Effet pour SkillMatch                                                         |
| ------------------------------------ | ---------------------------------------: | ----------------------------------------------------------------------------- |
| Projets actifs                       | 2 par compte propriétaire/administrateur | réserver un projet au MVP ; les projets en pause ne comptent pas              |
| Base PostgreSQL                      |                       500 Mio par projet | suivre la croissance des messages, événements et audits                       |
| Egress                               |          5 Gio par organisation et cycle | pagination, projections étroites et fichiers bornés sont obligatoires         |
| Storage                              |          1 Gio par organisation et cycle | avatars et pièces jointes doivent être nettoyés selon la procédure documentée |
| Utilisateurs actifs mensuels         |                                   50 000 | suffisant pour un petit MVP, sans promesse de montée en charge                |
| Edge Functions                       |            500 000 invocations par cycle | aucune Edge Function n’est requise par l’architecture actuelle                |
| Realtime                             |         2 millions de messages par cycle | un abonnement seulement sur la conversation visible                           |
| Connexions Realtime de pointe        |                                      200 | les canaux sont nettoyés au démontage et à la déconnexion                     |
| Débit Realtime Free                  |              100 messages/s, 100 joins/s | au-delà, les connexions peuvent être interrompues puis reconnectées           |
| Taille globale maximale d’un fichier |                                    50 Mo | SkillMatch impose plus strict : 2 Mio avatar, 5 Mio mission, 10 Mio message   |

Les quotas d’egress, Storage, Auth et Realtime sont comptabilisés à l’échelle de l’organisation selon la ressource ; la base reste limitée par projet. Un dépassement du plan Free n’entraîne pas une facturation automatique, mais peut conduire à une restriction de service jusqu’au cycle suivant.

### Mise en pause et reprise

Un projet Free ayant trop peu d’activité sur une période d’environ sept jours peut être mis en pause. Supabase envoie normalement un avertissement puis une confirmation au propriétaire. La reprise se fait dans le Dashboard et conserve données/configuration ; la fenêtre de restauration en un clic annoncée est d’un an. SkillMatch doit afficher un état réseau neutre si le backend répond comme projet en pause, et l’exploitant doit surveiller les e-mails de plateforme.

Le plan Free n’inclut pas de sauvegarde automatique. Avant une ouverture publique, l’exploitant doit définir une exportation régulière de la base et des objets Storage, tester une restauration et conserver les sauvegardes hors du projet.

### E-mails Auth

Le fournisseur SMTP intégré de Supabase est destiné aux essais, limité actuellement à deux messages par heure et aux adresses des membres de l’organisation. Il n’offre aucune garantie de livraison. Il ne convient donc pas à des inscriptions publiques.

Mailpit couvre le développement local sans délivrance externe. Avant une ouverture publique, il faut configurer et tester un SMTP externe compatible avec le budget 0 €, ses limites et ses règles de confidentialité. Tant que ce contrôle n’est pas réalisé, confirmation d’e-mail et récupération de mot de passe externes sont des limites bloquantes d’exploitation, même si le code Auth est fonctionnel.

## Cloudflare Pages Free

Sources officielles : [limites Pages](https://developers.cloudflare.com/pages/platform/limits/), [prix des Pages Functions](https://developers.cloudflare.com/pages/functions/pricing/), [en-têtes](https://developers.cloudflare.com/pages/configuration/headers/) et [service des SPA](https://developers.cloudflare.com/pages/configuration/serving-pages/).

| Ressource              |                   Limite Free vérifiée | État SkillMatch                                            |
| ---------------------- | -------------------------------------: | ---------------------------------------------------------- |
| Builds                 |    500/mois, 1 simultané, délai 20 min | un build Vite prend quelques secondes localement           |
| Projets Pages          |                         100 par compte | un seul projet prévu                                       |
| Fichiers par site      |                                 20 000 | le build est très inférieur                                |
| Taille par fichier     |                                 25 Mio | aucun actif de build n’approche ce seuil                   |
| Domaines personnalisés |                         100 par projet | aucun domaine personnalisé requis                          |
| Déploiements preview   |                       illimités actifs | utiles pour la recette, sans être une preuve de production |
| Règles `_headers`      | 100 règles, 2 000 caractères par ligne | deux règles courtes versionnées                            |
| Actifs statiques       |       requêtes gratuites et illimitées | l’application actuelle est entièrement statique côté Pages |

Si des Pages Functions étaient ajoutées, elles partageraient la limite Workers Free de 100 000 requêtes par jour. L’architecture actuelle n’en utilise aucune ; Auth, API, Storage et Realtime sont servis directement par Supabase.

## Surveillance minimale

Chaque semaine pendant une bêta active :

1. consulter Usage dans Supabase : base, Storage, egress, MAU, messages et connexions Realtime ;
2. vérifier les alertes de pause, restrictions et SMTP ;
3. contrôler les erreurs Auth/Storage/Realtime sans journaliser le contenu privé ;
4. vérifier le nombre de builds Pages et les derniers déploiements ;
5. exécuter `npm run verify` avant toute publication.

Chaque mois :

- exporter les données et objets selon la procédure de sauvegarde à définir ;
- vérifier les comptes modérateurs et demandes de suppression ;
- contrôler les fichiers orphelins et volumes de messages/événements ;
- relire cette page si les fournisseurs annoncent un changement.

Seuils internes d’alerte recommandés : 70 % pour enquête, 85 % pour gel des fonctions non essentielles ou nettoyage autorisé, 95 % pour interruption contrôlée des nouveaux uploads. Aucune suppression automatique de données utilisateur ne doit être déclenchée uniquement pour respecter un quota.

## Dégradation attendue

- projet Supabase en pause ou restreint : lecture/écriture/Auth indisponibles, interface d’erreur avec retry ; reprise opérateur requise ;
- quota Storage proche : désactiver temporairement les nouveaux fichiers, jamais les messages texte ou l’accès aux données existantes ;
- pression Realtime : conserver l’écriture persistante et retomber sur les invalidations/rechargements bornés ;
- quota de build Pages atteint : le dernier déploiement reste servi, mais aucune nouvelle version ne part avant réinitialisation ;
- SMTP indisponible : ne jamais annoncer que l’e-mail a été délivré ; proposer un nouvel essai après le délai autorisé.

L’offre gratuite convient à une expérimentation et à un petit MVP surveillé. Elle ne fournit ni SLA, ni sauvegarde automatique, ni délivrabilité e-mail de production, ni capacité garantie pour une ouverture publique non supervisée.
