(function(){
  "use strict";
  var $ = function(s,c){return (c||document).querySelector(s);};
  var $$ = function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));};
  var img = {
    student:"https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80",
    moving:"https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=80",
    garden:"https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80",
    babysit:"https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=900&q=80",
    tech:"https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    delivery:"https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=900&q=80",
    profile:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
    dashboard:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
    payment:"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80",
    geo:"https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=900&q=80",
    rating:"https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
    bricolage:"https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80"
  };
  var state = {
    route:"accueil", likes:0, passes:0, seen:0, xp:740, balance:1840,
    notifications:[
      {id:1,type:"match",title:"Match avec Emma L.",body:"Disponible aujourd'hui pour ton demenagement.",time:"il y a 2 min",unread:true},
      {id:2,type:"wallet",title:"Paiement securise",body:"40 EUR places sous contrat SkillMatch.",time:"il y a 18 min",unread:true},
      {id:3,type:"rating",title:"Nouvel avis 5 etoiles",body:"Lea a confirme ta ponctualite.",time:"hier",unread:false}
    ],
    conversations:[
      {id:"emma",name:"Emma L.",avatar:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",last:"Super, je peux arriver a 18h.",messages:[["them","Bonjour ! J'ai vu la mission demenagement."],["me","Parfait. Tu es disponible vers 18h ?"],["them","Super, je peux arriver a 18h."]]},
      {id:"karim",name:"Karim B.",avatar:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",last:"J'apporte les outils.",messages:[["them","J'apporte les outils."],["me","Top, merci Karim."]]}
    ],
    missions:[
      {id:1,title:"Montage de meubles",cat:"bricolage",person:"Karim B.",status:"En cours",price:40,distance:.5,rating:4.9,date:"Aujourd'hui",img:img.bricolage},
      {id:2,title:"Aide au demenagement",cat:"demenagement",person:"Emma L.",status:"Contrat pret",price:45,distance:1.2,rating:4.8,date:"Demain",img:img.moving},
      {id:3,title:"Garde d'enfants - soiree",cat:"baby-sitting",person:"Maya R.",status:"A valider",price:52,distance:.8,rating:5,date:"Vendredi",img:img.babysit}
    ],
    candidates:[
      {name:"Nino P.",age:28,distance:"0,5 km",rating:4.7,missions:86,price:"40 EUR",time:"2 h",availability:"Ce soir",skills:["Montage","Outillage","IKEA"],badges:["Verifie","Top 8%"],photo:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80"},
      {name:"Lea M.",age:22,distance:"2,4 km",rating:4.9,missions:132,price:"30 EUR",time:"2 h",availability:"Maintenant",skills:["Jardinage","Terrasse","Entretien"],badges:["Rapide","5 etoiles"],photo:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80"},
      {name:"Thomas R.",age:31,distance:"3,1 km",rating:4.8,missions:204,price:"80 EUR",time:"Journee",availability:"Demain",skills:["Livraison","Velo cargo","Fragile"],badges:["Assure","Pro"],photo:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80"},
      {name:"Sara D.",age:26,distance:"1,7 km",rating:5,missions:64,price:"25 EUR/h",time:"1 h",availability:"Mercredi",skills:["Maths","Lycee","Pedagogie"],badges:["Certifiee","Patiente"],photo:"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80"}
    ],
    transactions:[
      {label:"Mission montage",amount:+40,time:"Aujourd'hui",type:"credit"},
      {label:"Retrait bancaire",amount:-220,time:"Hier",type:"debit"},
      {label:"Baby-sitting",amount:+52,time:"28 juin",type:"credit"},
      {label:"Facture SM-1042",amount:-6,time:"27 juin",type:"fee"}
    ]
  };
  function money(n){return (n<0?"-":"+") + Math.abs(n).toLocaleString("fr-FR") + " EUR";}
  function toast(title,body){
    var stack=$("#toastStack"); if(!stack) return;
    var el=document.createElement("div"); el.className="toast"; el.innerHTML="<b>"+title+"</b><small>"+(body||"")+"</small>";
    stack.appendChild(el); requestAnimationFrame(function(){el.classList.add("is-visible");});
    setTimeout(function(){el.classList.remove("is-visible");setTimeout(function(){el.remove();},350);},3600);
  }
  function addNotification(title,body,type){
    state.notifications.unshift({id:Date.now(),type:type||"info",title:title,body:body,time:"a l'instant",unread:true});
    window.SkillMatch.renderNotificationBadge();
  }
  function shell(title,subtitle,content){
    return '<section class="app-layout"><aside class="side-panel app-card" aria-label="Sections application">'+
      ["accueil","decouverte","recherche","messages","notifications","profil","wallet","missions","candidatures","parametres"].map(function(r){return '<button data-route="'+r+'" class="'+(state.route===r?"is-active":"")+'"><span>'+labels[r]+'</span><span>›</span></button>';}).join("")+
      '</aside><div class="workspace"><div class="toolbar"><div><h1>'+title+'</h1><p>'+subtitle+'</p></div><button class="btn btn--accent" data-action="quick-match">Lancer un match</button></div>'+content+'</div></section>';
  }
  var labels={accueil:"Accueil",decouverte:"Decouverte",recherche:"Recherche",messages:"Messages",notifications:"Notifications",profil:"Profil",wallet:"Wallet",missions:"Mes missions",candidatures:"Mes candidatures",parametres:"Parametres"};
  function home(){
    return '<section class="hero" aria-label="Presentation de SkillMatch"><div class="hero__media" id="heroMedia"></div><div class="hero__shade"></div><div><div class="hero__eyebrow tag"><span class="dot"></span> Demo interactive SkillMatch</div><h1>Ta prochaine mission,<br>a un <span class="rot" id="heroRot">swipe</span> pres.</h1><p class="hero__copy">SkillMatch associe la simplicite d\'une appli de rencontre a la rigueur d\'un outil pro : contractualisation, paiement, reputation, suivi en temps reel.</p><div class="hero__cta"><button class="btn btn--accent" data-route="decouverte">Essayer Serious Swipe</button><button class="btn btn--ghost" data-route="recherche">Explorer les missions</button></div></div><div class="phone-demo"><div class="phone-demo__screen" id="phonePreview"></div></div></section>'+
    '<section class="section"><div class="container"><div class="section-head reveal"><h2>Tout pour trouver,<br>realiser et securiser une mission.</h2><p>Une application simulee de bout en bout : matching, contrat, paiement, suivi live, reputation et portefeuille.</p></div><div class="grid grid--3">'+capabilities().join("")+'</div></div></section>'+
    '<section class="section"><div class="container"><div class="grid grid--4">'+metric("1 284","missions securisees")+metric("4,92","note moyenne")+metric("8 min","temps de match")+metric("98%","paiements liberes")+'</div></div></section>';
  }
  function capabilities(){
    return [
      ["Serious Swipe","Des cartes riches, rapides, utiles.",img.student,"decouverte"],
      ["Tracker live","ETA, timeline et carte simulee.",img.geo,"missions"],
      ["Wallet integre","Solde, factures, retraits et paiement.",img.payment,"wallet"],
      ["Dashboard","Revenus, XP, badges, objectifs.",img.dashboard,"candidatures"],
      ["Reputation","Avis, notes, historique et preuves.",img.rating,"profil"],
      ["Recherche instantanee","Filtres par distance, prix, note et urgence.",img.tech,"recherche"]
    ].map(function(c){return '<article class="cap-card app-card reveal"><img loading="lazy" src="'+c[2]+'" alt=""><div class="tag"><span class="dot"></span>'+c[0]+'</div><div><h3>'+c[0]+'</h3><p>'+c[1]+'</p><button class="btn btn--ghost" data-route="'+c[3]+'">Ouvrir</button></div></article>';});
  }
  function metric(a,b){return '<article class="metric app-card reveal"><b>'+a+'</b><span>'+b+'</span></article>';}
  function phonePreview(){
    return '<div class="row"><img src="'+state.candidates[0].photo+'" alt=""><div class="row__main"><strong>'+state.candidates[0].name+'</strong><p>Montage de meubles · 0,5 km</p></div><span class="row__meta">4.7</span></div><div id="miniChart" class="chart">'+[55,78,42,90,64,88].map(function(h){return '<i class="bar" style="--h:'+h+'%"></i>';}).join("")+'</div><div class="row"><div class="row__main"><strong>Contrat actif</strong><p>Paiement bloque jusqu\'a validation.</p></div><span class="row__meta">40 EUR</span></div><button class="btn btn--accent" data-route="decouverte">Matcher maintenant</button>';
  }
  function searchView(){
    return shell("Recherche","Trouve une mission ou un profil en temps reel.",'<div class="filters app-card panel"><input class="input" id="searchQ" placeholder="Baby-sitting, demenagement, cours de maths..." aria-label="Recherche"><select class="select" id="filterCat"><option value="">Categorie</option><option value="bricolage">Bricolage</option><option value="demenagement">Demenagement</option><option value="baby-sitting">Baby-sitting</option></select><select class="select" id="filterDist"><option value="9">Distance</option><option value="1">- 1 km</option><option value="3">- 3 km</option></select><select class="select" id="filterPrice"><option value="999">Prix</option><option value="45">- 45 EUR</option><option value="60">- 60 EUR</option></select><select class="select" id="filterRating"><option value="0">Note</option><option value="4.8">4.8+</option><option value="5">5.0</option></select><select class="select" id="filterUrgency"><option>Urgence</option><option>Aujourd\'hui</option><option>Demain</option></select></div><div class="list" id="searchResults"></div>');
  }
  function missionsView(){
    return shell("Mes missions","Accepte, refuse, signe, termine ou annule chaque mission.",'<div class="grid grid--2"><div class="list" id="missionList"></div><div class="app-card panel"><h2>Tracker live</h2><p class="muted">Localisation simulee, ETA et progression de mission.</p><div id="trackerMount"></div></div></div>');
  }
  function genericDashboard(){
    return shell("Mes candidatures","Pilote ton activite comme un independant premium.",'<div id="dashboardMount"></div>');
  }
  function messagesView(){
    return shell("Messages","Conversations creees automatiquement apres un match.",'<div class="conversation"><div class="conversation-list app-card" id="conversationList"></div><div class="chat app-card"><div class="chat-log" id="chatLog"></div><form class="chat-form" id="chatForm"><input class="input" id="chatInput" placeholder="Ecrire un message..." aria-label="Message"><button class="btn btn--accent">Envoyer</button><button class="btn btn--ghost" type="button" data-action="attach">Joindre</button></form></div></div>');
  }
  function notificationsView(){
    return shell("Notifications","Tout ce qui demande une decision, sans bruit.",'<div class="list" id="notificationCenter"></div>');
  }
  function settingsView(){
    return shell("Parametres","Controle ton experience SkillMatch.",'<div class="grid grid--2"><div class="app-card panel"><h2>Preferences</h2><div class="list"><label class="row"><span class="row__main"><strong>Mode mission urgente</strong><p>Priorise les demandes proches.</p></span><input type="checkbox" checked></label><label class="row"><span class="row__main"><strong>Notifications paiement</strong><p>Alerte des qu\'une transaction bouge.</p></span><input type="checkbox" checked></label><label class="row"><span class="row__main"><strong>Disponibilite publique</strong><p>Ton profil apparait dans Serious Swipe.</p></span><input type="checkbox"></label></div></div><div class="app-card panel"><h2>Contrat simule</h2><p class="muted">Signature, validation et paiement securise.</p><button class="btn btn--accent" data-action="sign-contract">Signer le contrat</button></div></div>');
  }
  function render(){
    var app=$("#app");
    var route=state.route;
    if(route==="accueil") app.innerHTML=home();
    if(route==="decouverte") app.innerHTML=shell("Decouverte","Vois-le a l'oeuvre, pas sur un PowerPoint.",'<div id="swipeMount"></div>');
    if(route==="recherche") app.innerHTML=searchView();
    if(route==="missions") app.innerHTML=missionsView();
    if(route==="candidatures") app.innerHTML=genericDashboard();
    if(route==="messages") app.innerHTML=messagesView();
    if(route==="notifications") app.innerHTML=notificationsView();
    if(route==="wallet") app.innerHTML=shell("Wallet","Solde, paiements, transactions et factures.",'<div id="walletMount"></div>');
    if(route==="profil") app.innerHTML=shell("Profil","Un profil complet, credible et actionnable.",'<div id="profileMount"></div>');
    if(route==="parametres") app.innerHTML=settingsView();
    document.title="SkillMatch - "+labels[route];
    app.focus({preventScroll:true});
    bootView();
  }
  function bootView(){
    $$(".nav-link").forEach(function(b){b.classList.toggle("is-active",b.dataset.route===state.route);});
    reveal(); bindActions();
    if($("#phonePreview")) $("#phonePreview").innerHTML=phonePreview();
    if(window.SkillMatchSwipe) window.SkillMatchSwipe.init();
    if(window.SkillMatchTracker) window.SkillMatchTracker.init();
    if(window.SkillMatchDashboard) window.SkillMatchDashboard.init();
    if(window.SkillMatchWallet) window.SkillMatchWallet.init();
    if(window.SkillMatchProfile) window.SkillMatchProfile.init();
    if(window.SkillMatchNotifications) window.SkillMatchNotifications.init();
    if(state.route==="recherche") initSearch();
    if(state.route==="missions") renderMissions();
    if(state.route==="messages") initMessages();
  }
  function bindActions(){
    $$("[data-action]").forEach(function(el){el.addEventListener("click",function(){handleAction(el.dataset.action,el);});});
  }
  function handleAction(action,el){
    if(action==="quick-match"){window.SkillMatch.navigate("decouverte");}
    if(action==="attach"){toast("Piece jointe ajoutee","Le contrat PDF simule est pret a envoyer.");}
    if(action==="sign-contract"){toast("Contrat signe","Paiement securise et mission ajoutee au suivi.");addNotification("Contrat valide","La mission peut demarrer.","contract");}
    if(action==="withdraw"){state.balance-=Number(el.dataset.amount||120);toast("Retrait simule","Le solde Wallet a ete mis a jour.");render();}
    if(action==="accept-mission"){toast("Mission acceptee","Contrat genere, paiement bloque et tracker pret.");addNotification("Mission acceptee","Le contrat SkillMatch attend signature.","mission");}
    if(action==="details"){toast("Details ouverts","Contrat, profil, paiement et historique sont visibles dans la demo.");}
    if(action==="decline"){toast("Mission refusee","La mission est retiree de tes priorites.");}
    if(action==="pay-demo"){state.balance+=75;state.transactions.unshift({label:"Paiement simule",amount:+75,time:"a l'instant",type:"credit"});toast("Paiement simule","75 EUR ajoutes au Wallet.");render();}
  }
  function initSearch(){
    var inputs=["searchQ","filterCat","filterDist","filterPrice","filterRating"].map(function(id){return $("#"+id);});
    inputs.forEach(function(i){if(i)i.addEventListener("input",draw);if(i)i.addEventListener("change",draw);}); draw();
    function draw(){
      var q=($("#searchQ").value||"").toLowerCase(), cat=$("#filterCat").value, dist=Number($("#filterDist").value||9), price=Number($("#filterPrice").value||999), rating=Number($("#filterRating").value||0);
      var rows=state.missions.filter(function(m){return (!q||(m.title+m.person+m.cat).toLowerCase().indexOf(q)>-1)&&(!cat||m.cat===cat)&&m.distance<=dist&&m.price<=price&&m.rating>=rating;});
      $("#searchResults").innerHTML=rows.map(missionCard).join("") || '<div class="app-card panel">Aucun resultat. Ajuste les filtres.</div>'; bindActions();
    }
  }
  function missionCard(m){
    return '<article class="mission-card app-card panel"><img loading="lazy" src="'+m.img+'" alt=""><div><div class="chips"><span class="chip">'+m.cat+'</span><span class="chip">'+m.distance+' km</span><span class="chip">'+m.rating+' etoiles</span></div><h3>'+m.title+'</h3><p class="muted">'+m.person+' · '+m.date+' · '+m.status+'</p></div><div class="mission-actions"><button class="btn btn--accent" data-action="accept-mission">Accepter</button><button class="btn btn--ghost" data-action="details">Details</button><button class="btn btn--danger" data-action="decline">Refuser</button></div></article>';
  }
  function renderMissions(){ $("#missionList").innerHTML=state.missions.map(missionCard).join(""); bindActions(); }
  function initMessages(){
    var active=state.conversations[0];
    function drawList(){ $("#conversationList").innerHTML=state.conversations.map(function(c){return '<button class="row" data-conv="'+c.id+'"><img src="'+c.avatar+'" alt=""><span class="row__main"><strong>'+c.name+'</strong><p>'+c.last+'</p></span></button>';}).join(""); $$("[data-conv]").forEach(function(b){b.onclick=function(){active=state.conversations.find(function(c){return c.id===b.dataset.conv;});drawChat();};});}
    function drawChat(){ $("#chatLog").innerHTML=active.messages.map(function(m){return '<div class="bubble '+(m[0]==="me"?"me":"")+'">'+m[1]+'</div>';}).join("");}
    drawList(); drawChat(); $("#chatForm").onsubmit=function(e){e.preventDefault();var input=$("#chatInput"); if(!input.value.trim()) return; active.messages.push(["me",input.value.trim()]); input.value=""; drawChat(); setTimeout(function(){active.messages.push(["them","Bien recu. Je confirme dans l'application."]);drawChat();toast("Reponse automatique",active.name+" vient de repondre.");},800);};
  }
  function reveal(){
    var els=$$(".reveal"); if(!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("is-visible");});return;}
    var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add("is-visible");io.unobserve(e.target);}});},{threshold:.12});
    els.forEach(function(e){io.observe(e);});
  }
  window.SkillMatch={$, $$, state:state, img:img, money:money, toast:toast, addNotification:addNotification, render:render, labels:labels,
    navigate:function(route){state.route=route||"accueil"; location.hash=state.route; render();},
    renderNotificationBadge:function(){var dot=$("#notificationDot"); if(dot) dot.style.display=state.notifications.some(function(n){return n.unread;})?"block":"none";}
  };
  window.addEventListener("scroll",function(){var h=document.documentElement;$("#scrollProgress").style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+"%";$("#siteHeader").classList.toggle("is-scrolled",scrollY>10);},{passive:true});
  document.addEventListener("click",function(e){
    var routeEl=e.target.closest("[data-route]");
    if(!routeEl) return;
    e.preventDefault();
    window.SkillMatch.navigate(routeEl.dataset.route);
  });
  window.addEventListener("hashchange",function(){state.route=(location.hash||"#accueil").slice(1);render();});
  document.addEventListener("DOMContentLoaded",function(){state.route=(location.hash||"#accueil").slice(1);render();window.SkillMatch.renderNotificationBadge();});
})();
