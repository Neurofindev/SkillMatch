# Architecture cible — ADR initial

ADR-0001
Statut : accepté pour la préparation du MVP
Date : 2026-08-18

## Contexte

Le dossier actuel est un prototype statique, global et non persistant. SkillMatch a besoin d’un parcours complet, sécurisé et mobile-first avec authentification, données relationnelles, conversation temps réel et règles d’accès strictes. Le petit MVP doit fonctionner à coût fixe nul, sans carte bancaire et sans traitement de paiement.

## Décision

Adopter une application client React/TypeScript construite par Vite, déployée sur Cloudflare Pages Free, et un backend Supabase Free utilisant PostgreSQL, Auth, Storage et Realtime.

Stack frontend :

- React et TypeScript en mode strict ;
- Vite pour le développement et le build statique ;
- React Router pour les routes et garde-fous d’onboarding ;
- TanStack Query pour cache, invalidation, erreurs, retries contrôlés et synchronisation serveur ;
- React Hook Form et Zod pour formulaires et schémas ;
- Tailwind CSS pour les styles avec tokens centralisés ;
- Lucide pour les icônes ;
- Radix UI seulement pour les primitives complexes dont l’accessibilité justifie la dépendance.

Tests : Vitest, Testing Library, Playwright, et tests SQL/RLS sur Supabase local lorsque disponible.

## Raisons

- La pile répond aux contraintes explicites du produit et reste exploitable sur les offres gratuites pour un petit MVP.
- PostgreSQL convient aux relations et invariants forts entre missions, candidatures, matches, accords et avis.
- Supabase RLS permet de placer l’autorisation au niveau des données, nécessaire pour les conversations et ressources privées.
- Le build Vite reste portable ; Cloudflare Pages ne porte pas la logique d’autorisation.
- Le typage et les schémas réduisent les divergences de statuts déjà observées dans le prototype.

## Alternatives écartées pour ce MVP

- Réparer le prototype vanilla : couplage global, absence de schémas et de backend trop coûteux à fiabiliser.
- Framework full-stack avec serveur obligatoire : surface opérationnelle inutile pour la cible Pages + Supabase, sauf besoin futur démontré.
- Firebase : possible techniquement, mais le modèle relationnel et les politiques SQL de Supabase correspondent mieux aux invariants du parcours.
- API d’intelligence artificielle : interdite et inutile pour un matching déterministe.
- Backend de paiement : explicitement hors périmètre.

## Organisation cible

    src/
      app/                 composition, providers, router, layouts
      components/          primitives d’interface partagées
      features/
        auth/
        onboarding/
        profiles/
        missions/
        applications/
        matching/
        matches/
        agreements/
        conversations/
        completion/
        reviews/
        favorites/         P1
        notifications/     P1
        safety/            blocage et signalement P1
        rankings/          P2
      lib/                 client Supabase, Query, dates, erreurs
      schemas/             schémas Zod transversaux
      styles/              tokens et styles globaux minimaux
      test/                setup et utilitaires de tests
    supabase/
      migrations/
      seed.sql             démonstration explicitement marquée
      tests/               assertions SQL et RLS
    e2e/
    docs/

Les dossiers sont organisés par domaine métier. Un feature peut exposer ses composants, requêtes, mutations, schémas et tests, sans importer les détails internes d’un autre feature.

## Routes cibles indicatives

Routes publiques : accueil, inscription, connexion, confirmation e-mail, récupération de compte, règles de sécurité.

Routes authentifiées : onboarding, découverte, recherche, détail de mission, publication/édition, missions de l’utilisateur, candidatures envoyées/reçues, match, accord, conversation, clôture, avis, profil et paramètres. Favoris, notifications, blocage et signalement arrivent en P1 ; classement réel en P2.

Une route inconnue rend une page 404 explicite. Les gardes côté React améliorent l’expérience mais ne remplacent jamais les politiques RLS.

## Modèle de données initial

Les noms exacts seront figés par migrations. Entités prévues :

- profiles : extension publique minimale de auth.users, statut d’onboarding et déclaration 18+ ;
- account_capabilities : find_missions et publish_missions pour le compte unique ;
- skills et profile_skills : compétences saisies librement, normalisées en interne pour le matching, et niveaux déclaratifs ;
- availability_rules : disponibilités structurées ;
- missions : propriétaire, mode local/remote/hybrid, zone publique, calendrier, description, budget informatif, statut et règles de modération ;
- mission_skills : compétences recherchées et importance ;
- applications : mission, talent, message, disponibilité, montant proposé informatif et statut ;
- matches : candidature acceptée et deux participants ;
- agreement_versions et agreement_confirmations : instantanés versionnés, confirmation des deux parties et mention zéro paiement ;
- conversations, conversation_members et messages : accès limité aux participants du match ;
- mission_events : transitions métier auditables sans contenu sensible inutile ;
- completion_confirmations : confirmations ou contestations des deux participants ;
- reviews : mission clôturée, auteur, destinataire, note et texte ;
- favorites, notifications, blocks et reports en P1 ;
- weekly_ranking_snapshots en P2, calculés à partir de données réelles.

Il n’existe aucune table Wallet, balance, payment, transaction, invoice, withdrawal, bank_account, escrow ou équivalent.

## Invariants de base de données

