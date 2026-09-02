# Audit factuel du prototype historique

Date de l’audit : 2026-08-18
Périmètre inspecté : toute l’arborescence de C:/Users/duran/Desktop/site
Méthode : inventaire des fichiers, lecture statique de HTML/CSS/JavaScript/CHANGELOG, recherches ciblées des routes, mutations, temporisations, données distantes et termes financiers. Aucune affirmation du CHANGELOG n’a été considérée comme preuve sans présence correspondante dans le code.

## 1. État du dossier et versionnement

Le dossier n’est pas un dépôt Git. La commande demandée a été exécutée depuis sa racine :

    git status --short --branch

Résultat exact :

    fatal: not a git repository (or any of the parent directories): .git

Conséquence : aucun diff, historique, branche ou fichier non suivi ne peut être établi. La phase 00 n’a modifié aucun fichier applicatif existant ; elle a uniquement ajouté AGENTS.md et les documents sous docs/.

## 2. Inventaire

| Zone          | Fichiers                                                                                                                  | Observation                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Racine        | index.html, CHANGELOG.md                                                                                                  | Point d’entrée statique et journal déclaratif                          |
| JavaScript    | app.js, utils.js, navigation.js, notifications.js, swipe.js, tracker.js, dashboard.js, top-week.js, wallet.js, profile.js | Scripts classiques chargés dans un ordre manuel, exposés via window    |
| CSS           | theme.css, style.css, animations.css, responsive.css                                                                      | Feuilles globales ; style.css avoisine 100 Ko et 3 400 lignes          |
| Assets locaux | assets/fonts/.gitkeep, assets/icons/.gitkeep                                                                              | Aucun actif local réel                                                 |
| Outillage     | aucun package.json, lockfile, tsconfig, config Vite, test ou CI                                                           | Aucun build, framework, gestionnaire de dépendances ou test automatisé |

Ordre de chargement : utils.js, app.js, puis les modules globaux. Cette dépendance implicite rend un changement d’ordre potentiellement cassant.

## 3. Architecture réellement présente

- Application monopage statique en HTML/CSS/JavaScript « vanilla ».
- Routage par fragment URL, via location.hash et une suite de conditions dans render().
- État métier central dans un objet JavaScript mutable en mémoire.
- Modules secondaires attachés à window.SkillMatch… et initialisés après chaque rendu s’ils trouvent leur point de montage.
- Rendu par longues chaînes HTML affectées à innerHTML.
- Aucun backend, aucune API, aucune authentification, aucune autorisation, aucune base de données et aucun temps réel réseau.
- Seul le choix du thème est lu et écrit dans localStorage sous la clé skillmatch-theme.

## 4. Routes et écrans actuels

| Fragment       | Écran réel              | Comportement observé                                                            |
| -------------- | ----------------------- | ------------------------------------------------------------------------------- |
| #accueil       | Landing / démonstration | Hero, métriques, capacités et aperçu téléphone codés en dur                     |
| #decouverte    | Serious Swipe           | Pile locale de six opportunités, gestes, clavier, undo et faux match            |
| #top-semaine   | Top de la semaine       | Classement de douze métiers codé en dur, filtrable ; faux chargement par timer  |
| #recherche     | Recherche               | Sept missions locales en mémoire, filtres client et faux skeleton temporisé     |
| #missions      | Mes missions            | Vue différente selon la capacité active, cartes, priorisation et tracker simulé |
| #candidatures  | Candidatures            | Jeu de données distinct pour chercheur/donneur, filtres et comparaison locale   |
| #publier       | Publier une mission     | Wizard client ; ajoute une mission à l’état mémoire après 800 ms                |
| #messages      | Messages                | Conversations en mémoire et réponse automatique après 800 ms                    |
| #notifications | Notifications           | Marquage « Vu » en mémoire                                                      |
| #wallet        | Wallet                  | Solde, retraits, transactions et faux paiement ; hors périmètre cible           |
| #profil        | Profil                  | Profil, badges, avis et portfolio entièrement codés en dur                      |
| #parametres    | Paramètres              | Thème persistant ; cases à cocher sans persistance ; faux contrat/paiement      |

La route #publier est surtout exposée au mode donneur et au menu mobile. Une route inconnue n’a pas de branche de repli : au chargement initial elle peut laisser le contenu vide tout en produisant un titre basé sur le fragment inconnu.

