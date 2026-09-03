# SkillMatch — modèle de menace et matrice d’autorisation

Statut : référence implémentée et auditée jusqu’à la phase 12
Date : 2026-09-01

## Modèle de menace

Acteurs considérés : visiteur anonyme, utilisateur authentifié normal, propriétaire d’une ressource, participant à un match, tiers authentifié, modérateur accordé côté serveur, client contournant l’interface et détenteur d’une clé backend privilégiée.

Actifs protégés : profil privé, brouillons, candidatures, localisation exacte, matches, accords, conversations, pièces jointes, notifications, signalements, rôles sensibles et journal d’événements.

Menaces principales et contrôles :

- usurpation d’identité par `user_id` client : toutes les décisions utilisent `auth.uid()` ;
- lecture horizontale par UUID deviné : RLS et projections publiques à colonnes autorisées ;
- écriture libre de statuts : grants par colonne, triggers et RPC contrôlées ;
- double acceptation : verrou de mission, versions optimistes et index uniques ;
- auto-attribution de modération : aucune écriture API sur `user_roles` ;
- fuite de fichiers : bucket privé, appartenance à la conversation et chemins liés à l’utilisateur ;
- interaction malgré blocage : verrou consultatif commun et vérification dans candidature, match, message et pièce jointe ;
- faux compteurs ou classement : agrégats calculés depuis les lignes et événements réels ;
- détournement d’une fonction privilégiée : `security definer` limité, `search_path` vide, objets qualifiés et grants explicites.
- contournement de l’onboarding par écriture directe : insertion de profil et colonnes d’autorité retirées des grants, finalisation atomique par `save_profile` liée à `auth.uid()` et à l’e-mail confirmé ;
- fuite d’un brouillon d’onboarding : table privée avec politiques propriétaire sur les quatre opérations ;
- faux badge e-mail : projection publique calculée depuis `auth.users.email_confirmed_at`, jamais depuis un booléen fourni par le client.
- publication incomplète ou interdite : contraintes, trigger de publication et validation de contenu s’exécutent côté PostgreSQL avant toute visibilité ;
- modification d’une mission tierce : `save_mission` et `archive_mission` dérivent l’acteur de `auth.uid()`, vérifient le propriétaire et utilisent une version optimiste ;
- fuite par recherche ou agrégation N+1 : `search_missions` retourne uniquement une projection autorisée et réserve le compteur de candidatures au propriétaire ;
- contournement des règles remote : l’RPC d’écriture force les zones à `null`, l’RPC de recherche ne possède aucun argument de distance et conserve remote sous filtre de ville ;
- upload de briefing hostile : bucket privé, préfixe propriétaire, liste MIME, limite de 5 Mio, maximum de trois fichiers et métadonnées RLS.
- candidature silencieuse ou usurpée : l’insertion directe est retirée au rôle authentifié et `submit_application` exige `auth.uid()`, un profil talent complet et une confirmation littérale ;
- score discriminatoire ou manipulé dans le navigateur : le trigger PostgreSQL calcule `relevance-v1` sans identité, âge, photo, sexe, origine ni distance remote et conserve les facteurs sources ;
- consultation horizontale d’une candidature : RLS et `list_applications` limitent chaque ligne au talent candidat ou au propriétaire de la mission et projettent seulement le profil public autorisé ;
- geste ambigu produisant une action finale : un swipe talent ne crée jamais de candidature, un swipe client « passer » ne refuse jamais, et seuls passer/comparer sont annulables automatiquement.
- avis inventé, prématuré ou usurpé : l’insertion directe est révoquée ; `submit_review` dérive les deux participants du match clôturé, valide les notes et s’appuie sur une contrainte unique.
- métrique de réputation ou classement trompeur : moyenne toujours accompagnée du volume, nouveau profil explicite, événements de clôture distincts et liste hebdomadaire vide sous le seuil documenté.
- signalement usurpé ou spam de modération : `submit_report` impose identité active, cible accessible, confirmation, longueur bornée, déduplication ouverte et plafonds de 10/heure et 25/jour ; l’écriture directe est révoquée ;
- élévation de privilège : `user_roles` reste hors profil, sans écriture normale, et chaque RPC de modération vérifie `private.is_moderator(auth.uid())` ; cacher une route ne sert jamais d’autorité ;
- modification concurrente d’un signalement : verrou de ligne et `lock_version`, erreur `40001`, transition finale non rejouable et journal `moderation_actions` sans écriture client ;
- contenu masqué encore découvrable : `search_missions`, `private.can_view_mission`, les profils publics et les nouvelles interactions excluent mission masquée, profil suspendu et relation bloquée ;
- suppression fictive ou destructive : une demande persistée reste explicitement `submitted` ; aucun écran ne prétend que l’effacement Auth/Storage et l’anonymisation sont terminés avant traitement serveur ;
- exfiltration via export : `get_account_export` projette uniquement les données de l’appelant et exclut secrets Auth, e-mail backend et localisation exacte ;
- injection et rendu actif : les textes utilisateurs sont rendus comme texte React, aucun `dangerouslySetInnerHTML` n’est utilisé, les liens de notification restent normalisés côté serveur et les pièces jointes ne sont jamais exécutées ;
- chargement du site dans un cadre ou usage de capacités inutiles : CSP, `frame-ancestors 'none'`, `object-src 'none'`, COOP, `nosniff`, politique de référent et Permissions-Policy désactivant caméra, micro, géolocalisation et paiement.