- Un profil correspond à un auth.users.
- Une candidature est unique par couple mission/talent dans le petit MVP.
- Le propriétaire d’une mission ne peut candidater à sa propre mission.
- Une seule candidature peut être accepted par mission ; l’opération est transactionnelle.
- Un match référence cette candidature acceptée et ne peut être dupliqué.
- Une conversation de mission n’est lisible que par les membres du match.
- Une confirmation d’accord est unique par version et participant.
- Un avis est unique par mission/auteur/destinataire et exige une mission closed avec auteur et destinataire participants.
- Les valeurs budget et proposed_amount sont informatives et n’entraînent aucune action financière.
- work_mode appartient à local, remote, hybrid. Remote n’exige pas de distance.

## Autorisation et RLS

RLS est activée sur toute table exposée. Principes initiaux :

- profils publics limités à des champs explicitement publiables ; champs privés réservés au propriétaire ;
- mission draft visible par son propriétaire, published visible selon les règles de découverte ;
- candidature visible et modifiable dans des limites précises par son talent, lisible par le propriétaire de la mission ;
- acceptation réservée au propriétaire et implémentée par une fonction transactionnelle contrôlée ;
- match, accord, conversation, messages, clôture et avis limités aux participants concernés ;
- blocage retire la visibilité ou l’interaction selon une matrice documentée ;
- signalements visibles par leur auteur et un rôle de modération côté serveur, jamais par un prétendu rôle frontend ;
- Storage sépare avatars publics et pièces privées éventuelles. Le MVP évite de collecter des justificatifs sensibles.

Chaque politique est testée pour propriétaire, autre participant, tiers authentifié et anonyme.

## Matching déterministe et explicable

Le moteur calcule une moyenne pondérée sur les facteurs applicables : compétences, disponibilité, compatibilité de mode, fiabilité issue de données réelles, complétude et distance lorsque permise.

Pour une mission remote, distance et localisation sont absentes du numérateur et du dénominateur. Pour hybrid, la distance ne concerne que la présence demandée. La sortie inclut score total, version de formule et contributions lisibles. Aucun LLM, embedding ou API d’IA.

Une première implémentation peut rester côté requête SQL ou fonction TypeScript pure selon le volume, mais la même suite de cas contractuels doit valider les deux. Le serveur contrôle les filtres et données autorisées.

## Gestion des données et formulaires

- Les données serveur transitent par TanStack Query ; les clés de requête sont centralisées par feature.
- Les mutations optimistes sont limitées aux actions réversibles. Acceptation, accord et clôture attendent la confirmation serveur.
- Zod fournit des messages français côté client ; PostgreSQL et fonctions serveur imposent les invariants réels.
- Les erreurs Supabase sont traduites en catégories produit sans révéler de détails internes.
- La géolocalisation publique reste approximative. L’adresse exacte, si indispensable après match, exige un modèle privé séparé et une durée de conservation définie.

## Sécurité

- Variables Vite : seules URL Supabase et clé publique publishable/anon sont exposées. Aucune service_role dans le frontend, le dépôt, les logs ou Cloudflare Pages côté client.
- Validation de type, taille et propriétaire pour Storage.
- Limitation d’abus par contraintes SQL, quotas raisonnables, vérification e-mail et contrôles serveur ; compléter selon les capacités gratuites disponibles.
- En-têtes CSP, Referrer-Policy, Permissions-Policy, X-Content-Type-Options et frame-ancestors configurés au déploiement.
- Pas d’HTML utilisateur non fiabilisé ; React échappe par défaut. Toute exception à dangerouslySetInnerHTML exige une justification et une sanitation robuste.
- Collecte minimale, suppression de compte et politique de conservation à spécifier avant production.

## Accessibilité et design

- Système de tokens centralisé, composants testés isolément et styles mobile-first.
- WCAG 2.2 AA visé, avec tests clavier et lecteurs d’écran sur les parcours critiques.
- Dialogues accessibles via primitive éprouvée ou implémentation complète : focus initial, piège, Échap, restitution et fond inerte.
- Le swipe reste optionnel : chaque décision possède un bouton et une vue liste.
- États loading, empty, error, offline et success explicites.

## Déploiement et environnements

- Environnements local, preview et production avec projets ou configurations Supabase séparés lorsque possible.
- Cloudflare Pages construit le frontend Vite et sert les redirections SPA ainsi que les en-têtes de sécurité.
- Les migrations sont appliquées de manière versionnée ; aucun changement manuel non documenté en production.
- Le MVP reste utilisable sur pages.dev et ne requiert ni domaine ni carte bancaire.

## Risques et mesures

- Quotas gratuits : surveiller Auth, base, Storage et Realtime ; prévoir pagination, compression et dégradation sans temps réel.
- Verrouillage fournisseur : garder les règles métier en TypeScript/SQL portable et versionner toutes les migrations.
- RLS complexe : tests négatifs obligatoires et fonctions security definer rares, petites et auditées.
- Temps réel : considérer les événements comme des invalidations ; la base reste la source de vérité.
- Taxonomie de compétences : commencer contrôlé mais extensible, sans texte libre utilisé directement comme vérité de matching.
- Abus et modération : P0 bloque les catégories manifestement interdites ; P1 apporte blocage et signalement persistants.

## Conséquences

La phase 01 doit créer un nouveau socle plutôt que transposer les longues chaînes HTML. Les données du prototype ne sont importées que comme fixtures explicitement marquées « Démonstration ». Le code Wallet et tous les concepts financiers sont supprimés, jamais migrés.