Il n’existe aucune route inscription, connexion, récupération de compte, onboarding, accord réel, détail de mission partageable, modération ou avis vérifié.

## 5. Fonctionnalités réellement actives

Les éléments suivants exécutent une logique locale réelle, mais ne prouvent aucun comportement serveur :

- navigation par hash, titre de page et focus du conteneur principal ;
- bascule chercheur/donneur pour adapter certains menus et contenus ;
- trois thèmes, dont le choix survit au rechargement via localStorage ;
- recherche, filtres, tri, comparaison et priorisation sur tableaux JavaScript ;
- création d’une annonce et d’une candidature dans l’objet state ;
- swipe souris/tactile, raccourcis clavier, compteurs, undo et mutation de tableaux ;
- ajout de conversation et notification lors d’un faux match ;
- envoi de message dans la conversation en mémoire ;
- marquage local d’une notification comme lue ;
- piège de focus et fermeture Échap pour la modale de candidature ;
- mise à jour ARIA de la progression du tracker et du rôle actif ;
- échappement HTML de nombreuses valeurs interpolées via escapeHtml.

Toutes ces modifications disparaissent au rechargement, à l’exception du thème.

## 6. Simulations, toasts, timers et mémoire navigateur

| Action affichée                                          | Réalité dans le prototype                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Recherche en cours                                       | setTimeout de 350 ms, aucune requête                                                       |
| Publication                                              | setTimeout de 800 ms, insertion dans deux tableaux mémoire                                 |
| Candidature                                              | setTimeout de 900 ms, insertion en mémoire puis fermeture après 2,4 s                      |
| Message reçu                                             | réponse fixe générée par setTimeout de 800 ms                                              |
| Top hebdomadaire                                         | données fixes et attente artificielle de 260 ms                                            |
| Tracker / ETA                                            | cinq étapes temporisées de 1,9 s, aucune géolocalisation                                   |
| Acceptation, présélection, refus, créneau, contrat, avis | pour la plupart un toast « action simulée », sans transition persistante                   |
| Match                                                    | seuil local fondé sur un pourcentage codé en dur ; crée mission et conversation en mémoire |
| Paiement / retrait / solde                               | simples additions ou soustractions dans state.balance et state.transactions                |
| Préférences                                              | le thème est persistant ; les autres cases n’ont pas de gestionnaire métier                |

Le libellé « Mise à jour enregistrée dans la démo » est trompeur : aucune persistance n’existe pour ces actions.

## 7. Données codées en dur

- Identité principale « Camille Duran », profil, photo, compétences, disponibilités, avis et badges.
- Missions disponibles et actives, candidats, candidatures, conversations, messages et notifications.
- Scores de compatibilité, réputation, taux d’annulation, rangs et budgets.
- Douze entrées de classement hebdomadaire et six opportunités de swipe.
- Métriques de landing, revenus, taux de paiement, XP, objectifs et planning.
- Toutes les photos, noms et organisations.
- États de contrat, paiement et clôture.

Aucune de ces données n’est marquée « Démonstration » de manière systématique. Des badges comme « Profil vérifié », « Identité vérifiée », « Assuré », « Certifiée » ou « Portfolio validé » sont affichés sans mécanisme de preuve. Cela contredit la règle cible qui n’autorise automatiquement que l’e-mail réellement vérifié.

## 8. Dépendances et actifs distants

- Google Fonts via fonts.googleapis.com et fonts.gstatic.com : Fraunces, IBM Plex Mono et Inter.
- Images servies depuis images.unsplash.com dans index.html, app.js, swipe.js et tracker.js.
- Aucune bibliothèque JavaScript externe et aucun package npm déclaré.
- Aucun actif local utilisable malgré les dossiers fonts et icons.

Le prototype dépend donc du réseau pour sa typographie et presque toutes ses images. Il n’a ni politique CSP, ni stratégie de repli explicite, ni contrôle de disponibilité de ces actifs. Les requêtes tierces exposent aussi des métadonnées réseau à ces fournisseurs.

## 9. Inventaire Wallet et paiements à supprimer lors de la reconstruction

La dette financière est transversale et ne se limite pas à wallet.js :