Risque résiduel : `service_role` et les propriétaires de base contournent RLS par conception. Ces accès sont réservés aux opérations backend et ne doivent jamais être exposés au navigateur, aux logs ou à Cloudflare Pages. Le MVP ne fournit ni équipe 24/7, ni appel de décision, ni détection automatisée, ni garantie de délai. Les durées légales de conservation, l’anonymisation finale, le canal de contact légal, l’effacement Auth/Storage et les procédures d’urgence doivent être validés et opérés avant ouverture publique.

## Matrice RLS applicative

| Ressource                   | Lecture                                                             | Écriture autorisée                                                      |
| --------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `profiles`                  | propriétaire ou modération ; projection publique active via RPC     | champs publics par propriétaire actif ; suspension par RPC modération   |
| `onboarding_drafts`         | propriétaire uniquement                                             | propriétaire uniquement                                                 |
| `skills`                    | compétences actives, y compris anonyme                              | création normalisée par RPC authentifiée ; modération directe seulement |
| `profile_skills`            | propriétaire ou profil publiable                                    | propriétaire                                                            |
| `availability_slots`        | propriétaire, visibilité publique, participant matché ou modération | propriétaire                                                            |
| `missions`                  | visible, propriétaire/participant historique ou modération          | propriétaire actif ; statut et masquage par RPC                         |
| `mission_drafts`            | propriétaire uniquement                                             | propriétaire uniquement                                                 |
| `mission_attachments`       | propriétaire uniquement                                             | propriétaire, parent propre, maximum trois                              |
| `mission_private_locations` | propriétaire, participants du match ou modération                   | propriétaire tant que mission éditable                                  |
| `mission_skills`            | mêmes lecteurs que la mission                                       | propriétaire tant que mission éditable                                  |
| `applications`              | candidat, propriétaire de mission ou modération                     | soumission confirmée et transitions par RPC uniquement                  |
| `application_swipes`        | propriétaire de la mission auteur de la décision                    | RPC client uniquement, sur candidatures réellement reçues               |
| `swipes`                    | auteur                                                              | RPC talent uniquement                                                   |
| `matches`                   | deux participants ou modération                                     | RPC d’acceptation uniquement                                            |
| `agreements`                | deux participants ou modération                                     | confirmations/transitions par RPC uniquement                            |
| `conversations`             | membres ou modération                                               | création par RPC d’acceptation uniquement                               |
| `conversation_members`      | membres ou modération                                               | chaque membre modifie seulement son état de lecture/archivage           |
| `messages`                  | membres ou modération                                               | membre auteur, match actif et absence de blocage                        |
| `mission_events`            | participants ou modération                                          | fonctions serveur uniquement ; journal append-only                      |
| `completion_confirmations`  | participants ou modération                                          | participant sous sa propre identité                                     |
| `notifications`             | destinataire ou modération                                          | destinataire : `read_at` seulement ; création serveur                   |
| `reviews`                   | public via projections bornées                                      | `submit_review` uniquement après mission et match terminés              |
| `favorites`                 | auteur                                                              | auteur, sauf sur sa propre mission                                      |
| `blocks`                    | bloqueur via projection contrôlée                                   | `set_profile_block` uniquement                                          |
| `user_roles`                | utilisateur concerné ou modération                                  | aucune écriture API normale                                             |
| `reports`                   | auteur ou modération                                                | `submit_report` ; état uniquement via RPC modération                    |
| `moderation_actions`        | modération                                                          | ajout transactionnel par `moderate_report`, jamais client               |
| `account_action_requests`   | auteur ou modération                                                | demande via RPC ; traitement serveur requis                             |

