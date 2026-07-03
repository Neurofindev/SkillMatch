(function () {
  "use strict";
  window.SkillMatchNotifications = {
    init: function () {
      var SM = window.SkillMatch;
      var mount = SM.$("#notificationCenter");
      if (!mount) return;

      if (!SM.state.notifications.length) {
        mount.innerHTML = '<div class="empty-state app-card panel"><div class="empty-state__icon" aria-hidden="true">🔔</div><h3>Aucune notification</h3><p>Vous serez alerté ici des matchs, paiements et candidatures.</p></div>';
        return;
      }

      mount.innerHTML = SM.state.notifications.map(function (n) {
        return '<article class="row notification-item ' + (n.unread ? "unread" : "") + '"><span class="chip">' + SM.esc(n.type) + '</span><div class="row__main"><strong>' + SM.esc(n.title) + '</strong><p>' + SM.esc(n.body) + '</p></div><span class="row__meta">' + SM.esc(n.time) + '</span><button class="btn btn--ghost btn--sm" data-id="' + n.id + '" aria-label="Marquer comme lu">Vu</button></article>';
      }).join("");

      SM.$$('[data-id]', mount).forEach(function (b) {
        b.onclick = function () {
          var n = SM.state.notifications.find(function (x) { return x.id == b.dataset.id; });
          if (n) n.unread = false;
          SM.renderNotificationBadge();
          window.SkillMatchNotifications.init();
        };
      });
    }
  };
})();
