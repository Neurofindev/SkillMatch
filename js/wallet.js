(function () {
  "use strict";
  window.SkillMatchWallet = {
    init: function () {
      var SM = window.SkillMatch;
      var mount = SM.$("#walletMount");
      if (!mount) return;

      mount.innerHTML = '<div class="grid grid--2"><div class="app-card panel"><span class="tag"><span class="dot"></span>Solde disponible</span><h2 style="font-size:clamp(2.4rem,5vw,3.2rem);margin:12px 0;color:var(--accent)">' + SM.state.balance.toLocaleString("fr-FR") + ' EUR</h2><p class="muted">Paiements sécurisés, retraits et factures simulés.</p><div class="hero__cta"><button class="btn btn--accent" data-action="withdraw" data-amount="120">Retirer 120 EUR</button><button class="btn btn--ghost" data-action="pay-demo">Simuler un paiement</button></div></div><div class="app-card panel"><h2>Factures</h2><div class="list"><div class="row"><div class="row__main"><strong>Facture SM-1042</strong><p>Commission plateforme</p></div><span class="row__meta">PDF</span></div><div class="row"><div class="row__main"><strong>Reçu mission #218</strong><p>Montage de meubles</p></div><span class="row__meta">PDF</span></div></div></div></div><div class="app-card panel" style="margin-top:18px"><h2>Transactions</h2><div class="list">' +
        (SM.state.transactions.length
          ? SM.state.transactions.map(function (t) {
            return '<div class="row"><div class="row__main"><strong>' + SM.esc(t.label) + '</strong><p>' + SM.esc(t.time) + ' · ' + SM.esc(t.type) + '</p></div><span class="row__meta">' + SM.money(t.amount) + '</span></div>';
          }).join("")
          : '<p class="muted">Aucune transaction pour le moment.</p>') +
        '</div></div>';
    }
  };
})();