---

# ADR-0002 — Socle frontend de phase 01

Statut : accepté et implémenté
Date : 2026-08-18

## Contexte de mise en œuvre

Le prototype historique reste intact dans `C:/Users/duran/Desktop/site`. Le nouveau socle est construit séparément dans le dossier de travail SkillMatch ; aucune chaîne HTML, donnée simulée ou dépendance distante du prototype n’a été migrée.

## Décisions appliquées

- Vite compose une application React et TypeScript strict, découpée en chunks par page avec `React.lazy` et `Suspense`.
- `src/app` possède le routeur, les providers Query/Auth, les layouts et les limites d’erreur. Les domaines publics, d’identité, juridiques, de sûreté et de préfiguration applicative vivent dans `src/features`.
- Le provider Auth ne fabrique aucune identité. Il expose uniquement les états `unconfigured` ou `anonymous` tant qu’une intégration réelle n’existe pas.
- TanStack Query est configuré comme frontière des futures données serveur. Aucun cache local n’est utilisé comme fausse base.
- Le client Supabase est créé uniquement si les deux variables publiques attendues existent. `.env.example` reste vide et `.env.local` est ignoré.
- Le design system utilise des tokens CSS centralisés intégrés à Tailwind : couleurs, espaces, typographie, rayons, ombres, niveaux de superposition, durées, courbes d’animation et breakpoints.
- Les primitives complexes Dialog, Dropdown et Tabs s’appuient sur Radix UI. Les contrôles simples restent des composants React natifs avec libellés, états et cibles tactiles explicites.
- Le router couvre toutes les pages publiques, une 404, une erreur de route et un shell applicatif honnêtement vide. Le shell ne charge aucune donnée métier ni session de démonstration.
- `public/_redirects` garantit le fallback SPA attendu lors d’un chargement direct sur Cloudflare Pages.
- Vitest et Testing Library couvrent composants, champs, dialogue, clavier, états et router. Playwright couvre les chargements directs, le viewport 320 px, la tablette, le bureau, le lien d’évitement, la 404 et l’absence d’identité simulée.

## Conséquences et limites de phase

La phase 01 fournit une interface exécutable et testable, mais aucun schéma Supabase, migration métier, politique RLS, authentification persistante ou donnée réelle. Le déploiement, les en-têtes de production et l’audit manuel complet avec technologies d’assistance restent dans les phases prévues par la roadmap. La seule phase désormais autorisée est la phase 02.

---

# ADR-0003 — Schéma PostgreSQL versionné de phase 02

Statut : accepté et implémenté
Date : 2026-08-18

## Portée et ordre des migrations

Le schéma est construit exclusivement par trois migrations rejouées dans cet ordre :

1. `20260818190000_extensions_and_types.sql` installe `citext`/`pgcrypto`, les enums fermés et les helpers de timestamps/concurrence.
2. `20260818190100_core_schema.sql` crée les 22 tables, leurs clés, contraintes de forme et comportements de suppression explicites.
3. `20260818190200_integrity_indexes_and_access.sql` ajoute les machines à états, invariants inter-tables, triggers, index et la posture d’accès refusé par défaut.

`supabase db reset` recrée la base locale depuis zéro. Le seed est vide : aucune donnée métier ou de production n’est incluse dans la phase 02.

## Schéma obtenu

- Identité étendue : `profiles`, avec unicité de `username` insensible à la casse, capacités `can_work`/`can_hire`, confirmation adulte minimale et suppression logique.
- Compétences et disponibilité : `skills`, `profile_skills`, `availability_slots`.
- Missions : `missions`, `mission_skills` et `mission_private_locations`. La zone de découverte reste approximative dans `missions`; adresse et coordonnées exactes sont isolées dans la table privée un-à-un.
- Mise en relation : `applications`, `swipes`, `matches`, `favorites`.
- Cadre et réalisation : `agreements`, `completion_confirmations`, `reviews`.
- Échanges : `conversations`, `conversation_members`, `messages`, `notifications`.
- Audit et sûreté : `mission_events`, `reports`, `blocks`, `user_roles`.

Les références composites garantissent qu’un match relie la mission, son propriétaire et le candidat de la candidature retenue. Les conversations, confirmations de fin et avis sont rattachés au même couple match/mission. Des triggers refusent tout membre ou avis extérieur aux deux participants.

## Machines à états autorisées

### Mission

Chemin nominal :

    draft → published → selecting → assigned → in_progress → completed

Branches : `draft`, `published`, `selecting`, `assigned` et `in_progress` peuvent devenir `cancelled`. `selecting` peut revenir à `published`. `completed` et `cancelled` sont terminaux. Une mission `assigned`, `in_progress` ou `completed` exige `assigned_talent_id`.

### Candidature

Chemin nominal :

    submitted → viewed → shortlisted → accepted

Branches : `submitted`, `viewed` ou `shortlisted` peuvent devenir `rejected` ou `withdrawn`. `accepted`, `rejected` et `withdrawn` sont terminaux.

### Accord

Chemins de confirmation :

    draft → client_confirmed → confirmed → active → completed
    draft → talent_confirmed → confirmed → active → completed

