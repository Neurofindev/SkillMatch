(function () {
  "use strict";
  window.SkillMatchSwipe = {
    init: function () {
      var SM = window.SkillMatch;
      var mount = SM.$("#swipeMount");
      if (!mount) return;

      mount.innerHTML = '<div class="grid grid--2"><div class="app-card panel"><div class="swipe-stage" id="swipeStage" aria-label="Cartes profils à swiper"></div><div class="swipe-actions"><button class="swipe-btn swipe-btn--nope" id="swipeNope" aria-label="Passer ce profil">Pass</button><button class="swipe-btn swipe-btn--like" id="swipeLike" aria-label="Matcher ce profil">Like</button></div><div class="chips"><span class="chip">Matchs <b id="tallyLike">' + SM.state.likes + '</b></span><span class="chip">Passés <b id="tallyNope">' + SM.state.passes + '</b></span><span class="chip">Vus <b id="tallySeen">' + SM.state.seen + '</b></span></div></div><div class="app-card panel"><h2>Match</h2><p class="muted">Lorsqu\'un match est effectué : animation, notification, conversation et mission sont créés automatiquement.</p><div id="matchFeed" class="list" aria-live="polite"></div></div></div>';

      var stage = SM.$("#swipeStage");
      var stack = SM.state.candidates.slice();
      var active = null;
      var threshold = 95;

      function card(c, i) {
        return '<article class="swipe-card" style="z-index:' + (10 - i) + ';transform:translateY(' + (i * 12) + 'px) scale(' + (1 - i * 0.045) + ')"><img src="' + c.photo + '" alt="Photo de ' + SM.esc(c.name) + '"><div class="swipe-stamp like">MATCH</div><div class="swipe-stamp nope">NON</div><div class="swipe-info"><div><h3>' + SM.esc(c.name) + ' <span>' + c.age + ' ans</span></h3><p>' + SM.esc(c.distance) + ' · ' + c.rating + ' ★ · ' + c.missions + ' missions</p></div><strong>' + SM.esc(c.price) + '</strong></div><div class="chips">' + c.badges.concat(c.skills).map(function (s) { return '<span class="chip">' + SM.esc(s) + '</span>'; }).join("") + '</div><p class="muted" style="color:rgba(255,255,255,.85)">' + SM.esc(c.time) + ' estimé · ' + SM.esc(c.availability) + '</p></article>';
      }

      function render() {
        if (!stack.length) stack = SM.state.candidates.slice();
        stage.innerHTML = stack.slice(0, 3).map(card).join("") ||
          '<div class="empty-state"><p class="muted">Plus de profils pour le moment. Revenez bientôt !</p></div>';
        active = stage.firstElementChild;
        if (active && active.classList.contains("swipe-card")) bind(active);
      }

      function bind(el) {
        var sx = 0, dx = 0, drag = false;
        el.onpointerdown = function (e) {
          drag = true; sx = e.clientX;
          el.style.transition = "none";
          el.setPointerCapture(e.pointerId);
        };
        el.onpointermove = function (e) {
          if (!drag) return;
          dx = e.clientX - sx;
          el.style.transform = "translate(" + dx + "px,0) rotate(" + (dx * 0.055) + "deg)";
          el.dataset.verdict = dx > threshold ? "like" : dx < -threshold ? "nope" : "";
        };
        el.onpointerup = function () {
          if (!drag) return;
          drag = false;
          if (dx > threshold) fly(1);
          else if (dx < -threshold) fly(-1);
          else { el.style.transition = ""; el.style.transform = ""; el.dataset.verdict = ""; }
        };
      }

      function fly(dir) {
        if (!active) return;
        var c = stack[0];
        active.style.transition = "transform .42s var(--ease),opacity .32s";
        active.style.transform = "translate(" + (dir * (innerWidth + 220)) + "px,40px) rotate(" + (dir * 24) + "deg)";
        active.style.opacity = 0;
        SM.state.seen++;
        if (dir > 0) { SM.state.likes++; match(c); }
        else { SM.state.passes++; SM.toast("Profil passé", "La pile continue avec de nouveaux profils."); }
        stack.shift();
        update();
        setTimeout(render, 300);
      }

      function match(c) {
        SM.toast("Match avec " + c.name, "Conversation et mission créées automatiquement.", "success");
        SM.addNotification("Match avec " + c.name, c.availability + " · " + c.price, "match");
        SM.state.conversations.unshift({
          id: "c-" + Date.now(), name: c.name, avatar: c.photo,
          last: "On peut finaliser le contrat.",
          messages: [
            ["them", "Salut, je suis disponible pour cette mission."],
            ["me", "Parfait, je t'envoie le contrat SkillMatch."]
          ]
        });
        SM.state.missions.unshift({
          id: Date.now(), title: c.skills[0] + " — mission matchée", cat: "match",
          person: c.name, status: "Contrat prêt", price: parseInt(c.price, 10) || 40,
          distance: parseFloat(String(c.distance).replace(",", ".")) || 1,
          rating: c.rating, date: c.availability, urgency: c.availability, img: c.photo
        });
        var feed = SM.$("#matchFeed");
        if (feed) feed.insertAdjacentHTML("afterbegin",
          '<div class="row app-card--hover"><img src="' + c.photo + '" alt=""><div class="row__main"><strong>' + SM.esc(c.name) + '</strong><p>Conversation, contrat et paiement simulés.</p></div><span class="badge-status badge-status--accent">MATCH</span></div>');
      }

      function update() {
        var l = SM.$("#tallyLike"), n = SM.$("#tallyNope"), s = SM.$("#tallySeen");
        if (l) l.textContent = SM.state.likes;
        if (n) n.textContent = SM.state.passes;
        if (s) s.textContent = SM.state.seen;
      }

      SM.$("#swipeLike").onclick = function () { fly(1); };
      SM.$("#swipeNope").onclick = function () { fly(-1); };

      document.addEventListener("keydown", function swipeKeys(e) {
        if (SM.state.route !== "decouverte") return;
        if (e.key === "ArrowRight") fly(1);
        if (e.key === "ArrowLeft") fly(-1);
      });

      render();
    }
  };
})();
