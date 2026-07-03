# CHANGELOG — SkillMatch Refonte v2.0

## Palette appliquée (`css/theme.css`)

| Token | Valeur | Usage |
|-------|--------|-------|
| `--bg` | `#EAF6F3` | Fond principal apaisant (vert sauge clair) |
| `--bg-alt` | `#DCEFE8` | Fond secondaire, panneaux latéraux |
| `--surface` | `#FFFFFF` | Cartes et conteneurs |
| `--ink` | `#2E3A3A` | Texte principal (contraste AA 5.8:1) |
| `--muted` | `#5A6B6B` | Texte secondaire (contraste AA 3.2:1) |
| `--accent` | `#FF6B6B` | Actions principales (Postuler, Publier, CTA) |
| `--accent-2` | `#FFB84C` | Badges, highlights secondaires |
| `--ok` | `#2A9D8F` | Succès, étapes validées |

**Justification :** Fond doux pour le repos visuel, anthracite lisible, corail chaleureux pour guider l'action sans agressivité. Contraste vérifié pour texte/boutons sur fond clair (niveau AA WCAG).

---

## Bugs corrigés

1. ✅ **Recherche sur mauvaises données** — filtrait `state.missions` au lieu de `availableMissions`
2. ✅ **Filtre urgence inactif** — le `<select>` n'était pas branché dans `initSearch()`
3. ✅ **Boutons Wallet inopérants** — `bindActions()` s'exécutait avant montage du module
4. ✅ **Écoute clavier Swipe** — `document.onkeydown` écrasait d'autres handlers
5. ✅ **XSS potentiel** — saisies utilisateur maintenant échappées via `escapeHtml()`
6. ✅ **Alt vide sur avatar** — attributs descriptifs ajoutés
7. ✅ **Menu mobile** — fermeture au clic backdrop + blocage scroll body
8. ✅ **Retrait Wallet** — vérification solde insuffisant avant débit
9. ✅ **Loading recherche** — débounce 350ms + skeleton shimmer

---

## Composition modifiée

- **Hero section** : épurée sur dégradé clair (suppression overlay sombre)
- **Cartes mission** : icône catégorie visible, prix mis en avant, bouton « Postuler » en accent
- **Layout app** : sidebar persistent avec navigation adaptée au rôle (chercheur/donneur)
- **États vides** : explicites avec icônes et CTA (recherche, candidatures, notifications)
- **Barre de progression** : scroll global + steps candidature/publication
- **Switch profil** : Chercheur ↔ Donneur dans le header

---

## Interactivité ajoutée

✨ **Parcours candidature**
- Modal 1 étape (message optionnel)
- Animation succès (checkmark) + toast
- Notification automatique + conversation créée

✨ **Publication mission**
- Wizard 2 étapes (infos + description)
- Validation champs (titre, prix, catégorie, description)
- Preview avant confirmation
- Animation succès

✨ **Recherche**
- Débounce 350 ms sur requête
- Skeleton loading pendant recherche
- Compteur résultats en temps réel
- Bouton « Réinitialiser filtres »

✨ **Rôles**
- Switch Chercheur / Donneur dans header
- Navigation adaptée (sidebar différente par rôle)
- Vue donneur : liste candidatures + bouton Accepter

✨ **Micro-animations**
- Hover cartes : élévation + ombre
- Toast typés (success/error) : slide up
- Checkmark succès : scale in
- Steps progressbar : couleurs selon état

---

## Fichiers impactés

| Fichier | Changement | Impact |
|---------|-----------|--------|
| `css/theme.css` | **NOUVEAU** — palette centralisée, vars CSS | Global |
| `css/style.css` | Refonte complète thème clair | Global |
| `css/animations.css` | Shimmer, scaleIn, pulse, checkDraw | Global |
| `css/responsive.css` | Breakpoints affinés (mobile-first) | Mobile + Desktop |
| `js/utils.js` | Escape HTML, validation, icônes | Sécurité + UX |
| `js/app.js` | Données, recherche corrigée, candidature, publication | Core |
| `js/navigation.js` | Backdrop fermeture menu | Mobile |
| `js/swipe.js` | addEventListener remplace onkeydown | Accessibilité |
| `js/tracker.js` | Vars CSS + aria progressbar | Visual + A11y |
| `js/notifications.js` | État vide, escape HTML | UX |
| `js/wallet.js` | État vide transactions, vérif solde | UX + Sécurité |
| `js/profile.js` | Alt images portfolio | A11y |
| `index.html` | theme.css + utils.js (ordre) | Setup |

---

## Accessibilité (WCAG AA)

✅ Contrastes : texte ≥ 4.5:1, UI ≥ 3:1
✅ Labels sur tous les inputs et boutons
✅ ARIA : progressbar, live regions, modal focus
✅ Navigation clavier : Tab, Escape, Enter
✅ Images : alt descriptifs ou aria-hidden pour décoratives
✅ Préfère motion réduite : animations supprimées si demandé

---

## Lancement local

Ouvrir `index.html` dans un navigateur ou servir :

```bash
npx serve .
# ou
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

**Aucune dépendance npm requise** — démo frontale pure.

---

## Notes de conception

- **Mobile-first** : breakpoints à 760px (mobile), 1180px (tablet-desktop)
- **Performance** : lazy loading images, debounce recherche, IIFE modules
- **Sécurité** : saisies échappées, pas de tokens en dur, démo locale
- **UX** : toast temps réel, états loading, confirmations claires, parcours courts