`confirmed` exige les deux horodatages de confirmation. Une modification future du périmètre crée une nouvelle ligne avec une version supérieure ; elle ne réécrit pas un instantané confirmé.

### Match

`active` peut devenir `completed` ou `cancelled`, avec un horodatage final cohérent. Ces deux états sont terminaux.

Ces machines remplacent les états indicatifs antérieurs lorsqu’ils divergent. L’autorité du rôle déclenchant une transition sera ajoutée avec les politiques et RPC sensibles du Prompt 03.

## Contraintes structurantes

- Noms, textes, chemins et métadonnées possèdent des bornes explicites.
- Un profil doit activer au moins une capacité et sa capacité principale doit être cohérente.
- L’onboarding ne peut être terminé sans confirmation d’âge minimal ; aucune date de naissance complète n’est stockée.
- Local et hybrid exigent une zone publique approximative ; remote n’exige aucune localisation.
- Les plages de dates sont ordonnées et les valeurs informatives sont positives avec minimum inférieur ou égal au maximum.
- Le propriétaire d’une mission ne peut pas candidater à sa propre mission.
- Un index partiel empêche deux candidatures actives d’un même talent sur une mission.
- Un index partiel empêche deux matchs actifs pour une mission.
- Les notes d’avis sont des entiers de 1 à 5, les participants sont distincts et un seul avis par sens et mission est possible.
- Un avis exige une mission et un match terminés et exactement les deux participants concernés.
- Les cibles polymorphes de swipe et de signalement sont exclusives et cohérentes avec leur type.
- `mission_events` est append-only ; update et delete sont refusés.
- Les chemins de fichier refusent les chemins absolus et la remontée `..`.

## Concurrence et horodatages

Les triggers possèdent un `search_path` vide. `updated_at` est maintenu côté base. `missions`, `applications` et `agreements` ont un `lock_version` incrémenté à chaque mise à jour pour permettre une future écriture optimiste avec comparaison de version. Les accords conservent en plus leur version métier par match.

## Index justifiés

- Découverte des missions : statut, mode et date, uniquement pour les lignes non supprimées.
- Tableaux de bord : propriétaire/candidat, statut et date de mise à jour.
- Candidatures : mission/statut et candidat/statut, plus unicité active partielle.
- Matches : unicité active par mission et index séparés client/talent.
- Conversations : messages par conversation/date et membres non archivés par dernière lecture.
- Notifications : index partiel destinataire/date limité aux non-lues.
- Audit et modération : mission/date pour les événements, statut/date pour les signalements.

Les petites tables de liaison utilisent d’abord leurs clés primaires ; aucun index redondant n’est ajouté sans requête identifiée.

## Accès et RLS à la sortie de phase 02

RLS est activée sur les 22 tables publiques. `anon` et `authenticated` ne reçoivent aucun privilège de table, séquence ou fonction, et aucune politique n’est encore créée. La Data API est donc fermée par défaut. Les politiques par propriétaire/participant/tiers/anonyme et les RPC transactionnelles sensibles appartiennent explicitement au Prompt 03.

## Storage

Deux buckets seulement sont préparés dans `supabase/config.toml` :

- `avatars`, public en lecture, images JPEG/PNG/WebP, 2 MiB maximum ;
- `message-attachments`, privé, JPEG/PNG/WebP/PDF/texte brut, 10 MiB maximum.

Aucune politique permissive globale n’est créée. Les écritures, suppressions et lectures privées attendent les politiques par propriétaire et participant du Prompt 03.

## Types TypeScript et vérification

La génération officielle est préparée par :

    npm run db:types

Elle exécute `supabase gen types typescript --local --schema public` et cible `src/types/database.generated.ts`. La génération doit être rejouée après chaque migration et vérifiée avant d’adapter le client Supabase typé.

Les tests pgTAP versionnés couvrent le contrat de schéma et les cas invalides. Des scripts SQL mono-instruction dans `supabase/verification` permettent aussi la validation directe du schéma et des contraintes dans les environnements qui ne peuvent pas lancer le conteneur `pg_prove`.

---

# ADR-0004 — Autorisation PostgreSQL et opérations atomiques de phase 03

Statut : accepté et implémenté
Date : 2026-08-29

## Frontière d’autorité

`auth.uid()` est l’unique identité utilisateur acceptée par les policies et RPC. Les identifiants d’auteur, de propriétaire ou de participant transmis par un client ne peuvent jamais remplacer cette identité. Les capacités talent/client restent des attributs produit ; les privilèges `admin` et `moderator` vivent uniquement dans `user_roles`.

Les 22 tables applicatives conservent RLS. Les grants SQL sont plus étroits que les policies : `matches`, `agreements`, `conversations`, `mission_events` et `user_roles` n’ont aucun droit d’écriture direct pour `authenticated`. Les colonnes de statut, d’affectation et de confirmation sont exclues des grants de mise à jour et protégées par trigger contre les écritures hors RPC.

Les helpers d’autorisation sont dans le schéma non exposé `private`. Les helpers et RPC `security definer` ont un `search_path` vide, qualifient leurs objets et ne sont exécutables que par les rôles nécessaires.

## Acceptation transactionnelle

`accept_application(application_id, expected_mission_version, expected_application_version)` verrouille d’abord la mission, puis la candidature. Elle vérifie l’appelant propriétaire, les versions, les états `selecting`/`shortlisted` et l’absence de blocage. Dans une seule transaction, elle :

