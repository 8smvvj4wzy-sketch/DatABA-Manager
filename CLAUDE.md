# DatABA Manager — poste des cadres pédagogiques

Application React de consolidation et d'analyse des données remontées par les
tablettes DatABA (dépôt séparé). Elle importe des fichiers JSON chiffrés,
fusionne plusieurs sources, et produit rapports et bilans. `DESIGN.md` et
`PRODUCT.md` font foi pour l'identité visuelle et le cadre produit — ce fichier
ne couvre que les conventions de code et les pièges.

## Réponses

En français. Direct et techniquement précis. Les limites et les compromis se
disent, ils ne se lissent pas.

## Architecture

Tout tient dans `src/App.jsx` (~4 900 lignes). Assumé, ne pas proposer de
découpage sans que je le demande.

Données consolidées : un seul bloc JSON dans `localStorage`, chiffré, sous la
clé `aba-cadre:data`. Structure dans la constante `VIDE`.

Poste PC : navigation latérale persistante (`NavigationLaterale`, sept
destinations, repliable en rail), pas d'onglets ni de balayage tactile —
retiré, pas laissé en dormance. Tokens CSS (`src/index.css`, `[data-theme]`
sur `<html>`) pour le thème clair/sombre ; palette catégorielle fixe
(`CAT_*`) pour les états d'acquisition et l'intensité de crise. Voir
`DESIGN.md` avant de toucher une couleur.

## Avant toute modification

Lire la zone concernée avant d'éditer — des fonctions en double sont déjà
apparues entre deux sessions. Éditer plutôt que régénérer.

## Avant toute livraison

```bash
./verifier.sh
```

Les 14 suites de `tests/` doivent rester vertes. Ne rien livrer sur un contrôle
rouge.

## Après chaque mise en ligne

**Incrémenter `CACHE_VERSION` dans `public/sw.js`.**

## Pièges connus

- **Collision de stockage.** Les deux applications partagent la même adresse
  `github.io` et le même `localStorage`. Un `localStorage.clear()` global ici a
  déjà effacé les données de production de la tablette. Toute suppression est
  bornée au préfixe `aba-cadre:`. Jamais de clear global — y compris pour toute
  nouvelle clé (la clé de thème, `aba-cadre:theme`, suit la même règle).
- **Le champ `source`.** Ici il désigne la tablette d'origine ; côté DatABA il
  désigne l'origine d'un relevé. Renommé `origine` à l'import, dans
  `fusionnerImport`. Toute nouvelle donnée importée qui porte un `source` doit
  passer par le même traitement.
- **Les purges doivent être exhaustives.** Une suppression par date, par source
  ou par personne doit atteindre *tous* les tableaux — séances, crises,
  relevés de suivi continu (`suivi` **et** `stabilite`). Un tableau oublié
  laisse des données d'usager derrière une purge que l'utilisateur croit
  complète. C'est déjà arrivé ; `tests/test_purge.mjs` couvre les trois purges
  sur les trois tableaux.
- **`suivi` prime sur `stabilite`, jamais les deux.** Un fichier v4 contient
  les mêmes relevés dans les deux clés (alias de compatibilité côté DatABA) ;
  les additionner les dupliquerait. `fusionnerImport` regarde si `backup.suivi`
  est défini (même vide) avant de retomber sur `backup.stabilite`.
- **`BlocsCrise` est partagé** entre l'écran et l'impression. Ne pas en créer
  une seconde version pour l'impression : c'est exactement ce qui a produit le
  doublon de la vue Renforcement.
- **Impression.** Deux mécanismes, à ne pas confondre. Pleine page (onglet
  Rapport) : tout `no-print` disparaît, navigation latérale comprise.
  Ciblée (`imprimerZone`) : marque les ancêtres du nœud visé jusqu'à
  `document.body`, masque leurs frères — CSS par ancêtres, jamais un
  conteneur `no-print` englobant le contenu à imprimer (pages blanches
  garanties, déjà arrivé). Un changement de structure de page (navigation,
  colonnes) est le risque de régression n°1 : vérifier l'impression après
  coup, pas seulement en fin de chantier.
- **Le thème sombre ne doit jamais partir à l'imprimante.** Les tokens sont
  figés sur leurs valeurs claires sous `@media print` avec `!important` —
  nécessaire, `:root[data-theme='dark']` a une spécificité plus élevée qu'un
  simple `:root`.
- **Couleur en dur hors de la palette catégorielle.** C'est la faute qui casse
  le thème sombre sans prévenir tant qu'on développe en clair. Les tokens de
  surface (`PAPER`, `INK`, `BORDER`…) sont des `var(--…)`, jamais un hex
  écrit en dur ; la palette `CAT_*` est le seul hex fixe légitime.

## Principes produit

Les outils de croisement montrent des pistes à vérifier, jamais des preuves de
causalité — un écart sur un atelier peut venir de l'heure à laquelle il est
programmé. Le texte d'accompagnement doit le dire, à chaque vue.