Toutes ces tables ont RLS activée et au moins une policy explicite. Le rôle anonyme ne reçoit de grants de table que sur `skills`, `reviews`, `profile_skills` et `availability_slots`, dont les policies limitent les lignes publiques. Le profil public complet passe par `get_public_profiles`, qui n’expose ni majorité, ni onboarding, ni suppression logique. Son indicateur `email_verified` est dérivé de la confirmation effective dans Supabase Auth.

Une suspension ne supprime pas l’historique nécessaire aux participants. Elle retire le profil des projections publiques et refuse les nouvelles missions, candidatures, créations de match et écritures. Une mission masquée disparaît de la découverte et des nouvelles interactions, mais reste accessible à son propriétaire, à ses participants historiques et à la modération. Un blocage conserve également l’historique partagé ; il retire la relation de la découverte et empêche toute nouvelle candidature, tout nouveau match et tout nouveau message dans les deux sens. Les notifications historiques déjà reçues restent un journal personnel, tandis que leurs liens sont revalidés à l’ouverture.

## RPC exposées

| RPC                           | Rôle                                      | Garanties principales                                                                                                  |
| ----------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `accept_application`          | authentifié, propriétaire de mission      | verrou, versions, idempotence, un match, conversation et notifications atomiques                                       |
| `transition_application`      | candidat/propriétaire                     | retrait ou revue seulement, jamais acceptation                                                                         |
| `transition_mission`          | propriétaire/participant selon transition | versions, autorité, audit, double confirmation avant fin                                                               |
| `confirm_agreement`           | participant                               | confirmation distincte, verrouillée, idempotente et auditée                                                            |
| `transition_agreement`        | participant                               | seulement après confirmations et état cohérent du match                                                                |
| `get_public_profiles`         | anonyme/authentifié                       | projection de colonnes explicitement publiables                                                                        |
| `get_application_counts`      | propriétaire authentifié                  | agrégation des candidatures de ses missions                                                                            |
| `get_unread_counts`           | authentifié                               | notifications et messages non lus calculés                                                                             |
| `get_dashboard_stats`         | authentifié                               | statistiques issues des données du compte                                                                              |
| `get_reputation`              | anonyme/authentifié                       | moyenne réelle, score normalisé et volumes sources                                                                     |
| `get_weekly_ranking`          | authentifié                               | événements de fin réels sur sept jours, formule versionnée                                                             |
| `submit_review`               | participant                               | auteur/destinataire dérivés, clôture exigée, notes bornées et unicité                                                  |
| `list_review_opportunities`   | participant                               | collaborations terminées appartenant à l’appelant uniquement                                                           |
| `list_received_reviews`       | anonyme/authentifié                       | avis publics paginés et identité publique minimale                                                                     |
| `get_reputation_summary`      | anonyme/authentifié                       | moyenne, volume, distribution, missions terminées et état nouveau profil                                               |
| `get_dashboard_overview`      | authentifié                               | agrégats limités au compte et adaptés à ses capacités                                                                  |
| `list_dashboard_deadlines`    | authentifié                               | échéances des matches actifs de l’appelant uniquement                                                                  |
| `is_username_available`       | authentifié                               | normalisation et unicité insensible à la casse, sans exposer les profils privés                                        |
| `find_or_create_skill`        | authentifié                               | longueur/texte validés, normalisation serveur, déduplication, maximum 30 créations par 24 h et aucune écriture directe |
| `save_profile`                | propriétaire authentifié                  | profil, compétences et disponibilité validés et remplacés atomiquement                                                 |
| `save_mission`                | propriétaire avec capacité publier        | mission/compétences/fichiers atomiques, version et publication validée                                                 |
| `archive_mission`             | propriétaire                              | version optimiste et statuts archivables seulement                                                                     |
| `search_missions`             | authentifié                               | projection paginée, agrégée, bloquée et sans distance pour remote                                                      |
| `submit_application`          | talent authentifié                        | confirmation explicite, identité serveur, doublon/auto-candidature/blocage refusés                                     |
| `list_applications`           | candidat/propriétaire                     | projection paginée limitée aux parties, score stocké et profil public                                                  |
| `record_mission_swipe`        | talent authentifié                        | passer/enregistrer/intéressé persisté ; aucune candidature créée                                                       |
| `undo_last_mission_swipe`     | talent authentifié                        | annule seulement sa dernière décision et le favori créé par ce parcours                                                |
| `record_application_swipe`    | propriétaire de mission                   | passer/comparer sans statut final, maximum trois comparaisons, version optimiste                                       |
| `undo_last_application_swipe` | propriétaire de mission                   | annule la dernière décision passer/comparer encore réversible                                                          |
| `submit_report`               | authentifié actif                         | cible accessible, confirmation, bornes, déduplication et cadence                                                       |
| `set_profile_block`           | authentifié actif                         | identité serveur, cible distincte, verrou commun et écriture contrôlée                                                 |
| `list_blocked_profiles`       | authentifié                               | blocages de l’appelant et identité publique minimale                                                                   |
| `get_moderation_access`       | authentifié                               | booléen dérivé exclusivement de `user_roles`                                                                           |
| `list_moderation_reports`     | modérateur                                | file paginée, projection limitée et refus `42501` au rôle normal                                                       |
| `get_moderation_report`       | modérateur                                | cible limitée sans Auth, e-mail ni localisation exacte                                                                 |
| `moderate_report`             | modérateur                                | verrou, version, transition, masquage/suspension et audit atomiques                                                    |
| `get_account_export`          | authentifié                               | export allow-listé des données de l’appelant                                                                           |
| `request_account_deletion`    | authentifié                               | confirmation exacte et demande persistée sans faux succès d’effacement                                                 |