1. accepte la candidature choisie ;
2. rejette les autres candidatures encore ouvertes ;
3. affecte le talent et passe la mission à `assigned` ;
4. crée le match unique, la conversation et exactement deux membres ;
5. ajoute l’événement d’audit et les notifications.

Un retry de la même candidature retourne le résultat existant. Deux candidatures concurrentes sont sérialisées par le verrou de ligne ; les index uniques restent une seconde défense. Le harnais `db:test:concurrency` utilise deux connexions réelles et vérifie qu’une seule transaction gagne sans état partiel.

## Transitions et accord

- `transition_application` autorise le retrait au candidat et les transitions de revue au propriétaire ; l’acceptation en est exclue.
- `transition_mission` autorise les transitions par propriétaire/participant, refuse l’affectation hors acceptation et exige deux confirmations de fin avant `completed`.
- `confirm_agreement` verrouille la version, distingue client et talent, est idempotente par participant et journalise chaque confirmation distincte.
- `transition_agreement` limite le chemin après double confirmation à `confirmed → active → completed`, avec match terminé requis pour le dernier état.

## Blocage et historique

Un blocage dans un sens ou l’autre empêche toute nouvelle candidature, création de match, pièce jointe ou message entre les deux comptes. Un verrou consultatif déterministe sérialise la création d’un blocage avec ces nouvelles interactions. Les matches et historiques existants restent lisibles aux participants afin de conserver les preuves, permettre la clôture et éviter une suppression destructrice ; aucun nouveau message n’est accepté.

## Données dérivées

Les compteurs de candidatures, non-lus, échéances, avis à laisser et missions actives du dashboard sont calculés à la requête et limités à `auth.uid()`. La réputation expose moyenne, nombre, distribution et nombre distinct de missions terminées ; l’absence d’avis produit explicitement un nouveau profil neutre. Le classement `weekly-completions-v2` agrège uniquement les événements distincts `mission_completed` des sept derniers jours reliés à des missions et matches terminés. Il ne renvoie aucun élément avant trois missions et trois talents distincts. Aucun compteur métier mutable n’est maintenu manuellement.

## Storage et types

Les buckets sont créés par migration avec les mêmes limites que `config.toml`. Les avatars suivent `<user-id>/<filename>`. Les pièces privées suivent `<conversation-id>/<user-id>/<filename>` ; lecture par membres, écriture par membre actif non bloqué, suppression par propriétaire membre.

Les types de base et RPC sont générés dans `src/types/database.generated.ts`, et le client Supabase utilise désormais `SupabaseClient<Database>`.

## Décision de phasage

Le Prompt 03 demandait explicitement l’acceptation, la conversation atomique, la confirmation d’accord, les blocages et les agrégats avant leurs écrans prévus plus tard. La couche base est donc avancée et testée maintenant. Les phases 05 à 12 consommeront ces contrats sans les réinventer.

---

# ADR-0005 — Authentification réelle, onboarding reprenable et profil de phase 04

Statut : accepté et implémenté
Date : 2026-08-29

## Session et routage

