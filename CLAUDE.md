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

Tout tient dans `src/App.jsx` (~6 900 lignes). Assumé, ne pas proposer de
découpage sans que je le demande.

Données consolidées : un seul bloc JSON dans `localStorage`, chiffré, sous la
clé `aba-cadre:data`. Structure dans la constante `VIDE`.

Poste PC : navigation latérale persistante (`NavigationLaterale`, sept
destinations, repliable en rail), pas d'onglets ni de balayage tactile —
retiré, pas laissé en dormance. Tokens CSS (`src/index.css`) sur **deux axes
indépendants** posés sur `<html>` : `[data-theme]` pour les surfaces
(clair/sombre) et `[data-accent]` pour la couleur (absent, rose, vert, jaune,
rouge — il ne touche qu'à `--accent`, `--accent-ink`, `--accent-wash`).
Palette catégorielle fixe (`CAT_*`) pour les états d'acquisition et
l'intensité de crise : elle ne bouge dans aucun thème. Voir `DESIGN.md` avant
de toucher une couleur.

## Avant toute modification

Lire la zone concernée avant d'éditer — des fonctions en double sont déjà
apparues entre deux sessions. Éditer plutôt que régénérer.

## Avant toute livraison

```bash
./verifier.sh
```

Les 23 suites de `tests/` doivent rester vertes. Ne rien livrer sur un contrôle
rouge.

## Après chaque mise en ligne

**Incrémenter `CACHE_VERSION` dans `public/sw.js`.**

## Pièges connus

- **Collision de stockage.** Les deux applications partagent la même adresse
  `github.io` et le même `localStorage`. Un `localStorage.clear()` global ici a
  déjà effacé les données de production de la tablette. Toute suppression est
  bornée au préfixe `aba-cadre:`. Jamais de clear global — y compris pour toute
  nouvelle clé (les clés d'apparence, `aba-cadre:theme` et
  `aba-cadre:accent`, suivent la même règle).
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
- **Un relevé `kind: 'compteur'` n'est pas un état.** Les compteurs
  d'occurrence de DatABA (« demandes ») voyagent dans `suivi`, mêlés aux
  relevés d'état, mais un appui est ponctuel : il n'a ni axe, ni critère, ni
  durée jusqu'au suivant. `suiviDePersonne` les écarte, `compteursDePersonne`
  les prend, et rien de ce qui passe par `segmentsJournee` ne doit en voir.
  Les avoir laissés entrer donnait huit appuis « demandes » sous forme de sept
  segments d'une durée jamais observée, tous confondus sur un axe fantôme
  « Suivi retiré ». Leur nom vient de `students[].compteurs` à l'import, rangé
  dans `_compteurs` par source comme `_ateliers` — une nouvelle table par
  source doit être ajoutée aussi à la purge par source, à
  `construirePaquetExport` et au backup synthétique d'`integrerManager`.
- **Le fichier importé gagne.** `fusionnerParId` remplace un enregistrement
  déjà connu par sa version entrante — c'est ce qui fait remonter une séance
  re-cotée ou une crise complétée après coup. Contrepartie assumée :
  réimporter un fichier plus ancien que ce qui est consolidé fait régresser
  les enregistrements concernés, aucune date de version n'étant comparée.
- **`BlocsCrise` est partagé** entre l'écran et l'impression. Ne pas en créer
  une seconde version pour l'impression : deux blocs de rendu qui se
  ressemblent finissent par diverger, et c'est déjà arrivé — un bloc
  `{vue === 'x' && …}` écrit deux fois dans le même composant, d'où le
  contrôle de doublons de rendu de `verifier.sh`.
- **Impression.** Deux mécanismes, à ne pas confondre. Pleine page (onglet
  Rapport) : tout `no-print` disparaît, navigation latérale comprise.
  Ciblée (`imprimerZone`) : marque les ancêtres du nœud visé jusqu'à
  `document.body`, masque leurs frères — CSS par ancêtres, jamais un
  conteneur `no-print` englobant le contenu à imprimer (pages blanches
  garanties, déjà arrivé). Un changement de structure de page (navigation,
  colonnes) est le risque de régression n°1 : vérifier l'impression après
  coup, pas seulement en fin de chantier.
- **Ni le thème sombre ni la couleur d'accent ne partent à l'imprimante.** Les
  tokens sont figés sur leurs valeurs claires neutres sous `@media print` avec
  `!important` — nécessaire, `:root[data-theme='dark']` et
  `:root[data-accent='…']` ont une spécificité plus élevée qu'un simple
  `:root`. **Tout token d'accent ajouté doit être ajouté là aussi** :
  `--accent-wash` y manquait, et le lavis coloré des pastilles sélectionnées
  fuyait sur le document imprimé.
- **Couleur en dur hors de la palette catégorielle.** C'est la faute qui casse
  le thème sombre sans prévenir tant qu'on développe en clair. Les tokens de
  surface (`PAPER`, `INK`, `BORDER`…) sont des `var(--…)`, jamais un hex
  écrit en dur ; la palette `CAT_*` est le seul hex fixe légitime.
- **Les fonds colorés ne s'impriment pas tout seuls.** Un `backgroundColor`
  posé en style inline (piste de `BarresCrise`, badge d'état) sort blanc sur
  blanc à l'impression sans `print-color-adjust: exact` sous `@media print`
  — comportement par défaut des navigateurs (économie d'encre). Le SVG de
  Recharts n'est pas concerné (`fill`, pas un fond CSS) : un graphique et une
  barre du même écran peuvent donc se comporter différemment à l'impression,
  ce qui égare le diagnostic si on ne sait pas que ce sont deux mécanismes
  distincts.
- **Le rail replié a une largeur fixe de 64px avec `overflow-hidden`.**
  Toute pastille ajoutée au pied de `NavigationLaterale` (thème, densité,
  déplier…) doit s'empiler verticalement en mode replié — alignées en
  ligne, trois pastilles de 32px débordent déjà du cadre, et celui qui
  redéploie le rail peut sortir entièrement de la zone cliquable. Déjà
  arrivé : le rail devenait alors un cul-de-sac.
- **Le verrouillage ne doit réagir qu'à une absence prolongée, pas à une
  perte de focus.** Changer d'onglet ou de fenêtre est un geste normal sur
  un poste PC — verrouiller instantanément dès `visibilitychange` (hérité de
  la mise en veille des tablettes DatABA) redemande le mot de passe pour un
  simple aller-retour. La durée de l'absence se compare à
  `DELAI_VERROUILLAGE` (`doitVerrouillerAuRetour`), pas la seule perte de
  focus.

## Principes produit

Les outils de croisement montrent des pistes à vérifier, jamais des preuves de
causalité — un écart sur un atelier peut venir de l'heure à laquelle il est
programmé. La contrainte porte sur ce que l'outil calcule et sur la façon dont
il le présente, pas sur un texte à afficher : **aucun rappel d'interprétation
dans l'interface**. Les vues s'adressent à des cadres pédagogiques, à qui on
n'explique ni la différence entre corrélation et causalité, ni ce qu'est une
analyse fonctionnelle.

Les textes d'accompagnement restent, mais ils expliquent le **fonctionnement de
l'outil** : ce qu'une vue prend en compte, ce qu'elle écarte, comment un chiffre
est calculé, pourquoi une période vide n'apparaît pas. Jamais la méthode de
celui qui lit.
