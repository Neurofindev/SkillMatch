(function(){
  "use strict";
  window.SkillMatchDashboard={
    init:function(){
      var SM=window.SkillMatch,mount=SM.$("#dashboardMount");
      if(!mount)return;
      mount.innerHTML='<div class="dashboard-grid"><div class="app-card panel"><h2>Revenus</h2><div class="chart">'+[42,58,74,53,88,96,71,109].map(function(h){return '<i class="bar" style="--h:'+h+'%"></i>';}).join("")+'</div></div><div class="app-card panel"><h2>Réputation</h2><div class="ring" style="--p:92%"><span>4.92</span></div></div></div><div class="grid grid--4" style="margin-top:18px">'+("1 840 EUR|Revenus,47 h|Temps travaillé,Niveau 8|XP freelance,12|Badges").split(",").map(function(x){var p=x.split("|");return '<article class="metric app-card"><b>'+p[0]+'</b><span>'+p[1]+'</span></article>';}).join("")+'</div><div class="app-card panel" style="margin-top:18px"><h2>Objectifs</h2><div class="list"><div class="row"><div class="row__main"><strong>10 missions ce mois-ci</strong><p>7 / 10 validées</p></div><span class="row__meta">70%</span></div><div class="row"><div class="row__main"><strong>Badge ponctualité</strong><p>Encore 2 arrivées à l\'heure.</p></div><span class="row__meta">XP +120</span></div></div></div>';
    }
  };
})();