Le navigateur configure Supabase uniquement depuis `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. L’URL est limitée à HTTPS, ou HTTP sur une adresse locale, et une clé `service_role` est explicitement refusée. Sans configuration publique valide, l’application affiche un état non configuré et ne fabrique aucune identité.

`AuthProvider` restaure d’abord `getSession()`, écoute ensuite `onAuthStateChange` et charge le profil réel. Les gardes séparent pages publiques réservées aux visiteurs, pages protégées et onboarding. Elles attendent la résolution de la session et du profil avant toute redirection, ce qui évite les boucles au rechargement.

## Onboarding et profil

`onboarding_drafts` porte uniquement l’état reprenable des neuf étapes pour son propriétaire. La finalisation passe par `save_profile`, qui vérifie `auth.uid()`, l’e-mail confirmé, la déclaration 18+, les capacités, le mode de travail, la zone approximative, les compétences et la disponibilité. Profil, compétences et créneau sont remplacés dans une même transaction, puis le brouillon est supprimé.

Un seul profil peut activer `can_work`, `can_hire` ou les deux. L’emplacement exact n’est pas collecté ; la ville et le pays approximatifs peuvent être masqués publiquement. Le badge « e-mail vérifié » est calculé depuis `auth.users.email_confirmed_at`. Les profils sans mission ni avis affichent un état neutre et ne reçoivent aucun score fictif.

`docs/PRODUCT_SPEC.md` ne prévoit pas de portfolio dans ce périmètre, il n’est donc pas ajouté. La suppression et l’export de compte restent absents tant que leur traitement, leur conservation et leurs effets sur les contenus partagés ne sont pas documentés ; aucune réussite simulée n’est affichée.

## Avatar

Le client accepte JPEG, PNG et WebP, refuse une entrée supérieure à 8 Mio, redimensionne à 1 024 px maximum et produit un WebP inférieur ou égal à 2 Mio. Le fichier est remplacé à l’adresse déterministe `<auth.uid()>/avatar.webp`. Les policies Storage limitent écriture, remplacement et suppression au répertoire du propriétaire.

## Validation

Les schémas Zod servent l’ergonomie et la RPC reste l’autorité. Les tests couvrent les validations, la restauration de session, les gardes, l’onboarding incomplet/complet, les deux capacités, l’échec d’avatar et la modification croisée refusée. Un scénario navigateur local confirme l’e-mail via Mailpit, termine l’onboarding à 320 px, recharge la session et relit les lignes persistées avec le client public.

---

# ADR-0006 — Missions transactionnelles et découverte agrégée de phase 05

Statut : accepté et implémenté
Date : 2026-08-30

## Écriture et reprise

Le wizard conserve ses étapes partielles dans `mission_drafts`, séparée de `missions` afin qu’une saisie incomplète ne soit jamais découvrable. La finalisation passe par `save_mission`, liée à `auth.uid()` : création ou mise à jour avec version optimiste, remplacement des compétences, déplacement des métadonnées de pièces jointes, suppression du brouillon et publication éventuelle forment une seule transaction.

Une mission complète impose dates cohérentes, budget informatif, 1 à 12 compétences et 1 à 10 livrables. Local exige une zone approximative ; hybrid ajoute les présences nécessaires ; remote force ville, région et pays à `null`. Les validations Zod améliorent le retour immédiat, mais triggers et RPC restent l’autorité.

## Lecture et recherche

`search_missions` est la projection autorisée unique des écrans de découverte et de détail. Elle sélectionne une page de champs publics, agrège compétences et profil client, calcule l’état de favori et ne retourne le compteur de candidatures qu’au propriétaire. Le frontend ne reconstruit pas ces relations par mission et évite ainsi les requêtes N+1.

La recherche texte utilise un index GIN, les filtres principaux ont des index B-tree et l’URL conserve les critères utiles. Aucun argument de distance n’existe. Un filtre de ville accepte toujours les missions remote ; aucun tri de proximité n’est présenté tant qu’une donnée géographique publique et une formule autorisée n’existent pas.

## Fichiers et confidentialité

Les fichiers de briefing appartiennent au bucket privé `mission-attachments`, avec un chemin préfixé par l’utilisateur, des types MIME bornés, une limite de 5 Mio et un maximum de trois lignes par mission ou brouillon. Ils restent réservés au propriétaire pendant cette phase et ne figurent pas dans la projection de découverte.

## Favoris et phasage

La table `favorites` existante est consommée dès la phase 05 parce que le prompt l’exige dans le parcours de découverte. La phase 10 est réduite aux notifications et à la comparaison. La policy interdit le favori de sa propre mission et garantit la persistance par compte.

## Vérification

Les tests pgTAP couvrent RLS, fonctions, transitions, filtres, agrégation, favoris, contenu interdit et absence de paramètre de distance. Un scénario Playwright local crée deux comptes confirmés, publie à 320 px, retrouve la mission depuis le second compte après rechargement, conserve le favori, prouve le refus de modification tierce et vérifie l’annulation.

---

# ADR-0007 — Candidatures, pertinence explicable et swipe secondaire de phase 06

Statut : accepté et implémenté
Date : 2026-08-30

## Autorité et cycle de candidature

Le rôle `authenticated` ne peut plus insérer directement dans `applications`. `submit_application` dérive le candidat de `auth.uid()`, exige une confirmation explicite, puis réutilise les contraintes et triggers serveur qui contrôlent profil talent complet, mission découvrable, échéance, quota, blocage, auto-candidature et unicité active. Le talent peut retirer une candidature ouverte avec `transition_application`; le propriétaire peut la marquer vue, la présélectionner ou la refuser avec version optimiste. L’acceptation reste exclusivement réservée au Prompt 07 et à l’RPC atomique déjà préparée.

`list_applications` est la projection paginée des écrans talent et client. Elle limite chaque ligne au candidat ou au propriétaire de la mission, agrège les compétences, la réputation, l’expérience, la conversation éventuelle et la décision de swipe sans requête N+1, et n’expose que les champs publics autorisés.

## Formule `relevance-v1`

PostgreSQL normalise chaque composante entre 0 et 1 et calcule :

    round(100 × (0,45 × compétences + 0,20 × disponibilité + 0,15 × mode/zone + 0,10 × budget informatif + 0,10 × réputation))

Les compétences sont pondérées par leur importance et le ratio niveau déclaré/niveau requis, plafonné à 1. La disponibilité est le meilleur recouvrement des dates. Remote évalue seulement la capacité remote et ne lit aucune distance ; local/hybrid utilisent ville et pays approximatifs, jamais l’adresse exacte. Le budget vaut 1 dans la fourchette, décroît proportionnellement hors fourchette et vaut 0,5 si la comparaison manque. La réputation est la moyenne des avis liés aux missions terminées divisée par 5 ; un profil sans avis vaut 0,5.

Le trigger d’insertion enregistre le score, la version, le détail des cinq composantes, les trois facteurs principaux, les données manquantes et les volumes de preuve. Le navigateur affiche cet instantané comme une pertinence d’aide au tri et ne le recalcule pas, ne le transforme pas en probabilité d’embauche et ne lit aucun attribut sensible.

## Swipe accessible et réversibilité

Le swipe reste une vue secondaire de données persistées. Côté talent, passer, enregistrer ou s’intéresser produit une décision `swipes`; enregistrer crée un favori et s’intéresser ouvre seulement le formulaire. Côté client, `application_swipes` ne peut viser qu’une candidature réellement reçue : passer ne refuse pas, comparer ne modifie pas le statut et présélectionner suit la machine à états. La base limite la comparaison à trois profils par mission.

Chaque geste possède un bouton visible et un raccourci clavier. Les mouvements respectent `prefers-reduced-motion`. L’annulation porte seulement sur la dernière décision passer/comparer encore réversible ; une présélection ou un refus nécessite le parcours explicite correspondant.

## Concurrence et tests

Les transitions et swipes client vérifient `lock_version`; une donnée périmée remonte un conflit et force le rechargement. Les tests pgTAP couvrent les scores exacts, remote/local, profil nouveau, données manquantes, confirmation, écriture directe, doublon, auto-candidature, tiers, retrait, concurrence, limite de comparaison, annulation et absence d’action automatique. Le parcours Playwright local complète ces preuves avec trois comptes réels, rechargements, boutons/clavier et viewport 320 px.

---

# ADR-0008 — Cycle de match couplé et timeline réelle de phase 07

Statut : accepté et implémenté
Date : 2026-08-30

## Décision

- `accept_application` reste l’unique transaction d’acceptation. Elle verrouille mission puis candidature, accepte un seul talent, clôt les autres candidatures ouvertes, crée un match, une conversation, exactement deux membres et la version initiale de l’accord.
- L’accord initial est un instantané du périmètre, des livrables, des dates et du budget informatif accepté. Sa mention zéro paiement est contrainte en base et affichée dans l’interface.
- `confirm_agreement` conserve deux confirmations indépendantes, horodatées et idempotentes. Un conflit de version renvoie `40001`.
- `start_match` est l’unique transition couplée de l’accord `confirmed` vers `active` et de la mission `assigned` vers `in_progress`.
- `submit_completion_confirmation` enregistre au plus une décision immuable par participant. `complete_match` exige deux confirmations conformes et clôt ensemble mission, match et accord.
- `cancel_match_mission` est réservé au client après assignation, exige un motif de 10 à 1 000 caractères et l’inscrit dans le journal partagé.
- Les notes d’avancement et livraisons sont des `mission_events` persistés. L’interface ne construit aucune timeline parallèle et ne montre aucune étape non atteinte.

## Conséquences

Les transitions historiques génériques restent compatibles avec les phases antérieures, mais des triggers empêchent désormais de démarrer, terminer ou annuler un match assigné en dehors des RPC couplées. TanStack Query ne fait que lire et invalider les projections `list_match_workspaces` et `get_match_workspace`. Les actions sensibles n’utilisent aucune mutation optimiste.

La conversation est créée et accessible depuis le suivi, mais son interface complète, le Realtime et une éventuelle négociation de versions ultérieures restent au Prompt 08.

---

# ADR-0009 — Messagerie idempotente, Realtime filtré et notifications réelles de phase 08

Statut : accepté et implémenté
Date : 2026-08-31

## Décision

- La conversation continue d’être créée uniquement par `accept_application`. Il n’existe ni annuaire de messages ni création publique de conversation.
- `send_message` est l’unique écriture de message exposée. Elle dérive l’auteur de `auth.uid()`, verrouille l’émetteur et la conversation, refuse match inactif et blocage, limite la cadence et déduplique avec `client_message_id`.
- Les messages sont chargés par curseur `(created_at, id)`. Le frontend fusionne le résultat serveur, l’envoi optimiste et Realtime par identifiants serveur/client ; un retry conserve le même identifiant.
- Realtime est publié uniquement sur `messages` et `notifications`. L’écran courant souscrit avec un filtre de conversation ou de destinataire, retire le canal au changement/démontage et garde PostgreSQL comme vérité avec un refetch périodique.
- Les fichiers restent dans le bucket privé `message-attachments`. Le navigateur et PostgreSQL vérifient type, taille, chemin propriétaire et nom sûr ; une URL signée courte est créée seulement pour un membre autorisé.
- Le blocage conserve l’historique mais refuse les écritures dans les deux sens en base. Le signalement cible le participant réel de la conversation et reste privé.
- Le centre de notifications lit uniquement des événements persistés. Les liens historiques sont normalisés vers les routes actuelles puis vérifiés contre l’appartenance à la ressource ; une URL arbitraire devient un repli interne sûr.

## Conséquences

Les écrans `/espace/messages`, `/espace/messages/:conversationId` et `/espace/notifications` consomment uniquement les RPC de phase 08 et les objets Storage autorisés. Les statuts `sending` et `failed` sont transitoires dans l’interface ; seul `sent` correspond à une ligne PostgreSQL. Les conversations terminées ou annulées restent lisibles mais n’acceptent plus de nouveaux messages. La négociation de versions ultérieures de l’accord n’est pas introduite : aucune exigence du Prompt 08 ne la demande et la version initiale confirmée n’est jamais réécrite.

---

# ADR-0010 — Avis contrôlés, réputation agrégée et activité hebdomadaire conditionnelle de phase 09

Statut : accepté et implémenté
Date : 2026-08-31

## Décision

- `submit_review` est l’unique écriture d’avis exposée. Elle dérive l’auteur et le destinataire depuis `auth.uid()` et le match verrouillé, exige mission et match `completed`, valide les quatre notes et crée au plus une notification liée à la source.
- L’insertion directe dans `reviews` est révoquée au rôle authentifié. La contrainte unique auteur/destinataire/mission reste une seconde défense contre les doublons.
- `list_review_opportunities` et `list_received_reviews` projettent uniquement les collaborations et identités publiques autorisées. La liste reçue est paginée.
- `get_reputation_summary` calcule moyenne, volume, distribution 1 à 5 et missions terminées distinctes. Zéro avis signifie « nouveau profil » et aucune note par défaut.
- `get_dashboard_overview` regroupe en une requête les capacités, lacunes du profil, candidatures, missions actives, accords à confirmer, non-lus, échéances et avis à laisser de l’utilisateur. `list_dashboard_deadlines` retourne seulement ses matches actifs.
- `get_weekly_ranking` utilise une fenêtre glissante de sept jours et compte les missions terminées distinctes par talent. La note n’influence pas le rang ; elle apparaît seulement comme contexte avec son volume. Sous trois missions terminées ou trois talents distincts, la fonction renvoie `sufficientData=false` et une liste vide.

## Conséquences

`/espace` devient le dashboard réel ; `/espace/avis` et `/espace/avis/:matchId` gèrent réputation, historique, prévisualisation et confirmation. TanStack Query invalide les domaines avis, dashboard et notifications après publication sans maintenir de compteur parallèle. Le « Top de la semaine » est explicitement un classement d’activité, jamais une mesure de qualité. Les snapshots et défenses anti-manipulation avancées restent un travail P2 de phase 12.

---

# ADR-0011 — QA reproductible et découpage du bundle de phase 11

Statut : accepté et implémenté
Date : 2026-09-01

## Décision

- `npm run verify` reste la chaîne rapide et déterministe : typecheck, lint, tests unitaires et build.
- `npm run verify:full` est son sur-ensemble local : reconstruction Supabase, pgTAP/RLS, concurrence, parcours multi-comptes, Realtime, modération et Playwright.
- Playwright utilise six projets Chromium de 320 × 720 à 1 920 × 1 080. Axe bloque les impacts critique et sérieux sur les routes principales ; les contrôles authentifiés restent dans les harnais locaux pour utiliser la vraie base.
- Les routes restent chargées paresseusement. Vite sépare en plus React, Supabase, les formulaires, TanStack Query et les primitives d’interface afin de conserver une entrée légère sans dupliquer les dépendances.
- Le rapport de référence est `docs/QA_REPORT.md`. Il distingue les succès, les skips intentionnels et les limites de préproduction au lieu de transformer les contrôles locaux en promesse de compatibilité universelle.

## Conséquences

La QA est rejouable avec une seule commande quand Docker et Supabase local sont disponibles, tandis que la boucle quotidienne conserve une commande courte. Les contrôles de navigateur réel ont conduit à rendre la cible du lien d’évitement focalisable et à retirer la largeur minimale globale qui débordait avec une barre de défilement classique. Firefox, WebKit, lecteurs d’écran physiques, délivrabilité e-mail externe et en-têtes Cloudflare réels restent des contrôles de préproduction documentés.

---

# ADR-0012 — Livraison statique et frontière cloud de phase 12

Statut : accepté et implémenté localement
Date : 2026-09-01

## Décision

Le frontend reste une SPA statique. Cloudflare Pages ne porte aucune logique métier et n’utilise ni Pages Function ni Worker : il sert uniquement `dist`, applique `_headers` et le fallback `_redirects`. Le navigateur dialogue directement avec les API publiques Supabase ; PostgreSQL, RLS, RPC, Auth, Storage et Realtime conservent toute l’autorité.

La configuration livrée au navigateur se limite à `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. La clé publishable est publique par conception ; aucune `service_role`, aucun mot de passe PostgreSQL, jeton fournisseur ou secret SMTP ne traverse Vite ou Cloudflare Pages.

