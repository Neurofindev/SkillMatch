(function(){
  "use strict";
  window.SkillMatchWallet={init:function(){
    var SM=window.SkillMatch,mount=SM.$("#walletMount"); if(!mount)return;
    mount.innerHTML='<div class="grid grid--2"><div class="app-card panel"><span class="tag"><span class="dot"></span>Solde disponible</span><h2 style="font-size:3.6rem;margin:12px 0">'+SM.state.balance.toLocaleString("fr-FR")+' EUR</h2><p class="muted">Paiements securises, retraits et factures simules.</p><div class="hero__cta"><button class="btn btn--accent" data-action="withdraw" data-amount="120">Retirer 120 EUR</button><button class="btn btn--ghost" data-action="pay-demo">Simuler un paiement</button></div></div><div class="app-card panel"><h2>Factures</h2><div class="list"><div class="row"><div class="row__main"><strong>Facture SM-1042</strong><p>Commission plateforme</p></div><span class="row__meta">PDF</span></div><div class="row"><div class="row__main"><strong>Recu mission #218</strong><p>Montage de meubles</p></div><span class="row__meta">PDF</span></div></div></div></div><div class="app-card panel" style="margin-top:18px"><h2>Transactions</h2><div class="list">'+SM.state.transactions.map(function(t){return '<div class="row"><div class="row__main"><strong>'+t.label+'</strong><p>'+t.time+' · '+t.type+'</p></div><span class="row__meta">'+SM.money(t.amount)+'</span></div>';}).join("")+'</div></div>';
  }};
})();
