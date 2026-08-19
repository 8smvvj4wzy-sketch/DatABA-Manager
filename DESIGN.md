---
name: DatABA Manager
description: Consolidation et bilans pour les cadres pédagogiques, poste de bureau — même grammaire que DatABA, déclinée pour un écran large.
colors:
  ink: "#0E1B33"
  ink-soft: "#52627A"
  paper: "#F3F6FB"
  card: "#FFFFFF"
  border: "#D7E0EE"
  accent: "#4A4A4A"
  accent-ink: "#FFFFFF"
  nav-bg: "#E4E9F5"
  crisis: "#D7263D"
  cat-teal: "#00A870"
  cat-indigo: "#3B5BDB"
  cat-amber: "#FF8A3D"
  cat-coral: "#FF4D6D"
  cat-violet: "#7C5CFF"
  cat-cyan: "#00B8D9"
  cat-lilac: "#A78BFA"
  cat-slate: "#64748B"
typography:
  display:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
    fontWeight: 600
  body:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontWeight: 400
  label:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontWeight: 500
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
---

# Design System: DatABA Manager

## Overview

Même grammaire que DatABA (« Terminal de Terrain ») : bleu foncé cadré, une
seule couleur d'accent réservée à l'action et à la sélection, thème clair et
sombre qui ne diffèrent que par leurs tokens de surface. Manager en reprend
les tokens à l'identique — jusqu'à `DESIGN.md` de DatABA fait foi pour les
deux applications, celui-ci l'adapte plutôt que de le réinventer.

Ce qui change, c'est le poste : DatABA est une tablette tenue à une main,
Manager un bureau, souris et clavier, écran large, avec de l'impression. La
mise en page en tient compte — pas la palette.

**Key Characteristics :**
- Accent unique par thème (charbon neutre en clair, bleu en sombre), utilisé
  pour l'action primaire, la sélection courante et la ligne active de la
  navigation — jamais en décoration.
- Palette catégorielle froide, fixe entre les deux thèmes, portée par les
  états d'acquisition (`ETATS`) et l'intensité de crise (`INTENSITES`), pas
  seulement par des courbes.
- Structure plate par défaut : bordure 1px, pas d'ombre au repos.
- Navigation latérale persistante plutôt que des onglets en haut — le poste
  a la place de garder les sept destinations visibles en permanence.

## Colors

### Primary
- **Accent** (`#4A4A4A` clair / `#5B8CFF` sombre par défaut) : boutons
  primaires, sélection courante, ligne active de la navigation, anneau de
  focus. Texte associé : `accent-ink` (`#FFFFFF` clair / `#071021` sombre).

### Deux axes : mode et couleur
Le thème se règle sur **deux attributs indépendants**, et il faut les garder
séparés :
- `data-theme` (`light` / `dark`) porte les **surfaces** — paper, card,
  border, ink, ink-soft, nav-bg. C'est le mode nuit, réglé depuis la pastille
  du rail de navigation.
- `data-accent` (absent, `rose`, `vert`, `jaune`, `rouge`) porte la
  **couleur** — et uniquement `--accent`, `--accent-ink`, `--accent-wash`.
  Réglé depuis la carte « Apparence » de l'onglet Gestion, pas depuis le
  rail : son pied porte déjà trois pastilles, et une quatrième déborde des
  64px du mode replié (piège documenté dans CLAUDE.md).

Les deux se combinent librement : cinq couleurs × deux modes, un seul jeu de
surfaces à maintenir. L'absence de `data-accent` vaut défaut — ce n'est pas
une valeur, c'est l'absence d'attribut.

`--accent-ink` se recalcule par couleur **et** par mode : c'est l'encre posée
sur l'accent, le seul token où le contraste peut casser. Un jaune clair
impose une encre sombre là où un rouge profond impose du blanc.

À l'impression, `@media print` fige les trois tokens d'accent sur le neutre
clair avec `!important` — `--accent-wash` compris, sans quoi le lavis coloré
des pastilles sélectionnées fuit sur le document.

**Réserve assumée sur le thème rouge.** `--crisis` porte les crises, les
erreurs de formulaire et les actions destructrices (voir Alerte ci-dessous).
Avec un accent rouge, le bouton primaire ressemble au bouton de purge. La
brique retenue (`#A63528` clair / `#F08A7C` sombre) est volontairement plus
sourde que le rouge d'alerte, ce qui atténue la confusion sans la supprimer :
l'écran Apparence le dit à l'utilisateur qui choisit cette couleur.

### Neutral
- **Ink** / **Ink Soft** / **Paper** / **Card** / **Border** / **Nav** :
  identiques à DatABA, mêmes valeurs, même bascule par `[data-theme]`.

### Alerte
- **Crisis** (`#D7263D` clair / `#FF5470` sombre) : crises, erreurs de
  formulaire, actions destructrices (purge, effacement). Un seul token pour
  les trois usages — pas un rouge figé qui se confondrait avec « non
  acquis », qui n'a jamais eu la même origine.