## Sécurité de livraison

La CSP de production autorise les scripts et styles applicatifs depuis l’origine, les images et connexions depuis Supabase Cloud, et le WebSocket Supabase. Elle interdit cadres, objets et `unsafe-eval`. `style-src 'unsafe-inline'` reste nécessaire aux styles calculés des primitives d’interface ; aucun HTML utilisateur n’est injecté. HSTS, anti-frame, `nosniff`, COOP, Referrer-Policy et Permissions-Policy complètent la défense.

`deployment:check` s’exécute après le build et compare les fichiers source aux artefacts `dist`. Il ne remplace pas une inspection HTTP : l’émission des en-têtes, les redirections Auth et le Realtime doivent être testés sur une URL Pages de préproduction.

## Migrations et environnements

Le local utilise `supabase db reset` avec le seed « Démonstration ». Un projet distant reçoit seulement les migrations par `supabase db push --dry-run`, puis `supabase db push`. `--include-seed` et `db reset --linked` sont interdits sur un environnement contenant des données à conserver.

Les offres gratuites sont une contrainte d’exploitation : pause possible du projet Supabase, absence de sauvegarde automatique, SMTP intégré non adapté au public et quotas Realtime/Storage. Le produit conserve pagination, projections étroites, abonnements bornés et dégradation vers une erreur/retry, mais ne prétend pas fournir un SLA.

## État d’exécution

Aucun accès Cloudflare ou Supabase Cloud authentifié n’était disponible. La procédure, le build et les contrôles locaux sont validés ; la publication externe, l’URL, les e-mails externes et l’observation HTTP des en-têtes restent non exécutés. Cette limite empêche une qualification « prêt pour ouverture publique » sans invalider l’architecture livrée.
