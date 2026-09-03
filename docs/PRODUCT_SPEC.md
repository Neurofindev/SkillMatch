# SkillMatch — spécification produit de référence

Statut : référence finale du MVP validé localement
Date : 2026-09-01
Langue produit : français

## 1. Vision

SkillMatch est une marketplace web de mise en relation entre des clients qui publient un besoin et des talents qui proposent leurs compétences. Le produit réduit le temps nécessaire pour trouver une collaboration pertinente, organiser la mission et conserver un historique fiable, sans intervenir dans le paiement.

Le prototype actuel illustre quelques interactions mais ne définit ni l’architecture, ni le design final, ni la vérité métier. La cible est une application professionnelle, mobile-first, persistante, sécurisée, accessible et fonctionnelle.

## 2. Principes non négociables

- Compte unique : une personne peut chercher des missions, en publier, ou faire les deux depuis la même identité.
- Zéro paiement : SkillMatch ne reçoit, ne conserve, ne garantit et ne transfère jamais d’argent.
- Le budget publié et le montant proposé sont purement informatifs.
- Aucun Wallet, solde, retrait, transaction, facture, commission, moyen bancaire, séquestre, Stripe ou PayPal.
- Coût fixe du petit MVP : 0 € sur les offres gratuites retenues.
- Matching déterministe et explicable, sans API d’intelligence artificielle.
- Utilisateurs déclarant avoir au moins 18 ans.
- Missions illégales, dangereuses, médicales, financières réglementées, frauduleuses, discriminatoires, abusives ou demandant des données sensibles interdites.
- Données réelles ou explicitement signalées comme « Démonstration ».
- Seul « e-mail vérifié » peut être automatique, après confirmation réelle de l’adresse.

## 3. Utilisateurs et capacités

### Client / donneur de mission

Il décrit un besoin, choisit le mode de mission, indique un budget informatif, reçoit des candidatures, présélectionne, accepte un talent, formalise un accord, échange, suit la réalisation, clôture et laisse un avis vérifié.

### Talent / prestataire

Il complète son profil et ses compétences, découvre des missions compatibles, candidate avec un message et éventuellement un montant informatif, peut échanger avec le client dès la candidature reçue, accepte l’accord s’il est retenu, réalise la mission, participe à la clôture et laisse un avis vérifié.

### Compte à double capacité

Un même compte peut publier et candidater. L’interface peut adapter ses raccourcis au contexte, mais les données de profil, la réputation, les blocages et les paramètres restent uniques.

## 4. Parcours principal P0

1. Inscription : création du compte, confirmation réelle de l’e-mail et déclaration d’âge minimum de 18 ans.
2. Onboarding : activation de « trouver une mission », « publier une mission », ou des deux ; acceptation des règles de sécurité.
3. Profil et compétences : identité publique minimale, présentation, compétences saisies librement avec niveau déclaratif, zone facultative selon les modes souhaités et disponibilités. La normalisation interne sert uniquement au matching et n’impose aucun catalogue prédéfini à l’utilisateur.
4. Publication ou découverte : le client publie une mission ; le talent cherche, filtre ou consulte des recommandations explicables.
5. Candidature : le talent envoie un message, ses disponibilités et, s’il le souhaite, un montant proposé purement informatif.
6. Présélection : le client compare les candidatures selon des critères utiles et non discriminatoires.
7. Acceptation : le client accepte une candidature ; les autres candidatures passent dans un état final explicite.
8. Conversation et match : dès la candidature envoyée et reçue, ses deux participants peuvent ouvrir une conversation privée unique. Si la candidature est acceptée, cette même conversation est rattachée au match sans perdre son historique.
9. Accord : les participants confirment le périmètre, le calendrier, le lieu ou mode, les responsabilités et les modalités de rémunération gérées hors SkillMatch.
10. Réalisation : les participants utilisent des jalons simples et des messages, sans suivi financier ni promesse de garantie.
11. Clôture : chaque participant confirme ou conteste la fin ; les désaccords peuvent être signalés.
12. Avis vérifié : après une mission acceptée et clôturée, chaque participant peut laisser au plus un avis sur l’autre. L’avis est relié à cette mission réelle.

