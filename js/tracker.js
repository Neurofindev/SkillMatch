(function () {
  "use strict";
  window.SkillMatchTracker = {
    init: function () {
      var SM = window.SkillMatch;
      var mount = SM.$("#trackerMount");
      if (!mount) return;

      mount.innerHTML = '<div class="tracker"><div class="row"><img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80" alt="Photo de Karim B."><div class="row__main"><strong>Karim B.</strong><p>Montage de meubles · 0,5 km</p></div><span class="row__meta" id="trackerEta">ETA</span></div><div class="tracker-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="trackerProgressBar"><i id="trackerBar"></i></div><svg class="map" viewBox="0 0 680 260" role="img" aria-label="Carte simulée du trajet"><path d="M45 210 C145 95 265 120 355 55 C455 -15 570 70 635 150" fill="none" stroke="rgba(46,58,58,0.15)" stroke-width="8" stroke-linecap="round"/><path d="M45 210 C145 95 265 120 355 55 C455 -15 570 70 635 150" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="10 12"/><circle cx="45" cy="210" r="10" fill="var(--accent-2)"/><circle cx="635" cy="150" r="12" fill="var(--accent)"/><circle class="map-runner" r="9" fill="var(--ink)"/></svg><div class="list" id="trackerSteps"></div><div class="tracker-controls"><button class="btn btn--accent" id="trackerPlay">Lancer la simulation</button><button class="btn btn--ghost" id="trackerReset">Rejouer</button></div></div>';

      var steps = ["Mission acceptée", "Prestataire en route", "Arrivé sur place", "Mission en cours", "Terminée & payée"];
      var cur = -1, timer = null, playing = false;

      function draw() {
        SM.$("#trackerSteps").innerHTML = steps.map(function (s, i) {
          return '<div class="row ' + (i < cur ? "done" : "") + ' ' + (i === cur ? "active" : "") + '"><span class="chip" aria-hidden="true">' + (i < cur ? "✓" : i + 1) + '</span><div class="row__main"><strong>' + s + '</strong><p>' + (i <= cur ? new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "En attente") + '</p></div></div>';
        }).join("");
        var pct = Math.max(cur, 0) / (steps.length - 1) * 100;
        SM.$("#trackerBar").style.width = pct + "%";
        var bar = SM.$("#trackerProgressBar");
        if (bar) bar.setAttribute("aria-valuenow", Math.round(pct));
        SM.$("#trackerEta").textContent = cur < 1 ? "ETA" : cur === 1 ? "8 min" : cur === 2 ? "2 min" : cur === 3 ? "En cours" : "Fait";
      }

      function next() {
        cur++;
        draw();
        if (cur >= steps.length - 1) {
          playing = false;
          SM.$("#trackerPlay").textContent = "Lancer la simulation";
          SM.toast("Mission terminée & payée", "40 EUR versés sur le portefeuille.", "success");
          SM.state.balance += 40;
          return;
        }
        timer = setTimeout(next, 1900);
      }

      SM.$("#trackerPlay").onclick = function () {
        if (playing) {
          clearTimeout(timer);
          playing = false;
          this.textContent = "Reprendre";
          return;
        }
        playing = true;
        this.textContent = "Mettre en pause";
        if (cur >= steps.length - 1) cur = -1;
        next();
      };

      SM.$("#trackerReset").onclick = function () {
        clearTimeout(timer);
        playing = false;
        cur = -1;
        SM.$("#trackerPlay").textContent = "Lancer la simulation";
        draw();
      };

      draw();
    }
  };
})();