### Palette catégorielle (fixe, hors thème)
Reprise telle quelle de DatABA. Côté Manager, elle porte les états
d'acquisition plutôt que les types de cotation :
- **Teal** `#00A870` — Acquis.
- **Indigo** `#3B5BDB` — En cours d'acquisition.
- **Ambre** `#FF8A3D` — En plateau.
- **Corail** `#FF4D6D` — Non acquis.
- **Ardoise** `#64748B` — Sans cotation récente (dormant).
- **Lilas** `#A78BFA` — Suivi en mesure brute (occurrences, minutes —
  aucun seuil de pourcentage ne s'y applique).
- **Cyan** `#00B8D9` — Bientôt acquis (pas d'équivalent DatABA ; proche du
  teal sans s'y confondre).

Le contraste du texte sur un badge de cette palette n'est pas supposé blanc :
`texteLisibleSur(hex)` calcule le meilleur des deux par luminance relative
(portée de DatABA `src/App.jsx:57`) — un badge ambre ou lilas ne se lit pas
forcément en blanc.

**Cette palette ne bouge dans aucun thème de couleur.** Un thème rose ne
repeint pas « non acquis » : ces teintes portent du sens, pas de la
décoration. C'est ce qui permet à un thème d'être un choix de confort sans
conséquence sur la lecture des données.

### Séries des graphiques
Les graphiques puisent dans la même palette catégorielle, mais chaque
graphique doit rester lisible **par rapport à ses propres séries** — il n'y a
pas d'attribution unique valable partout :
- **Courbes d'objectifs** (`Graphique`) : série de données en indigo,
  tendance en violet, moyenne mobile en ambre, seuil d'acquisition en teal,
  moyenne et médiane en `ink-soft`. Rien n'y dépend de l'encre du texte —
  c'est le défaut qui rendait la tendance invisible sur les barres, l'une et
  l'autre étant tracées en `ink`.
- **Chronologie des crises** (`BlocsCrise`) : les séries occupent déjà
  `PALETTE_SERIES` (indigo, corail, ambre, teal, violet, cyan), donc les
  lectures superposées y restent en `ink` et `ink-soft` pointillés — le
  contraste tient puisque les barres, elles, sont colorées.
- **Graphiques du suivi continu** (`SuiviContinuVue`) : chaque série prend la
  couleur de son critère ou de son compteur — la couleur vient de la donnée,
  comme la pastille de la frise et de la répartition — sauf collision avec
  une couleur déjà prise dans la même sélection, où elle bascule sur
  `PALETTE_SERIES`. Chaque tendance reprend la couleur de **sa propre série**,
  en pointillé fin : avec plusieurs séries choisies librement (pas deux fixes
  comme dans `Graphique`), c'est l'appariement tendance↔courbe qui prime sur
  le contraste — une couleur de lecture unique ne dirait plus de laquelle
  chaque droite parle.

Ne pas « harmoniser » ces attributions : elles diffèrent pour une raison.

### Named Rules
Les deux règles nommées de DatABA s'appliquent ici à l'identique : **Règle
de l'Accent Seul** (l'accent ne sert qu'à l'action primaire et à la
sélection courante) et **Règle du Contraste par Thème** (un fond coloré
porte toujours son propre token de texte).

## Typography

Identique à DatABA : Space Grotesk (titres/boutons), IBM Plex Sans (texte),
IBM Plex Mono (libellés courts, chiffres, séances/crises comptées). Polices
embarquées (`src/polices/`, `@font-face` dans `src/index.css`) plutôt que
chargées depuis Google Fonts : nécessaire au hors-ligne, voir CLAUDE.md.

## Layout

Poste de bureau, souris et clavier : navigation latérale persistante (sept
destinations, repliable en rail d'icônes), largeur fluide plutôt qu'un
conteneur central borné — tableaux, graphiques et la vue Explorer prennent
la largeur disponible. Deux colonnes là où le travail est comparatif : liste
à gauche, détail à droite (écran Personnes, accord inter-observateurs).
Aucun balayage tactile : `useBalayage` a existé, il a été retiré avec le
passage à cette disposition, pas laissé en dormance.

Densité réglable (confort/compact) sur les listes les plus longues à
balayer — la liste des séances, pour l'instant ; les cibles tactiles larges
de DatABA n'ont pas de raison d'être ici.

## Elevation & Depth

Identique à DatABA : plat par défaut, ombre réservée à ce qui flotte
au-dessus du contenu (toast, palette de commande) — jamais à une carte ou un
champ statique.

## Shapes

Identiques à DatABA : `8px` / `12px` / `16px` / `9999px` selon la taille du
bloc, bordures toujours 1px.

## Components

### Buttons (`Btn`), Chips, Cards
Identiques à DatABA dans leur principe (voir son DESIGN.md) : accent plein
pour le primaire/sélectionné, contour ou fond carte pour le reste, aucune
ombre au repos.

### Navigation latérale (`NavigationLaterale`)
Remplace la barre du bas de DatABA — pas de sens à porter la pilule flottante
sur un écran large. Fond `nav-bg`, ligne active teintée `--accent-wash` avec
texte `--accent` (pas un remplissage plein : c'est une liste, pas des
onglets), repliable en rail d'icônes. Logo `logo-databamanager.png` en tête —
il porte déjà la mention « MANAGER » dans le fichier, pas de libellé texte
en plus dessous. En rail replié, les trois pastilles du pied (thème,
densité, déplier) s'empilent verticalement plutôt qu'en ligne : à 64px de
large, une rangée de trois déborde du cadre (`overflow-hidden` sur l'aside)
et rend le bouton qui déplie inatteignable — piège déjà rencontré, voir
CLAUDE.md.

### Palette de commande (`PaletteCommande`)
Seule fenêtre modale de Manager : `Ctrl`/`⌘+K` l'ouvre, `Échap` la ferme,
fond `--overlay-backdrop`. Recherche une personne par nom ou initiales.

### Focus et survol
Écart assumé côté DatABA (`DESIGN.md` : « pas de traitement dédié
aujourd'hui »). Pas ici : un poste au clavier appelle un anneau de focus
visible, dérivé de `--accent` (`:focus-visible` uniquement, jamais au clic
souris), et un survol discret sur tout bouton actif — assombri en clair,
éclairci en sombre, une seule règle CSS globale.

## Impression

Fonction centrale de Manager, absente de DatABA. Deux mécanismes, à ne
jamais mélanger (voir CLAUDE.md) :
- **Impression pleine page** (onglet Rapport) : tout ce qui porte `no-print`
  disparaît, y compris la navigation latérale.
- **Impression ciblée** (`imprimerZone`, bouton PDF) : marque les ancêtres
  du nœud visé jusqu'à `document.body`, masque leurs frères. Robuste à la
  profondeur du DOM — vérifié après chaque changement de structure (lots 8
  et 9 du chantier PC), pas seulement à la fin.
- Le thème sombre ne part jamais à l'imprimante : les tokens sont figés sur
  leurs valeurs claires sous `@media print`, avec `!important` — nécessaire
  puisque `:root[data-theme='dark']` a une spécificité plus élevée qu'un
  simple `:root`.
- `print-color-adjust: exact` posé sur `*` sous `@media print` : sans lui,
  les navigateurs n'impriment aucun fond ni couleur posés en style inline
  (économie d'encre par défaut). Un remplissage `backgroundColor` — piste et
  barre de `BarresCrise`, fond des badges d'état — sortait blanc sur blanc,
  alors qu'un graphique Recharts voisin (SVG, `fill`) s'imprimait
  correctement. Le symptôme (« seuls les nombres sortent, pas les barres »)
  ne trahit pas la cause si on ne sait pas que les deux mécanismes de
  couleur — fond CSS et remplissage SVG — ne se comportent pas pareil à
  l'impression.

## Document imprimé

Le document du rapport (`RapportScreen`, conteneur `.rounded-2xl border p-6`
de l'onglet Rapport) s'écarte volontairement de la typographie d'écran :
`F_DOC` (`'Cambria', 'Georgia', 'Times New Roman', serif`) plutôt que
`F_DISPLAY`/`F_BODY`, posé sur le conteneur et hérité par son contenu — un
bilan transmis à l'extérieur (Airmes) se lit dans un registre institutionnel,
pas dans celui d'un produit web. Les valeurs chiffrées et le code de
curriculum restent en `F_MONO`, comme partout ailleurs. Cambria/Georgia
plutôt que Calibri : présentes nativement sur tous les postes, sans police à
charger ni repli qui rendrait différemment selon l'imprimante.

Écart accepté : `BlocsCrise`, partagé avec l'écran Crises (voir CLAUDE.md, ne
jamais le forker), fixe `F_DISPLAY` sur un de ses sous-titres — ce fragment
reste donc en sans-serif même dans le document imprimé. Corriger demanderait
de sortir ce fragment de `BlocsCrise` ou de lui faire porter un paramètre de
police, pas de le dupliquer.

## Do's and Don'ts

Mêmes interdits que DatABA (voir son DESIGN.md), plus :
- **Do** garder `imprimerZone` et le mécanisme d'ancêtres pour toute nouvelle
  impression ciblée — jamais un conteneur `no-print` englobant le contenu à
  imprimer (pages blanches garanties, déjà arrivé).
- **Don't** réutiliser la palette catégorielle pour l'alerte crise ou une
  action destructrice : c'est `--crisis` qui porte ce rôle, un token réactif
  au thème, pas une couleur fixe.