### Mention obligatoire dans l’accord

“SkillMatch facilite la mise en relation et ne traite aucun paiement. Les modalités de rémunération sont gérées directement entre les participants.”

Cette phrase doit être visible avant confirmation et conservée dans l’instantané de l’accord.

## 5. Modes de mission

### Local

- La réalisation exige une présence dans une zone donnée.
- Le client fournit une zone suffisamment précise pour la découverte, sans exposer une adresse privée avant le match.
- La distance peut être un filtre et un facteur de classement, dans un rayon choisi par le talent.

### Remote

- La mission peut être réalisée entièrement à distance.
- Aucune adresse ni distance n’est requise pour candidater.
- Une mission remote ne doit jamais être exclue, déclassée ou pénalisée en raison de la distance géographique.
- Le composant distance est retiré du calcul et du dénominateur du score ; il n’est pas remplacé par une valeur défavorable implicite.

### Hybrid

- La mission combine travail à distance et présence ponctuelle.
- La publication précise la fréquence ou les dates de présence et une zone publique approximative.
- La distance peut influencer la compatibilité de la partie en présentiel seulement.

## 6. Matching déterministe

La formule `relevance-v1`, validée en phase 06, produit un score de pertinence sur 100 :

- compétences : 45 %, avec moyenne des niveaux déclarés/requis pondérée par l’importance de chaque compétence et plafonnée à 1 ;
- disponibilité : 20 %, selon le meilleur recouvrement déclaré avec les dates de la mission ;
- mode et zone approximative : 15 %, sans adresse exacte ni coordonnées ; remote utilise uniquement la capacité remote et n’utilise jamais la distance ;
- budget informatif : 10 %, neutre lorsque la proposition ou la fourchette manque, maximal dans la fourchette et proportionnel hors fourchette ;
- réputation vérifiable : 10 %, moyenne des avis reliés aux missions terminées, avec une valeur neutre de 0,5 en l’absence d’avis.

Chaque composante est normalisée entre 0 et 1. Une disponibilité absente, un budget non comparable, une zone approximative manquante ou un nouveau profil produit une valeur neutre documentée et une mention de donnée manquante, jamais une pénalité cachée. Le score est calculé et enregistré par PostgreSQL lors de la candidature ; le navigateur ne le recalcule pas.

Règles :

- critères, poids, version de formule et valeurs d’entrée sont enregistrables et testables ;
- un facteur non applicable est retiré du numérateur et du dénominateur ;
- remote exclut toujours la distance ;
- un utilisateur voit les composantes, deux ou trois facteurs principaux et les données manquantes ;
- aucune donnée sensible, aucun attribut protégé et aucune inférence opaque ne participe au score ;
- les filtres explicites de l’utilisateur priment sur le classement.

L’interface dit « Pertinence N/100 » et précise que le score aide au tri sans prédire une embauche. Elle ne le présente jamais comme une probabilité d’acceptation.

## 7. États métier P0

### Mission

draft → published → matched → in_progress → completion_pending → closed
Branches possibles : cancelled ou removed après modération.

### Candidature

submitted → viewed → shortlisted → accepted
Branches possibles : withdrawn, rejected ou expired.

Une mission ne peut avoir qu’une candidature acceptée dans le petit MVP. L’acceptation est transactionnelle et crée un match unique.

### Accord

draft → proposed → confirmed
Une modification après confirmation crée une nouvelle version à reconfirmer par les deux participants.

### Avis

Un avis n’est autorisé qu’après l’état `completed` de la mission et du match, par un participant envers l’autre, une fois par triplet auteur/destinataire/mission. La note globale et les critères communication, fiabilité et qualité sont des entiers de 1 à 5. La publication exige une prévisualisation et une confirmation, puis l’avis est immuable dans le petit MVP. « Vérifié » décrit uniquement le lien à une mission clôturée, pas une validation qualitative automatique.

## 8. Priorités

### P0 — MVP utilisable

