(function () {
  "use strict";

  /**
   * Échappe le HTML pour prévenir les injections XSS (saisie utilisateur).
   */
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Supprime les balises HTML résiduelles. */
  function stripTags(str) {
    return String(str || "").replace(/<[^>]*>/g, "");
  }

  /** Nettoie et tronque une saisie texte. */
  function sanitizeText(str, maxLen) {
    var clean = stripTags(String(str || "")).trim();
    if (maxLen && clean.length > maxLen) clean = clean.slice(0, maxLen);
    return clean;
  }

  /** Valide un champ requis avec longueur minimale. */
  function validateRequired(value, minLen, label) {
    var v = sanitizeText(value);
    if (!v) return label + " est obligatoire.";
    if (minLen && v.length < minLen) {
      return label + " doit contenir au moins " + minLen + " caractères.";
    }
    return null;
  }

  /** Valide un montant numérique positif. */
  function validatePrice(value) {
    var n = Number(String(value).replace(",", "."));
    if (isNaN(n) || n <= 0) return "Indiquez un montant valide (ex. 25).";
    if (n > 9999) return "Le montant semble trop élevé pour une mission ponctuelle.";
    return null;
  }

  /** Icônes par catégorie de mission (emoji accessibles). */
  var CAT_ICONS = {
    bricolage: "🔧",
    demenagement: "📦",
    "baby-sitting": "👶",
    jardinage: "🌿",
    informatique: "💻",
    livraison: "🚴",
    cours: "📚",
    match: "✨"
  };

  function catIcon(cat) {
    return CAT_ICONS[cat] || "📋";
  }

  function catClass(cat) {
    return "cat-icon--" + (cat || "match").replace(/\s+/g, "-");
  }

  window.SkillMatchUtils = {
    escapeHtml: escapeHtml,
    sanitizeText: sanitizeText,
    validateRequired: validateRequired,
    validatePrice: validatePrice,
    catIcon: catIcon,
    catClass: catClass
  };
})();