## Effet d’un blocage

Le blocage est symétrique pour les nouvelles interactions, quel que soit son auteur : aucune nouvelle candidature, acceptation produisant un match, pièce jointe ou message. Une interaction déjà existante n’est pas effacée et reste lisible à ses participants ; les messages nouveaux sont refusés. Les actions de clôture restent possibles afin de conserver un chemin de résolution et les preuves nécessaires à un signalement.

## Storage

| Bucket                | Lecture                    | Écriture                                                               | Limites                         |
| --------------------- | -------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| `avatars`             | publique                   | `<auth.uid()>/avatar.webp` uniquement                                  | JPEG/PNG/WebP, 2 Mio            |
| `message-attachments` | membres de la conversation | `<conversation-id>/<auth.uid()>/<filename>`, match actif et non bloqué | JPEG/PNG/WebP/PDF/texte, 10 Mio |
| `mission-attachments` | propriétaire uniquement    | `<auth.uid()>/<draft-ou-mission>/<nom-sûr>`                            | 3 fichiers, types sûrs, 5 Mio   |

Le client refuse les autres types, limite l’entrée à 8 Mio, redimensionne au plus à 1 024 px et compresse en WebP avant l’upload maximal de 2 Mio. Le chemin déterministe permet le remplacement sans accumuler d’anciens fichiers ; la suppression est cohérente avec les policies propriétaire. Les suppressions de pièces jointes privées restent permises au propriétaire membre, y compris après blocage, afin qu’il puisse retirer son propre fichier. Aucun type exécutable n’est autorisé.