- Inscription, vérification e-mail réelle, onboarding et compte à capacités multiples.
- Profil, compétences et disponibilités persistants.
- Publication, consultation, recherche et filtres des missions local/remote/hybrid.
- Candidature, présélection, acceptation transactionnelle et refus/retrait.
- Match, conversation privée persistante et Realtime, notifications issues
  d’événements réels, accord versionné avec mention obligatoire.
- Réalisation, clôture et avis vérifié.
- Sécurité, RLS, validation serveur, prévention des abus de base.
- Mobile-first, WCAG 2.2 AA visé, états asynchrones complets.
- Persistance Supabase et build prêt pour Cloudflare Pages Free ; publication externe soumise à la recette de préproduction.
- Suppression totale des paiements et contenus financiers.

### P1 — Confiance et productivité

- Favoris.
- Préférences sobres pour les notifications persistantes livrées en phase 08.
- Comparaison de candidatures.
- Blocage d’un utilisateur, livré avec autorité base et historique conservé.
- Signalement d’un profil, d’une mission, d’un message ou d’un avis, avec file de traitement minimale, rôle serveur et audit, livré en phase 10.

### P2 — Optimisation

- Socle du classement hebdomadaire calculé à partir des événements réels : activité sur sept jours, méthode publique, seuil de trois missions et trois talents et état « Données insuffisantes ».
- Les snapshots historiques, exclusions anti-manipulation avancées et toute lecture qualitative du classement sont reportés après le MVP, faute de besoin et d’échantillon validés.
- Améliorations secondaires validées par l’usage : filtres avancés, ergonomie, performance, observabilité respectueuse de la vie privée.

## 9. Exclusions

- Tout traitement ou garantie de paiement et tout composant financier.
- Facturation, commissions, abonnements, retraits, solde, portefeuille et coordonnées bancaires.
- API d’intelligence artificielle et matching opaque.
- Application native mobile dans le petit MVP.
- Domaine personnalisé ou service payant requis.
- Vérification automatique d’identité, de diplôme, d’assurance ou de compétence sans processus réel.
- Géolocalisation précise publique, suivi GPS temps réel ou collecte de données sensibles.
- Missions relevant d’activités interdites ou réglementées hors périmètre.
- Classement hebdomadaire fictif présenté comme réel.

## 10. Critères de succès P0

- Un nouvel utilisateur peut terminer le parcours principal sur mobile sans donnée perdue après rechargement.
- Un utilisateur non autorisé ne peut lire ni modifier une conversation, candidature, accord ou ressource privée via l’API.
- Une mission remote conserve le même score si seule la distance géographique change.
- Aucun texte, route, table, événement ou dépendance ne traite un paiement.
- Tout avis « vérifié » est rattaché à une mission clôturée et à deux participants réels.
- Les flux P0 disposent de tests automatisés aux niveaux appropriés.
- Le build statique contient le fallback SPA et les en-têtes de sécurité ; leur émission réelle doit être contrôlée sur Cloudflare Pages avant ouverture publique.

## 11. Hypothèses et risques produit

- Supabase Free et Cloudflare Pages Free conviennent à une expérimentation surveillée, mais leurs quotas et politiques peuvent évoluer ; le produit doit dégrader proprement et rester portable.
- Le SMTP intégré Supabase est réservé aux essais et ne permet pas une inscription publique fiable ; un SMTP externe et sa délivrabilité doivent être validés avant ouverture.
- La modération manuelle livrée ne passera pas à l’échelle ; elle empêche les catégories interdites évidentes, fournit blocage/signalement/audit, mais n’offre ni astreinte ni délai garanti.
- Les avis bilatéraux peuvent entraîner représailles et biais. Dans le petit MVP, ils sont publiés immédiatement après confirmation et ne sont pas modifiables ; la modération et une éventuelle publication différée restent à évaluer avant ouverture publique.
- Une adresse trop précise expose les utilisateurs ; la zone publique et l’adresse d’exécution doivent être séparées.
- Les budgets informatifs peuvent être interprétés comme une garantie ; la copie doit rappeler clairement le rôle limité de SkillMatch.