- route Wallet dans les menus desktop, mobile et latéraux ;
- script wallet.js, solde, retrait bancaire, transactions, factures, commission et PDF factices ;
- state.balance, state.transactions et notification de type wallet ;
- fonctions withdraw et pay-demo ;
- tracker « Terminée & payée » qui crédite 40 EUR ;
- landing promettant paiement sécurisé, paiement bloqué, paiements libérés et missions sécurisées ;
- métadonnée description de index.html mentionnant le paiement ;
- aperçu téléphone avec paiement bloqué ;
- paramètres « Notifications paiement » et « Contrat simulé » ;
- états et actions de candidatures « Paiement sécurisé », « paiement versé » et « détails du paiement » ;
- dashboard avec revenus et rappel d’acompte ;
- image payment et opportunité de swipe concernant un tunnel de paiement ; cette dernière peut rester comme secteur de travail ordinaire seulement si sa formulation ne fait pas croire que SkillMatch traite le paiement de la mission ;
- CHANGELOG valorisant Wallet et taux de paiement.

La reconstruction doit supprimer les composants, données, statuts, notifications, routes et textes financiers, pas seulement masquer la navigation.

## 10. Modules morts, dupliqués ou incohérents

- dashboard.js est chargé et son init() est appelé à chaque rendu, mais aucun écran ne crée #dashboardMount : le module retourne immédiatement et est actuellement mort.
- topState.error possède un rendu d’erreur et un bouton retry, mais aucune branche ne place error à true : état inaccessible.
- state.xp n’est pas consommé.
- img.candidatures est consulté alors que la propriété n’existe pas ; un fallback masque l’erreur de modèle.
- Les candidats existent dans state.candidates puis dans un second jeu de données construit dans initApplicationsRoleAware(). Les attributs et statuts divergent.
- Les statuts de candidatures et missions emploient plusieurs vocabulaires concurrents : « En attente », « Envoyée », « Accepté », « Acceptée », « Contrat prêt », « Contrat généré » et « Paiement sécurisé ».
- Les écrans missions, candidatures, dashboard et swipe recréent des concepts communs avec des formes d’objets différentes.
- Les actions métier sont partagées entre mutations réelles en mémoire et simples toasts sans contrat explicite.
- app.js avoisine 101 Ko et 1 700 lignes ; style.css avoisine 100 Ko et 3 400 lignes. Les longues chaînes HTML et styles inline compliquent le typage, la réutilisation et les tests.
- Les modules globaux sont couplés à l’ordre des scripts et à des sélecteurs DOM implicites.

## 11. Accessibilité

### Éléments positifs observés

- document en français, lien d’évitement, focus visible global et respect de prefers-reduced-motion ;
- noms accessibles sur plusieurs boutons icônes et champs de recherche ;
- annonces live sur toasts, recherche, chat et quelques listes ;
- modale de candidature avec role=dialog, aria-modal, titre lié, piège de focus, Échap et restitution du focus ;
- contrôles alternatifs au geste de swipe et raccourcis clavier ;
- progression du tracker exposée comme progressbar.

### Problèmes et risques

- Les modales de détail et de match du swipe n’ont ni focus initial, ni piège, ni fermeture Échap, ni restitution du focus ; le fond n’est pas rendu inerte.
- Le menu mobile déplace le focus à l’ouverture mais ne le piège pas ; sa fermeture par Tab hors du menu n’est pas gérée.
- Le tablist du classement n’attribue ni role=tab aux boutons, ni aria-selected, ni relation avec un tabpanel.
- Les erreurs du wizard publication ne mettent pas aria-invalid et ne relient pas chaque champ à son message d’erreur ; les étapes visuelles n’exposent pas leur état.
- De nombreux contenus dynamiques injectés et images n’ont pas de dimensions intrinsèques, ce qui favorise les changements de mise en page.
- Plusieurs indicateurs visuels, graphiques et scores reposent sur une présentation sans alternative textuelle complète.
- La fermeture ou le rerendu complet des vues peut provoquer des annonces live trop nombreuses et une perte de contexte.
- Les badges « vérifié » non fondés sont un problème de confiance et de compréhension, même si le balisage est lisible.

Les affirmations « WCAG AA » du CHANGELOG ne sont pas validées par une suite automatisée ni par un test manuel documenté.

## 12. Responsive