Un chemin difficile à deviner n’est jamais considéré comme une autorisation. Les buckets privés exigent l’appartenance RLS, le préfixe possédé et, pour un message, un match actif sans blocage. Les buckets imposent leurs limites MIME/taille en plus des contrôles client. Les métadonnées persistées se limitent au nom nettoyé, type MIME, taille, chemin et relation utile ; la suppression est autorisée uniquement au propriétaire concerné.

## Export, suppression et conservation

`get_account_export` produit immédiatement un JSON allow-listé : profil, capacités, missions, candidatures, messages écrits, avis écrits et signalements de l’appelant. Il n’inclut ni secret Supabase Auth, ni e-mail backend, ni adresse exacte, ni coordonnées, ni profil privé complet d’un tiers.

`request_account_deletion` exige la saisie exacte `SUPPRIMER MON COMPTE` et crée une ligne `submitted`, idempotente tant qu’une demande reste ouverte. Cette création ne change pas `profiles.deleted_at` et l’interface dit explicitement que le compte n’est pas encore effacé. Le traitement opérateur devra : vérifier les obligations de conservation, supprimer ou anonymiser les champs publics, préserver le minimum d’intégrité/audit, supprimer les objets Storage applicables, puis traiter l’identité Auth. Les durées et responsabilités juridiques doivent être fixées avant ouverture publique.

## Défense du navigateur

`public/_headers` définit pour Cloudflare Pages une CSP restrictive, interdit les cadres et objets actifs, autorise les connexions uniquement vers l’origine et Supabase Cloud, active HSTS, `nosniff`, une politique de référent stricte, COOP et désactive caméra, micro, géolocalisation, paiement et USB. Les origines localhost ont été retirées de la CSP de production ; Vite local ne sert pas ce fichier. `public/_redirects` effectue seulement le fallback SPA vers `index.html`. `npm run deployment:check` vérifie le contenu source, sa copie dans `dist`, les directives indispensables, l’absence de `unsafe-eval`, la limite de longueur Pages et les deux seules variables publiques. L’émission HTTP reste à contrôler sur une URL Cloudflare Pages réelle.

## Seed et identités

`supabase/seed.sql` est local et séparé des migrations. Il utilise quatre comptes `.invalid`, des noms visibles préfixés « Démonstration », trois modes de mission, plusieurs états de candidature, une conversation courte, un rôle modérateur local et les initiales comme avatars. Tous les `email_confirmed_at` sont `null` : aucun badge ni identité vérifiée n’est inventé. `supabase db push` applique les migrations ; la procédure locale documentée utilise `supabase db reset` pour appliquer en plus le seed.

## Preuves automatisées

- Reconstruction intégrale : quatorze migrations puis seed local, succès.
- Lint des schémas `extensions`, `private` et `public` : aucune erreur ni avertissement.
- pgTAP : 10 fichiers, 471 assertions, toutes réussies.
- Concurrence réelle : deux connexions, exactement un gagnant et un rejet ; 1 match, 1 conversation, 2 membres, 1 candidature acceptée et 1 rejetée.
- Smoke SQL directs : schéma/RLS/grants/search paths et contraintes métier, deux succès.
- Tests négatifs : profil croisé, tiers sur mission/candidature/conversation/signalement, avis prématuré, double candidature, contenu interdit, blocage, rôle sensible et chemins Storage.
- Parcours phase 05 : deux comptes confirmés, publication puis découverte après rechargement, favori persistant, écriture tierce refusée `42501`, annulation et absence de débordement à 320 px.
- Parcours phase 06 : trois comptes confirmés, deux candidatures explicitement confirmées et persistées, lecture/transition tierces refusées, comparaison de deux profils, présélection et retrait persistés, swipe clavier sans candidature ni refus automatique, absence de débordement à 320 px.

Ces résultats prouvent les scénarios testés sur Supabase local ; ils ne constituent pas à eux seuls une certification de sécurité de production.

## Autorité ajoutée en phase 07

