(function () {
  "use strict";

  var U = window.SkillMatchUtils;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };

  var img = {
    student: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80",
    moving: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=80",
    garden: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80",
    babysit: "https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=900&q=80",
    tech: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    delivery: "https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=900&q=80",
    profile: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
    dashboard: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
    payment: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80",
    geo: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=900&q=80",
    rating: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
    bricolage: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80"
  };

  var state = {
    route: "accueil",
    role: "seeker",
    likes: 0,
    passes: 0,
    seen: 0,
    xp: 740,
    balance: 1840,
    searchLoading: false,
    applyStep: 0,
    publishStep: 0,
    notifications: [
      { id: 1, type: "match", title: "Match avec Emma L.", body: "Disponible aujourd'hui pour ton déménagement.", time: "il y a 2 min", unread: true },
      { id: 2, type: "wallet", title: "Paiement sécurisé", body: "40 EUR placés sous contrat SkillMatch.", time: "il y a 18 min", unread: true },
      { id: 3, type: "rating", title: "Nouvel avis 5 étoiles", body: "Léa a confirmé ta ponctualité.", time: "hier", unread: false }
    ],
    conversations: [
      {
        id: "emma", name: "Emma L.",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",
        last: "Super, je peux arriver à 18h.",
        messages: [
          ["them", "Bonjour ! J'ai vu la mission déménagement."],
          ["me", "Parfait. Tu es disponible vers 18h ?"],
          ["them", "Super, je peux arriver à 18h."]
        ]
      },
      {
        id: "karim", name: "Karim B.",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
        last: "J'apporte les outils.",
        messages: [
          ["them", "J'apporte les outils."],
          ["me", "Top, merci Karim."]
        ]
      }
    ],
    /* Missions actives de l'utilisateur (suivi) */
    missions: [
      { id: 1, title: "Montage de meubles", cat: "bricolage", person: "Karim B.", status: "En cours", price: 40, distance: 0.5, rating: 4.9, date: "Aujourd'hui", urgency: "Aujourd'hui", img: img.bricolage },
      { id: 2, title: "Aide au déménagement", cat: "demenagement", person: "Emma L.", status: "Contrat prêt", price: 45, distance: 1.2, rating: 4.8, date: "Demain", urgency: "Demain", img: img.moving },
      { id: 3, title: "Garde d'enfants - soirée", cat: "baby-sitting", person: "Maya R.", status: "À valider", price: 52, distance: 0.8, rating: 5, date: "Vendredi", urgency: "Vendredi", img: img.babysit }
    ],
    /* Annonces disponibles à postuler (catalogue recherche) */
    availableMissions: [
      { id: 101, title: "Montage armoire IKEA", cat: "bricolage", employer: "Sophie M.", price: 35, distance: 0.8, rating: 4.7, date: "Aujourd'hui", urgency: "Aujourd'hui", img: img.bricolage, description: "Montage d'une armoire PAX, outils fournis." },
      { id: 102, title: "Déménagement studio", cat: "demenagement", employer: "Lucas P.", price: 80, distance: 2.1, rating: 4.9, date: "Demain", urgency: "Demain", img: img.moving, description: "Aide pour charger et décharger un studio de 25 m²." },
      { id: 103, title: "Baby-sitting samedi soir", cat: "baby-sitting", employer: "Nadia K.", price: 45, distance: 1.5, rating: 5, date: "Samedi", urgency: "Samedi", img: img.babysit, description: "Garde de 2 enfants (5 et 8 ans), 19h-23h." },
      { id: 104, title: "Tonte pelouse", cat: "jardinage", employer: "Marc D.", price: 30, distance: 0.4, rating: 4.6, date: "Aujourd'hui", urgency: "Aujourd'hui", img: img.garden, description: "Petit jardin, tondeuse sur place." },
      { id: 105, title: "Installation box internet", cat: "informatique", employer: "Julie R.", price: 25, distance: 3.2, rating: 4.8, date: "Mercredi", urgency: "Mercredi", img: img.tech, description: "Aide branchement box et Wi-Fi." },
      { id: 106, title: "Livraison colis fragile", cat: "livraison", employer: "Antoine B.", price: 18, distance: 1.8, rating: 4.5, date: "Aujourd'hui", urgency: "Aujourd'hui", img: img.delivery, description: "Trajet centre-ville, vélo cargo préféré." },
      { id: 107, title: "Cours de maths - lycée", cat: "cours", employer: "Isabelle F.", price: 28, distance: 2.5, rating: 4.9, date: "Jeudi", urgency: "Jeudi", img: img.student, description: "Soutien terminale, 1h30 à domicile." }
    ],
    applications: [
      { missionId: 101, title: "Montage armoire IKEA", status: "En attente", date: "2 juil." }
    ],
    candidates: [
      { name: "Nino P.", age: 28, distance: "0,5 km", rating: 4.7, missions: 86, price: "40 EUR", time: "2 h", availability: "Ce soir", skills: ["Montage", "Outillage", "IKEA"], badges: ["Vérifié", "Top 8%"], photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80" },
      { name: "Léa M.", age: 22, distance: "2,4 km", rating: 4.9, missions: 132, price: "30 EUR", time: "2 h", availability: "Maintenant", skills: ["Jardinage", "Terrasse", "Entretien"], badges: ["Rapide", "5 étoiles"], photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80" },
      { name: "Thomas R.", age: 31, distance: "3,1 km", rating: 4.8, missions: 204, price: "80 EUR", time: "Journée", availability: "Demain", skills: ["Livraison", "Vélo cargo", "Fragile"], badges: ["Assuré", "Pro"], photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80" },
      { name: "Sara D.", age: 26, distance: "1,7 km", rating: 5, missions: 64, price: "25 EUR/h", time: "1 h", availability: "Mercredi", skills: ["Maths", "Lycée", "Pédagogie"], badges: ["Certifiée", "Patiente"], photo: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80" }
    ],
    transactions: [
      { label: "Mission montage", amount: +40, time: "Aujourd'hui", type: "credit" },
      { label: "Retrait bancaire", amount: -220, time: "Hier", type: "debit" },
      { label: "Baby-sitting", amount: +52, time: "28 juin", type: "credit" },
      { label: "Facture SM-1042", amount: -6, time: "27 juin", type: "fee" }
    ],
    pendingApply: null
  };

  var labels = {
    accueil: "Accueil", decouverte: "Découverte", recherche: "Recherche",
    messages: "Messages", notifications: "Notifications", profil: "Profil",
    wallet: "Wallet", missions: "Mes missions", candidatures: "Mes candidatures",
    parametres: "Paramétres", publier: "Publier une mission"
  };

  function esc(s) { return U.escapeHtml(s); }

  function money(n) {
    return (n < 0 ? "-" : "+") + Math.abs(n).toLocaleString("fr-FR") + " EUR";
  }

  function toast(title, body, type) {
    var stack = $("#toastStack");
    if (!stack) return;
    var el = document.createElement("div");
    el.className = "toast" + (type === "success" ? " toast--success" : type === "error" ? " toast--error" : "");
    el.innerHTML = "<b>" + esc(title) + "</b><small>" + esc(body || "") + "</small>";
    stack.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("is-visible"); });
    setTimeout(function () {
      el.classList.remove("is-visible");
      setTimeout(function () { el.remove(); }, 350);
    }, 3600);
  }

  function addNotification(title, body, type) {
    state.notifications.unshift({
      id: Date.now(), type: type || "info", title: title, body: body,
      time: "à l'instant", unread: true
    });
    window.SkillMatch.renderNotificationBadge();
  }

  function shell(title, subtitle, content, actions) {
    var sideRoutes = state.role === "provider"
      ? ["accueil", "publier", "missions", "messages", "notifications", "wallet", "profil", "parametres"]
      : ["accueil", "decouverte", "recherche", "candidatures", "messages", "notifications", "wallet", "profil", "parametres"];

    var sideNav = sideRoutes.map(function (r) {
      return '<button data-route="' + r + '" class="' + (state.route === r ? "is-active" : "") + '" aria-current="' + (state.route === r ? "page" : "false") + '"><span>' + labels[r] + '</span><span aria-hidden="true">›</span></button>';
    }).join("");

    var actionBtns = actions || '<button class="btn btn--accent" data-action="quick-match">Lancer un match</button>';
    if (state.role === "provider") {
      actionBtns = '<button class="btn btn--accent" data-route="publier">Publier une mission</button>';
    }

    return '<section class="app-layout"><aside class="side-panel app-card" aria-label="Sections application">' + sideNav +
      '</aside><div class="workspace"><div class="toolbar"><div><h1>' + esc(title) + '</h1><p>' + esc(subtitle) + '</p></div><div class="toolbar__actions">' + actionBtns + '</div></div>' + content + '</div></section>';
  }

  function home() {
    var seekerCta = state.role === "seeker"
      ? '<button class="btn btn--accent" data-route="decouverte">Essayer Serious Swipe</button><button class="btn btn--ghost" data-route="recherche">Explorer les missions</button>'
      : '<button class="btn btn--accent" data-route="publier">Publier une mission</button><button class="btn btn--ghost" data-route="missions">Voir mes annonces</button>';

    return '<section class="hero" aria-label="Présentation de SkillMatch"><div><div class="hero__eyebrow tag"><span class="dot"></span> Démo interactive SkillMatch</div><h1>Ta prochaine mission,<br>à un <span class="rot" id="heroRot">swipe</span> près.</h1><p class="hero__copy">SkillMatch associe la simplicité d\'une appli de rencontre à la rigueur d\'un outil pro : contractualisation, paiement, réputation, suivi en temps réel.</p><div class="hero__cta">' + seekerCta + '</div></div><div class="phone-demo"><div class="phone-demo__screen" id="phonePreview" aria-label="Aperçu application"></div></div></section>' +
      '<section class="section"><div class="container"><div class="section-head reveal"><h2>Tout pour trouver,<br>réaliser et sécuriser une mission.</h2><p>Une application simulée de bout en bout : matching, contrat, paiement, suivi live, réputation et portefeuille.</p></div><div class="grid grid--3">' + capabilities().join("") + '</div></div></section>' +
      '<section class="section" style="background:var(--bg-alt)"><div class="container"><div class="grid grid--4">' + metric("1 284", "missions sécurisées") + metric("4,92", "note moyenne") + metric("8 min", "temps de match") + metric("98%", "paiements libérés") + '</div></div></section>';
  }

  function capabilities() {
    return [
      ["Serious Swipe", "Des cartes riches, rapides, utiles.", img.student, "decouverte"],
      ["Tracker live", "ETA, timeline et carte simulée.", img.geo, "missions"],
      ["Wallet intégré", "Solde, factures, retraits et paiement.", img.payment, "wallet"],
      ["Dashboard", "Revenus, XP, badges, objectifs.", img.dashboard, "candidatures"],
      ["Réputation", "Avis, notes, historique et preuves.", img.rating, "profil"],
      ["Recherche instantanée", "Filtres par distance, prix, note et urgence.", img.tech, "recherche"]
    ].map(function (c) {
      return '<article class="cap-card app-card app-card--hover reveal"><img loading="lazy" src="' + c[2] + '" alt="' + esc(c[0]) + '"><div class="tag"><span class="dot"></span>' + esc(c[0]) + '</div><div><h3>' + esc(c[0]) + '</h3><p>' + esc(c[1]) + '</p><button class="btn btn--ghost btn--sm" data-route="' + c[3] + '">Ouvrir</button></div></article>';
    });
  }

  function metric(a, b) {
    return '<article class="metric app-card reveal"><b>' + esc(a) + '</b><span>' + esc(b) + '</span></article>';
  }

  function phonePreview() {
    var m = state.availableMissions[0];
    return '<div class="row"><span class="mission-card__icon ' + U.catClass(m.cat) + '" aria-hidden="true">' + U.catIcon(m.cat) + '</span><div class="row__main"><strong>' + esc(m.title) + '</strong><p>' + esc(m.distance + " km · " + m.price + " EUR") + '</p></div><span class="row__meta">' + m.rating + '</span></div>' +
      '<div id="miniChart" class="chart" aria-hidden="true">' + [55, 78, 42, 90, 64, 88].map(function (h) { return '<i class="bar" style="--h:' + h + '%"></i>'; }).join("") + '</div>' +
      '<div class="row"><div class="row__main"><strong>Contrat actif</strong><p>Paiement bloqué jusqu\'\u00e0 validation.</p></div><span class="row__meta">40 EUR</span></div>' +
      '<button class="btn btn--accent" data-route="recherche">Voir les missions</button>';
  }

  function searchView() {
    return shell("Recherche", "Trouve une mission près de chez toi en quelques secondes.",
      '<div class="filters app-card panel" role="search" aria-label="Filtres de recherche">' +
      '<input class="input" id="searchQ" placeholder="Baby-sitting, déménagement, cours de maths…" aria-label="Rechercher une mission">' +
      '<select class="select" id="filterCat" aria-label="Filtrer par catégorie"><option value="">Catégorie</option><option value="bricolage">Bricolage</option><option value="demenagement">Déménagement</option><option value="baby-sitting">Baby-sitting</option><option value="jardinage">Jardinage</option><option value="informatique">Informatique</option><option value="livraison">Livraison</option><option value="cours">Cours</option></select>' +
      '<select class="select" id="filterDist" aria-label="Filtrer par distance"><option value="9">Distance</option><option value="1">≤ 1 km</option><option value="3">≤ 3 km</option><option value="5">≤ 5 km</option></select>' +
      '<select class="select" id="filterPrice" aria-label="Filtrer par prix"><option value="999">Prix max</option><option value="30">≤ 30 EUR</option><option value="45">≤ 45 EUR</option><option value="60">≤ 60 EUR</option><option value="100">≤ 100 EUR</option></select>' +
      '<select class="select" id="filterRating" aria-label="Filtrer par note"><option value="0">Note min</option><option value="4.5">4,5+</option><option value="4.8">4,8+</option><option value="5">5,0</option></select>' +
      '<select class="select" id="filterUrgency" aria-label="Filtrer par urgence"><option value="">Urgence</option><option value="Aujourd\'hui">Aujourd\'hui</option><option value="Demain">Demain</option><option value="Samedi">Ce week-end</option></select>' +
      '</div><div class="search-meta"><span id="searchCount" aria-live="polite"></span><button class="btn btn--ghost btn--sm" id="resetFilters" type="button">Réinitialiser</button></div><div class="list" id="searchResults" aria-live="polite"></div>');
  }

  function missionsView() {
    var subtitle = state.role === "provider"
      ? "Gère tes annonces et les candidatures reçues."
      : "Accepte, refuse, signe, termine ou annule chaque mission.";
    var listContent = state.role === "provider" ? renderProviderMissions() : '<div class="list" id="missionList"></div>';
    return shell("Mes missions", subtitle,
      '<div class="grid grid--2">' + listContent +
      '<div class="app-card panel"><h2>Tracker live</h2><p class="muted">Localisation simulée, ETA et progression de mission.</p><div id="trackerMount"></div></div></div>');
  }

  function renderProviderMissions() {
    if (!state.missions.length) {
      return emptyState("📋", "Aucune annonce publiée", "Publie ta première mission en moins de 2 minutes.", "publier", "Publier une mission");
    }
    return '<div class="list" id="missionList">' + state.missions.map(function (m) {
      return missionCard(m, "provider");
    }).join("") + '</div><div class="app-card panel" style="margin-top:18px"><h2>Candidatures reçues</h2><div class="list" id="candidatesList">' +
      state.candidates.slice(0, 2).map(function (c) {
        return '<article class="row app-card--hover"><img src="' + c.photo + '" alt="Photo de ' + esc(c.name) + '"><div class="row__main"><strong>' + esc(c.name) + '</strong><p>' + esc(c.skills.join(", ")) + ' · ' + esc(c.price) + '</p></div><span class="badge-status">' + c.rating + ' ★</span><button class="btn btn--accent btn--sm" data-action="accept-candidate" data-name="' + esc(c.name) + '">Accepter</button></article>';
      }).join("") + '</div></div>';
  }

  function candidaturesView() {
    return shell("Mes candidatures", "Suis l'état de tes postulations en un coup d'oeil.",
      '<div id="applicationsMount"></div><div id="dashboardMount" style="margin-top:24px"></div>');
  }

  function publishView() {
    return shell("Publier une mission", "Décris ton besoin en 2 étapes — c'est rapide et sans jargon.",
      '<div class="publish-wizard app-card panel" id="publishWizard">' +
      '<div class="modal__steps" aria-label="Progression"><div class="modal__step is-active" id="pubStep0"></div><div class="modal__step" id="pubStep1"></div><div class="modal__step" id="pubStep2"></div></div>' +
      '<div class="step-panel is-active" id="publishStep0"><div class="form-group"><label for="pubTitle">Titre de la mission</label><input class="input" id="pubTitle" maxlength="80" placeholder="Ex. Montage de meuble, garde d\'enfants…" required><p class="field-error" id="errTitle" hidden></p></div><div class="form-group"><label for="pubCat">Catégorie</label><select class="select" id="pubCat" required><option value="">Choisir…</option><option value="bricolage">Bricolage</option><option value="demenagement">Déménagement</option><option value="baby-sitting">Baby-sitting</option><option value="jardinage">Jardinage</option><option value="informatique">Informatique</option><option value="livraison">Livraison</option><option value="cours">Cours / Soutien</option></select></div><div class="form-row"><div class="form-group"><label for="pubPrice">Rémunération (EUR)</label><input class="input" id="pubPrice" type="number" min="5" max="9999" placeholder="40" required><p class="field-error" id="errPrice" hidden></p></div><div class="form-group"><label for="pubUrgency">Quand ?</label><select class="select" id="pubUrgency"><option value="Aujourd\'hui">Aujourd\'hui</option><option value="Demain">Demain</option><option value="Cette semaine">Cette semaine</option></select></div></div></div>' +
      '<div class="step-panel" id="publishStep1"><div class="form-group"><label for="pubDesc">Description</label><textarea id="pubDesc" maxlength="500" placeholder="Décrivez le besoin, le matériel disponible, la durée estimée…" aria-describedby="pubDescHint"></textarea><p class="muted" id="pubDescHint">500 caractères max.</p><p class="field-error" id="errDesc" hidden></p></div></div>' +
      '<div class="step-panel" id="publishStep2"><div class="success-panel" id="publishSuccess" hidden><div class="success-check" aria-hidden="true">✓</div><h3>Mission publiée !</h3><p class="muted">Votre annonce est visible dans la recherche. Les candidatures arriveront ici.</p></div><div id="publishPreview"></div></div>' +
      '<div class="modal__footer"><button class="btn btn--ghost" id="pubPrev" type="button" hidden>Retour</button><button class="btn btn--accent" id="pubNext" type="button">Continuer</button></div></div>');
  }

  function messagesView() {
    return shell("Messages", "Conversations créées automatiquement après un match.",
      '<div class="conversation"><div class="conversation-list app-card" id="conversationList" role="listbox" aria-label="Conversations"></div><div class="chat app-card"><div class="chat-log" id="chatLog" role="log" aria-live="polite"></div><form class="chat-form" id="chatForm"><input class="input" id="chatInput" placeholder="Écrire un message…" aria-label="Message" maxlength="500"><button class="btn btn--accent" type="submit">Envoyer</button></form></div></div>');
  }

  function notificationsView() {
    return shell("Notifications", "Tout ce qui demande une décision, sans bruit.", '<div class="list" id="notificationCenter"></div>');
  }

  function settingsView() {
    return shell("Paramétrs", "Contrôle ton expérience SkillMatch.",
      '<div class="grid grid--2"><div class="app-card panel"><h2>Préférences</h2><div class="list">' +
      '<label class="row"><span class="row__main"><strong>Mode mission urgente</strong><p>Priorise les demandes proches.</p></span><input type="checkbox" checked aria-label="Mode mission urgente"></label>' +
      '<label class="row"><span class="row__main"><strong>Notifications paiement</strong><p>Alerte dès qu\'une transaction bouge.</p></span><input type="checkbox" checked aria-label="Notifications paiement"></label>' +
      '<label class="row"><span class="row__main"><strong>Disponibilité publique</strong><p>Ton profil apparaît dans Serious Swipe.</p></span><input type="checkbox" aria-label="Disponibilité publique"></label>' +
      '</div></div><div class="app-card panel"><h2>Contrat simulé</h2><p class="muted">Signature, validation et paiement sécurisé.</p><button class="btn btn--accent" data-action="sign-contract">Signer le contrat</button></div></div>');
  }

  function emptyState(icon, title, text, route, btnLabel) {
    return '<div class="empty-state app-card panel"><div class="empty-state__icon" aria-hidden="true">' + icon + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (route ? '<button class="btn btn--accent" data-route="' + route + '">' + esc(btnLabel) + '</button>' : '') + '</div>';
  }

  function missionCard(m, mode) {
    var applied = state.applications.some(function (a) { return a.missionId === m.id; });
    var actions = mode === "provider"
      ? '<button class="btn btn--ghost btn--sm" data-action="details" data-id="' + m.id + '">Détails</button><button class="btn btn--danger btn--sm" data-action="decline" data-id="' + m.id + '">Clôturer</button>'
      : (applied
        ? '<span class="badge-status badge-status--pending">Candidature envoyée</span>'
        : '<button class="btn btn--accent btn--sm" data-action="apply-mission" data-id="' + m.id + '">Postuler</button>') +
      '<button class="btn btn--ghost btn--sm" data-action="details" data-id="' + m.id + '">Détails</button>';

    if (mode === "seeker-active") {
      actions = '<button class="btn btn--accent btn--sm" data-action="accept-mission" data-id="' + m.id + '">Accepter</button><button class="btn btn--ghost btn--sm" data-action="details" data-id="' + m.id + '">Détails</button><button class="btn btn--danger btn--sm" data-action="decline" data-id="' + m.id + '">Refuser</button>';
    }

    return '<article class="mission-card app-card app-card--hover panel" data-mission-id="' + m.id + '">' +
      '<img loading="lazy" src="' + m.img + '" alt="' + esc(m.title) + '">' +
      '<div><div class="chips"><span class="mission-card__icon ' + U.catClass(m.cat) + '" aria-hidden="true">' + U.catIcon(m.cat) + '</span><span class="chip">' + esc(m.cat) + '</span><span class="chip">' + m.distance + ' km</span><span class="chip">' + m.rating + ' ★</span></div>' +
      '<h3>' + esc(m.title) + '</h3><p class="muted">' + esc((m.employer || m.person) + " · " + m.date + (m.status ? " · " + m.status : "")) + '</p></div>' +
      '<div class="mission-actions"><span class="mission-card__price">' + m.price + ' EUR</span>' + actions + '</div></article>';
  }

  function applyModalHtml(m) {
    return '<div class="modal is-open" id="applyModal" role="dialog" aria-modal="true" aria-labelledby="applyTitle"><div class="app-card modal__card">' +
      '<div class="modal__steps" aria-label="Étapes candidature"><div class="modal__step is-active" id="applyStep0"></div><div class="modal__step" id="applyStep1"></div><div class="modal__step" id="applyStep2"></div></div>' +
      '<div id="applyContent"><h2 id="applyTitle">Postuler — ' + esc(m.title) + '</h2><p class="muted" style="margin-bottom:16px">' + esc(m.employer) + ' · ' + m.price + ' EUR · ' + m.distance + ' km</p>' +
      '<div class="form-group"><label for="applyMsg">Message court (optionnel)</label><textarea id="applyMsg" maxlength="300" placeholder="Bonjour, je suis disponible et j\'ai l\'expérience pour cette mission…"></textarea></div></div>' +
      '<div id="applySuccess" class="success-panel" hidden><div class="success-check" aria-hidden="true">✓</div><h3>Candidature envoyée !</h3><p class="muted">' + esc(m.employer) + ' recevra votre message sous peu.</p></div>' +
      '<div class="modal__footer"><button class="btn btn--ghost" id="applyCancel" type="button">Annuler</button><button class="btn btn--accent" id="applySubmit" type="button">Envoyer ma candidature</button></div></div></div>';
  }

  function render() {
    var app = $("#app");
    var route = state.route;

    if (route === "accueil") app.innerHTML = home();
    else if (route === "decouverte") app.innerHTML = shell("Découverte", "Vois-le à l'ouvre, pas sur un PowerPoint.", '<div id="swipeMount"></div>');
    else if (route === "recherche") app.innerHTML = searchView();
    else if (route === "missions") app.innerHTML = missionsView();
    else if (route === "candidatures") app.innerHTML = candidaturesView();
    else if (route === "publier") app.innerHTML = publishView();
    else if (route === "messages") app.innerHTML = messagesView();
    else if (route === "notifications") app.innerHTML = notificationsView();
    else if (route === "wallet") app.innerHTML = shell("Wallet", "Solde, paiements, transactions et factures.", '<div id="walletMount"></div>');
    else if (route === "profil") app.innerHTML = shell("Profil", "Un profil complet, crédible et actionnable.", '<div id="profileMount"></div>');
    else if (route === "parametres") app.innerHTML = settingsView();

    document.title = "SkillMatch — " + (labels[route] || route);
    app.focus({ preventScroll: true });
    bootView();
  }

  function bootView() {
    $$("[data-route]", document.querySelector(".nav-link, .side-panel") || document).forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.route === state.route);
    });
    $$(".role-switch button").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.role === state.role);
    });
    reveal();

    if ($("#phonePreview")) $("#phonePreview").innerHTML = phonePreview();
    if (window.SkillMatchSwipe) window.SkillMatchSwipe.init();
    if (window.SkillMatchTracker) window.SkillMatchTracker.init();
    if (window.SkillMatchDashboard) window.SkillMatchDashboard.init();
    if (window.SkillMatchWallet) window.SkillMatchWallet.init();
    if (window.SkillMatchProfile) window.SkillMatchProfile.init();
    if (window.SkillMatchNotifications) window.SkillMatchNotifications.init();

    if (state.route === "recherche") initSearch();
    if (state.route === "missions" && state.role !== "provider") renderMissions();
    if (state.route === "messages") initMessages();
    if (state.route === "candidatures") initApplications();
    if (state.route === "publier") initPublish();

    bindActions();
  }

  function bindActions() {
    $$("[data-action]").forEach(function (el) {
      if (el.dataset.smBound) return;
      el.dataset.smBound = "1";
      el.addEventListener("click", function () { handleAction(el.dataset.action, el); });
    });
    $$(".role-switch button").forEach(function (btn) {
      if (btn.dataset.smBound) return;
      btn.dataset.smBound = "1";
      btn.addEventListener("click", function () {
        state.role = btn.dataset.role;
        toast("Profil " + (state.role === "seeker" ? "chercheur" : "donneur") + " activé", "Navigation adaptée à votre usage.");
        render();
      });
    });
  }

  function handleAction(action, el) {
    if (action === "quick-match") window.SkillMatch.navigate("decouverte");
    if (action === "attach") toast("Pièce jointe ajoutée", "Le contrat PDF simulé est prêt à envoyer.");
    if (action === "sign-contract") {
      toast("Contrat signé", "Paiement sécurisé et mission ajoutée au suivi.", "success");
      addNotification("Contrat validé", "La mission peut démarrer.", "contract");
    }
    if (action === "withdraw") {
      var amt = Number(el.dataset.amount || 120);
      if (state.balance < amt) { toast("Solde insuffisant", "Vérifiez votre solde disponible.", "error"); return; }
      state.balance -= amt;
      toast("Retrait simulé", "Le solde Wallet a été mis à jour.", "success");
      render();
    }
    if (action === "accept-mission") {
      toast("Mission acceptée", "Contrat généré, paiement bloqué et tracker prêt.", "success");
      addNotification("Mission acceptée", "Le contrat SkillMatch attend signature.", "mission");
    }
    if (action === "accept-candidate") {
      toast("Candidature acceptée", esc(el.dataset.name) + " rejoint la mission.", "success");
      addNotification("Candidat accepté", el.dataset.name + " a été retenu.", "match");
    }
    if (action === "details") {
      var id = Number(el.dataset.id);
      var m = state.availableMissions.find(function (x) { return x.id === id; }) || state.missions.find(function (x) { return x.id === id; });
      if (m) toast(m.title, m.description || (m.person || m.employer) + " · " + m.price + " EUR");
      else toast("Détails ouverts", "Contrat, profil, paiement et historique visibles dans la démo.");
    }
    if (action === "decline") {
      var mid = Number(el.dataset.id);
      state.missions = state.missions.filter(function (m) { return m.id !== mid; });
      toast("Mission clôturée", "L'annonce a été retirée.", "success");
      render();
    }
    if (action === "pay-demo") {
      state.balance += 75;
      state.transactions.unshift({ label: "Paiement simulé", amount: +75, time: "à l'instant", type: "credit" });
      toast("Paiement simulé", "75 EUR ajoutés au Wallet.", "success");
      render();
    }
    if (action === "apply-mission") openApplyModal(Number(el.dataset.id));
  }

  function openApplyModal(missionId) {
    var m = state.availableMissions.find(function (x) { return x.id === missionId; });
    if (!m) return;
    if (state.applications.some(function (a) { return a.missionId === missionId; })) {
      toast("Déjà postulé", "Vous avez déjà candidaté à cette mission.", "error");
      return;
    }
    state.pendingApply = m;
    var wrap = document.createElement("div");
    wrap.innerHTML = applyModalHtml(m);
    document.body.appendChild(wrap.firstElementChild);

    var modal = $("#applyModal");
    $("#applyCancel").onclick = closeApplyModal;
    modal.addEventListener("click", function (e) { if (e.target === modal) closeApplyModal(); });
    $("#applySubmit").onclick = submitApplication;
    document.addEventListener("keydown", applyEscHandler);
  }

  function applyEscHandler(e) {
    if (e.key === "Escape") closeApplyModal();
  }

  function closeApplyModal() {
    var modal = $("#applyModal");
    if (modal) modal.remove();
    state.pendingApply = null;
    document.removeEventListener("keydown", applyEscHandler);
  }

  function submitApplication() {
    var m = state.pendingApply;
    if (!m) return;
    var btn = $("#applySubmit");
    btn.classList.add("is-loading");
    btn.disabled = true;

    setTimeout(function () {
      var msg = U.sanitizeText($("#applyMsg").value, 300);
      state.applications.unshift({
        missionId: m.id, title: m.title, status: "En attente", date: "à l'instant", message: msg
      });
      addNotification("Candidature envoyée", m.title + " — en attente de réponse.", "mission");
      $("#applyContent").hidden = true;
      $("#applySuccess").hidden = false;
      btn.hidden = true;
      $("#applyCancel").textContent = "Fermer";
      toast("Candidature envoyée", "Bonne chance !", "success");
      setTimeout(closeApplyModal, 2200);
    }, 900);
  }

  function initSearch() {
    var ids = ["searchQ", "filterCat", "filterDist", "filterPrice", "filterRating", "filterUrgency"];
    var debounceTimer;

    var container = $("#searchResults");
    var countEl = $("#searchCount");

    if (!container.dataset.bound) {
      container.dataset.bound = "1";
      container.addEventListener("click", function (e) {
        var el = e.target.closest("[data-action]");
        if (!el || !container.contains(el)) return;
        handleAction(el.dataset.action, el);
      });
    }

    function draw() {
      var q = U.sanitizeText($("#searchQ").value).toLowerCase();
      var cat = $("#filterCat").value;
      var dist = Number($("#filterDist").value || 9);
      var price = Number($("#filterPrice").value || 999);
      var rating = Number($("#filterRating").value || 0);
      var urgency = $("#filterUrgency").value;

      var rows = state.availableMissions.filter(function (m) {
        var matchQ = !q || (m.title + m.employer + m.cat + (m.description || "")).toLowerCase().indexOf(q) > -1;
        var matchCat = !cat || m.cat === cat;
        var matchDist = m.distance <= dist;
        var matchPrice = m.price <= price;
        var matchRating = m.rating >= rating;
        var matchUrg = !urgency || m.urgency === urgency || (urgency === "Samedi" && m.date.indexOf("Samedi") > -1);
        return matchQ && matchCat && matchDist && matchPrice && matchRating && matchUrg;
      });

      if (state.searchLoading) {
        container.innerHTML = '<div class="loading-skeleton"></div><div class="loading-skeleton"></div>';
        countEl.textContent = "Recherche en cours…";
        return;
      }

      countEl.textContent = rows.length + " mission" + (rows.length > 1 ? "s" : "") + " trouvée" + (rows.length > 1 ? "s" : "");
      container.innerHTML = rows.length
        ? rows.map(function (m) { return missionCard(m, "seeker"); }).join("")
        : emptyState("🔍", "Aucun résultat", "Essayez d'élargir la distance ou de retirer un filtre.", null, null);
    }

    function debouncedDraw() {
      clearTimeout(debounceTimer);
      state.searchLoading = true;
      draw();
      debounceTimer = setTimeout(function () {
        state.searchLoading = false;
        draw();
      }, 350);
    }

    ids.forEach(function (id) {
      var el = $("#" + id);
      if (!el) return;
      if (id === "searchQ") el.addEventListener("input", debouncedDraw);
      else el.addEventListener("change", draw);
    });

    var reset = $("#resetFilters");
    if (reset) reset.onclick = function () {
      $("#searchQ").value = "";
      $("#filterCat").value = "";
      $("#filterDist").value = "9";
      $("#filterPrice").value = "999";
      $("#filterRating").value = "0";
      $("#filterUrgency").value = "";
      draw();
    };

    draw();
  }

  function renderMissions() {
    var list = $("#missionList");
    if (!list) return;
    if (!list.dataset.bound) {
      list.dataset.bound = "1";
      list.addEventListener("click", function (e) {
        var el = e.target.closest("[data-action]");
        if (!el || !list.contains(el)) return;
        handleAction(el.dataset.action, el);
      });
    }
    if (!state.missions.length) {
      list.innerHTML = emptyState("📋", "Aucune mission active", "Explore les annonces disponibles et postule en un clic.", "recherche", "Voir les missions");
    } else {
      list.innerHTML = state.missions.map(function (m) { return missionCard(m, "seeker-active"); }).join("");
    }
  }

  function initApplications() {
    var mount = $("#applicationsMount");
    if (!mount) return;
    if (!state.applications.length) {
      mount.innerHTML = emptyState("📋", "Aucune candidature", "Postule à une mission depuis la recherche.", "recherche", "Explorer les missions");
    } else {
      mount.innerHTML = '<div class="list">' + state.applications.map(function (a) {
        var cls = a.status === "Acceptée" ? "badge-status" : "badge-status badge-status--pending";
        return '<article class="row app-card--hover"><div class="row__main"><strong>' + esc(a.title) + '</strong><p>Envoyée ' + esc(a.date) + '</p></div><span class="' + cls + '">' + esc(a.status) + '</span></article>';
      }).join("") + '</div>';
    }
    if (window.SkillMatchDashboard) window.SkillMatchDashboard.init();
  }

  function initPublish() {
    var step = state.publishStep || 0;
    var steps = [$("#publishStep0"), $("#publishStep1"), $("#publishStep2")];
    var indicators = [$("#pubStep0"), $("#pubStep1"), $("#pubStep2")];
    var prev = $("#pubPrev");
    var next = $("#pubNext");

    function showStep(n) {
      state.publishStep = n;
      steps.forEach(function (s, i) { if (s) s.classList.toggle("is-active", i === n); });
      indicators.forEach(function (s, i) {
        if (!s) return;
        s.classList.toggle("is-active", i === n);
        s.classList.toggle("is-done", i < n);
      });
      if (prev) prev.hidden = n === 0;
      if (next) {
        next.textContent = n === 1 ? "Publier" : n === 2 ? "Voir mes missions" : "Continuer";
        next.hidden = false;
      }
    }

    function validateStep0() {
      var titleErr = U.validateRequired($("#pubTitle").value, 3, "Le titre");
      var priceErr = U.validatePrice($("#pubPrice").value);
      var errT = $("#errTitle"), errP = $("#errPrice");
      $("#pubTitle").classList.toggle("is-invalid", !!titleErr);
      $("#pubPrice").classList.toggle("is-invalid", !!priceErr);
      if (errT) { errT.textContent = titleErr || ""; errT.hidden = !titleErr; }
      if (errP) { errP.textContent = priceErr || ""; errP.hidden = !priceErr; }
      return !titleErr && !priceErr && $("#pubCat").value;
    }

    function validateStep1() {
      var descErr = U.validateRequired($("#pubDesc").value, 10, "La description");
      var errD = $("#errDesc");
      $("#pubDesc").classList.toggle("is-invalid", !!descErr);
      if (errD) { errD.textContent = descErr || ""; errD.hidden = !descErr; }
      return !descErr;
    }

    if (prev) prev.onclick = function () { showStep(Math.max(0, state.publishStep - 1)); };
    if (next) next.onclick = function () {
      if (state.publishStep === 0) {
        if (!validateStep0()) { toast("Formulaire incomplet", "Vérifiez les champs en rouge.", "error"); return; }
        showStep(1);
      } else if (state.publishStep === 1) {
        if (!validateStep1()) return;
        next.classList.add("is-loading");
        setTimeout(function () {
          var cat = $("#pubCat").value;
          var catImgs = { bricolage: img.bricolage, demenagement: img.moving, "baby-sitting": img.babysit, jardinage: img.garden, informatique: img.tech, livraison: img.delivery, cours: img.student };
          var newMission = {
            id: Date.now(),
            title: U.sanitizeText($("#pubTitle").value, 80),
            cat: cat,
            employer: "Vous",
            person: "Camille Duran",
            status: "Publiée",
            price: Number($("#pubPrice").value),
            distance: 0,
            rating: 5,
            date: $("#pubUrgency").value,
            urgency: $("#pubUrgency").value,
            img: catImgs[cat] || img.bricolage,
            description: U.sanitizeText($("#pubDesc").value, 500)
          };
          state.missions.unshift(newMission);
          state.availableMissions.unshift(Object.assign({}, newMission, { employer: "Camille Duran" }));
          addNotification("Mission publiée", newMission.title + " est en ligne.", "mission");
          $("#publishSuccess").hidden = false;
          $("#publishPreview").innerHTML = missionCard(newMission, "provider");
          next.classList.remove("is-loading");
          showStep(2);
          toast("Mission publiée", "Votre annonce est visible dans la recherche.", "success");
        }, 800);
      } else {
        window.SkillMatch.navigate("missions");
      }
    };

    showStep(step);
  }

  function initMessages() {
    var active = state.conversations[0];
    function drawList() {
      $("#conversationList").innerHTML = state.conversations.map(function (c) {
        var isActive = active && active.id === c.id;
        return '<button class="row' + (isActive ? " is-active" : "") + '" data-conv="' + c.id + '" role="option" aria-selected="' + isActive + '"><img src="' + c.avatar + '" alt=""><span class="row__main"><strong>' + esc(c.name) + '</strong><p>' + esc(c.last) + '</p></span></button>';
      }).join("");
      $$("[data-conv]").forEach(function (b) {
        b.onclick = function () {
          active = state.conversations.find(function (c) { return c.id === b.dataset.conv; });
          drawList();
          drawChat();
        };
      });
    }
    function drawChat() {
      if (!active) return;
      $("#chatLog").innerHTML = active.messages.map(function (m) {
        return '<div class="bubble ' + (m[0] === "me" ? "me" : "") + '">' + esc(m[1]) + '</div>';
      }).join("");
      $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
    }
    drawList();
    drawChat();
    $("#chatForm").onsubmit = function (e) {
      e.preventDefault();
      var input = $("#chatInput");
      var text = U.sanitizeText(input.value, 500);
      if (!text) { toast("Message vide", "Écrivez quelques mots avant d'envoyer.", "error"); return; }
      active.messages.push(["me", text]);
      active.last = text;
      input.value = "";
      drawChat();
      drawList();
      setTimeout(function () {
        active.messages.push(["them", "Bien reçu. Je confirme dans l'application."]);
        active.last = "Bien reçu. Je confirme dans l'application.";
        drawChat();
        drawList();
        toast("Réponse automatique", active.name + " vient de répondre.");
      }, 800);
    };
  }

  function reveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }

  window.SkillMatch = {
    $: $, $$: $$, state: state, img: img, money: money, toast: toast,
    addNotification: addNotification, render: render, labels: labels, esc: esc,
    navigate: function (route) {
      state.route = route || "accueil";
      location.hash = state.route;
      render();
    },
    renderNotificationBadge: function () {
      var dot = $("#notificationDot");
      if (dot) dot.style.display = state.notifications.some(function (n) { return n.unread; }) ? "block" : "none";
    },
    setRole: function (role) { state.role = role; render(); }
  };

  window.addEventListener("scroll", function () {
    var h = document.documentElement;
    var prog = $("#scrollProgress");
    if (prog) prog.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + "%";
    var header = $("#siteHeader");
    if (header) header.classList.toggle("is-scrolled", scrollY > 10);
  }, { passive: true });

  document.addEventListener("click", function (e) {
    var routeEl = e.target.closest("[data-route]");
    if (!routeEl) return;
    e.preventDefault();
    window.SkillMatch.navigate(routeEl.dataset.route);
  });

  window.addEventListener("hashchange", function () {
    state.route = (location.hash || "#accueil").slice(1);
    render();
  });

  document.addEventListener("DOMContentLoaded", function () {
    state.route = (location.hash || "#accueil").slice(1);
    render();
    window.SkillMatch.renderNotificationBadge();
  });
})();