- Deux seuils principaux sont présents : 1180 px et 760 px, plus une plage tablette.
- Les colonnes, cartes mission, tableaux, planning, conversation et swipe reçoivent des adaptations dédiées.
- Les boutons de swipe passent à 52 px de haut sur mobile et plusieurs grilles se réduisent à une colonne.

Risques :

- malgré le commentaire « mobile-first », la feuille principale définit de nombreux layouts desktop ensuite corrigés par max-width ; l’architecture CSS est plutôt desktop-first avec surcharges ;
- hauteurs fixes ou minimales importantes pour téléphone, chat et swipe peuvent déborder sur petits écrans ou en paysage ;
- la navigation latérale reste une grille dense de raccourcis sur mobile ;
- overflow-x:hidden sur body peut masquer des débordements au lieu de les corriger ;
- aucun test visuel multi-viewport n’est présent.

## 13. Sécurité et confidentialité

### Ce qui existe

- Une fonction escapeHtml est appliquée à de nombreuses valeurs avant insertion HTML.
- Les saisies texte sont tronquées et débarrassées de balises avant d’être réaffichées.
- Aucun secret ou clé service_role n’a été trouvé.

### Ce qui manque ou reste dangereux

- Aucune authentification, autorisation, RLS, validation serveur, rate limiting, journal d’audit ou isolation entre utilisateurs.
- Toutes les règles de prix, longueur et statut sont contournables dans la console ; elles n’ont aucune autorité serveur.
- L’usage massif de innerHTML rend la sûreté dépendante d’un échappement manuel parfait. stripTags par expression régulière n’est pas une frontière de sécurité ; l’échappement à la sortie est la protection effective.
- Aucun contrôle d’âge, consentement, blocage, signalement, modération des missions interdites ou protection d’adresse précise.
- Aucune CSP, politique de permissions ou en-tête de sécurité n’est configuré dans ce dossier statique.
- Les conversations, avis et profils factices donnent l’illusion d’une confidentialité et d’une vérification inexistantes.
- Les tiers Google Fonts et Unsplash reçoivent les requêtes du navigateur.

## 14. Maintenabilité et testabilité

- Aucun TypeScript, schéma de données, contrat API, linter, formatteur, test, build reproductible ou CI.
- Les longues fonctions de rendu combinent présentation, règles métier, état et effets temporisés.
- Les événements globaux et rerendus par remplacement de innerHTML rendent les fuites, doubles liaisons et pertes de focus difficiles à prévenir.
- Les données de démonstration sont mêlées au code de production potentiel.
- Le CHANGELOG décrit une refonte « Sauge & Terracotta », alors que theme.css expose aujourd’hui trois thèmes dont le thème par défaut est vert neutre ; le journal n’est pas une description fiable de l’état actuel.

## 15. Conclusion de migration

Le prototype prouve quelques intentions d’interaction, mais il ne constitue pas une base à réparer écran par écran. La reconstruction doit préserver seulement les enseignements utiles : recherche filtrée, double capacité du compte, candidature guidée, explication du matching, conversation après acceptation et accessibilité de base.

La cible doit repartir sur l’architecture React/TypeScript/Supabase documentée, avec schémas cohérents, persistance, RLS et tests. La suppression totale du Wallet et des promesses de paiement est un préalable de la nouvelle interface.

## 16. Résultat final de la migration

Au 2026-09-01, le dépôt SkillMatch reconstruit ne charge aucun fichier du prototype historique situé dans `C:/Users/duran/Desktop/site`. Ce dossier externe est conservé tel quel comme archive d’observation et n’a pas été modifié ni supprimé pendant les phases 00 à 12.

Les concepts utiles ont été réimplémentés par domaine dans React et Supabase. Les tableaux en mémoire, réponses automatiques, délais simulés, faux compteurs, faux avis, badges non prouvés et routes fragmentaires ne sont pas présents dans le build cible. La recherche finale ne trouve aucune intégration Stripe/PayPal, aucun composant Wallet et aucune table, colonne ou RPC financière ; les seules occurrences de termes interdits dans le schéma sont des assertions négatives de test.

La migration est donc terminée fonctionnellement : le prototype ne participe ni au runtime, ni au seed, ni aux tests de production. Il reste volontairement hors du dépôt cible afin de préserver l’historique sans entretenir deux applications concurrentes.