| Surface         | Autorité                                           | Protection                                                                                                                       |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Acceptation     | `accept_application`                               | verrou mission puis candidature, versions optimistes, idempotence, contraintes uniques et rejet des autres candidatures ouvertes |
| Espace de match | `list_match_workspaces`, `get_match_workspace`     | projection `security definer` limitée par `auth.uid()` aux deux participants ; RLS conserve l’autorité sur les tables            |
| Accord          | `confirm_agreement`                                | confirmation séparée, horodatée, idempotente, seulement pendant un match actif et une mission assignée                           |
| Démarrage       | `start_match`                                      | activation atomique accord/mission ; trigger anti-contournement des transitions directes                                         |
| Avancement      | `add_mission_progress`                             | participants uniquement ; livraison réservée au talent ; note limitée à 2 000 caractères                                         |
| Fin             | `submit_completion_confirmation`, `complete_match` | insertion directe révoquée ; une décision immuable par participant ; deux confirmations exigées ; clôture atomique               |
| Annulation      | `cancel_match_mission`                             | client uniquement, motif obligatoire et événement append-only, impossible après clôture                                          |

Les nouvelles fonctions `security definer` fixent toutes `search_path = ''`. Les helpers et triggers ne sont pas exécutables par `anon` ou `authenticated`. Le tiers reçoit `42501` sur l’espace de match et ne lit aucune ligne d’accord via RLS. La concurrence réelle produit exactement un match, une conversation, un accord et deux membres.

La timeline expose aux participants uniquement des métadonnées sobres : type, acteur public, horodatage, note d’avancement ou motif d’annulation. Elle ne contient ni coordonnée exacte, ni secret, ni donnée bancaire. Aucun nom de fonction ou de table financière n’a été introduit.

## Autorité ajoutée en phase 08

| Surface             | Autorité                                                                      | Protection                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liste et lecture    | `list_conversations`, `get_conversation_workspace`, `list_messages`           | identité `auth.uid()`, appartenance à `conversation_members`, projections à colonnes autorisées et pagination par curseur                               |
| Envoi               | `send_message`                                                                | insertion directe révoquée, identité serveur, match actif, verrou de paire, blocage symétrique, cadence 5/10 s et 30/min, identifiant client idempotent |
| Pièce jointe        | Storage privé + `send_message`                                                | chemin `<conversation>/<auteur>/<uuid>.<extension>`, bucket, existence, MIME fermé, taille ≤ 10 Mio et nom visible nettoyé                              |
| Lecture/archivage   | `mark_conversation_read`, `set_conversation_archived`                         | mutation du seul membre courant ; non-lus dérivés des messages réels                                                                                    |
| Suppression         | `delete_message`                                                              | auteur uniquement ; contenu et métadonnées de fichier masqués dans la projection, historique de suppression conservé                                    |
| Blocage/signalement | `set_conversation_block`, `report_conversation_participant`                   | cible dérivée du match, blocage appliqué aux écritures dans les deux sens, signalement privé sous identité serveur                                      |
| Notifications       | `list_notifications`, `mark_notification_read`, `mark_all_notifications_read` | destinataire uniquement, chemin normalisé puis autorisé selon la ressource, création de message unique par source                                       |
| Realtime            | publication `messages` et `notifications`                                     | RLS appliquée, abonnement frontend filtré à la conversation courante ou au destinataire, suppression du canal au démontage                              |

`messages` et `notifications` utilisent `replica identity full` afin que les mises à jour autorisées restent cohérentes. Le temps réel sert d’invalidation et ne devient jamais une source de vérité ; une actualisation périodique bornée assure le repli. Une notification de nouveau message ne contient pas son corps. Aucun type, lien ou texte financier n’existe.

## Autorité ajoutée en phase 09

