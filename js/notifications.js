(function(){
  "use strict";
  window.SkillMatchNotifications={init:function(){
    var SM=window.SkillMatch, mount=SM.$("#notificationCenter"); if(!mount) return;
    mount.innerHTML=SM.state.notifications.map(function(n){return '<article class="row notification-item '+(n.unread?"unread":"")+'"><span class="chip">'+n.type+'</span><div class="row__main"><strong>'+n.title+'</strong><p>'+n.body+'</p></div><span class="row__meta">'+n.time+'</span><button class="btn btn--ghost" data-id="'+n.id+'">Vu</button></article>';}).join("");
    SM.$$("[data-id]",mount).forEach(function(b){b.onclick=function(){var n=SM.state.notifications.find(function(x){return x.id==b.dataset.id;}); if(n)n.unread=false; SM.renderNotificationBadge(); window.SkillMatchNotifications.init();};});
  }};
})();