| Surface                 | Autorité                                                 | Protection                                                                                                           |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Publication d’avis      | `submit_review`                                          | identité serveur, match verrouillé, deux états `completed`, notes entières 1–5, doublon contraint                    |
| Opportunités/historique | `list_review_opportunities`, `list_received_reviews`     | appartenance pour les actions, projection publique minimale et pagination                                            |
| Réputation              | `get_reputation_summary`                                 | agrégats calculés, moyenne accompagnée du nombre, distribution exacte et état neutre sans avis                       |
| Dashboard               | `get_dashboard_overview`, `list_dashboard_deadlines`     | `auth.uid()`, agrégats SQL, capacités `can_work`/`can_hire`, aucune donnée d’un tiers                                |
| Activité hebdomadaire   | `get_weekly_ranking`                                     | événements distincts de sept jours, missions/matches terminés, seuil 3 missions/3 talents, note exclue du classement |
| Notification d’avis     | source `source_review_id` unique + chemin `/espace/avis` | un événement réel par avis, destinataire dérivé et lien interne validé                                               |

Les tests négatifs couvrent l’avis avant clôture, le tiers, l’insertion directe et le doublon. Les tests d’agrégation couvrent la moyenne, la distribution, le nouveau profil, les dashboards talent/client/double mode, l’échéance et les deux branches du seuil hebdomadaire. Aucun champ financier n’est agrégé ni notifié.

## Autorité ajoutée en phase 10

| Surface         | Autorité                                                                            | Protection                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Signalement     | `submit_report`                                                                     | mission/profil/message/avis accessible, confirmation, 20–1 500 caractères, catégories fermées, doublon ouvert et cadence |
| Blocage         | `set_profile_block`, helpers et triggers existants                                  | paire verrouillée, découverte filtrée, nouvelles candidatures/matches/messages refusés, historique conservé              |
| Modération      | `user_roles`, `list_moderation_reports`, `get_moderation_report`, `moderate_report` | rôle hors profil, projection minimale, verrou/version, transitions finales, masquage/suspension et audit append-only     |
| Confidentialité | projections publiques, `get_account_export`, `request_account_deletion`             | absence d’e-mail/Auth/adresse exacte, export propre, demande honnête sans effacement fictif                              |
| Storage         | buckets et policies RLS                                                             | appartenance plutôt que secret du chemin, MIME/taille, suppression propriétaire, métadonnées minimales                   |
| Navigateur      | `_headers`, `_redirects`, rendu React                                               | CSP/COOP/nosniff/anti-frame, permissions désactivées, chemins internes validés, aucun HTML utilisateur exécuté           |

Le fichier pgTAP de phase 10 vérifie notamment le refus de l’espace modérateur à un utilisateur normal, l’auto-attribution de rôle, la lecture tierce d’un signalement, l’interaction après blocage, le retrait d’une mission masquée, la suspension hors projection publique, l’export sans données privées, la demande de suppression encore en attente et l’accès tiers à une pièce jointe privée. Cette couverture ne transforme pas le MVP en service de modération industrielle.

## Audit de livraison de phase 12

La frontière cloud reste minimale : Cloudflare Pages sert des fichiers statiques et ne reçoit aucun secret ; Supabase applique Auth, RLS, RPC, Storage et Realtime. Les seules variables exposées sont l’URL Supabase et la clé publishable. `.env.local` est ignoré par Git, `.env.example` ne contient aucune valeur et le contrôle automatisé refuse toute mention de `service_role`, jeton Cloudflare ou jeton personnel Supabase dans ce modèle.

La configuration CSP est compatible avec le domaine Supabase Cloud par défaut. Un domaine Supabase personnalisé, CDN Storage distinct ou nouveau fournisseur externe exigerait une décision, une mise à jour explicite de la allow-list et un nouveau test ; il ne doit jamais être ajouté avec un joker global.

Risques opérationnels restant à fermer avant ouverture publique :

- SMTP externe et délivrabilité de confirmation/récupération ;
- sauvegarde/restauration hors du projet Free et exercice de reprise ;
- observation des en-têtes sur Cloudflare Pages et recette de toutes les redirections Auth ;
- rotation et réponse à l’exposition d’un secret fournisseur ;
- procédure légale de conservation, anonymisation et suppression Auth/Storage ;
- revue des quotas, alertes de pause et restrictions Supabase ;
- tests de charge, navigateurs physiques et lecteur d’écran réel.

Le déploiement externe n’a pas été exécuté faute d’accès authentifié. L’audit final valide les artefacts et la procédure locale, pas une posture de production observée.
