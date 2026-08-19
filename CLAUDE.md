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

Tout tient dans `src/App.jsx` (~7 600 lignes). Assumé, ne pas proposer de
découpage sans que je le demande.

Données consolidées : un seul bloc JSON chiffré, dans **IndexedDB** (base
`aba-cadre`, table `bloc`, clé `data`), avec repli sur `localStorage`
(`aba-cadre:data`) quand IndexedDB est indisponible. Structure dans la
constante `VIDE`. Toute écriture passe par `sauverDonnees` — voir le piège
« Le bloc consolidé ne tient pas dans localStorage ».

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

Les 33 suites de `tests/` doivent rester vertes. Ne rien livrer sur un contrôle
rouge.

## Après chaque mise en ligne

Rien à faire à la main. `CACHE_VERSION` (`public/sw.js`) est dérivée du
contenu réel des fichiers produits par `npm run build`
(`scripts/precache.mjs`, injectée par `vite.config.js`) — elle change dès
qu'un fichier change, et seulement alors. Le bump manuel qu'elle remplaçait
était de toute façon insuffisant : voir le piège ci-dessous.

## Pièges connus

- **Collision de stockage.** Les deux applications partagent la même adresse
  `github.io` et le même `localStorage`. Un `localStorage.clear()` global ici a
  déjà effacé les données de production de la tablette. Toute suppression est
  bornée au préfixe `aba-cadre:`. Jamais de clear global — y compris pour toute
  nouvelle clé (les clés d'apparence, `aba-cadre:theme` et
  `aba-cadre:accent`, suivent la même règle). La base IndexedDB `aba-cadre`
  n'appartient qu'à Manager, mais la même règle vaut : jamais de
  `deleteDatabase` sur autre chose.
- **Le bloc consolidé ne tient pas dans `localStorage`.** Son quota est de
  ~5 Mo par origine, compté en UTF-16, et le bloc chiffré est du base64
  (≈ 1,33× le JSON) : quelques centaines de séances et les relevés de suivi
  continu de plusieurs tablettes le dépassent. `setItem` lève alors
  `QuotaExceededError` — que l'ancien code avalait en silence. L'import
  s'affichait, la session entière fonctionnait, rien n'était jamais écrit, et
  le poste rouvrait vide. D'où trois règles :
  1. **IndexedDB d'abord**, `localStorage` en repli et en migration seulement.
     Le doublon `localStorage` est retiré dès la première écriture IndexedDB
     réussie — deux copies, c'est une copie périmée qui ressuscite le jour où
     la bonne disparaît.
  2. **Toute écriture est relue avant d'être annoncée réussie**, et un échec
     remonte à l'écran (`BandeauStockage`, `CarteStockage`). Un `setItem` qui
     ne lève pas ne prouve rien : une session éphémère l'accepte puis ne rend
     rien. Côté IndexedDB, la réussite se lit sur `tx.oncomplete`, jamais sur
     `req.onsuccess` : un dépassement de quota laisse la requête réussir puis
     avorte la transaction.
  3. **Le bloc ne s'écrit que par `sauverDonnees`.** `retirerProtection`
     faisait son propre `setItem` et sautait ainsi repli et relecture.
     Contrôle « 2 octies » de `verifier.sh`.
  Les écritures y sont sérialisées : sans file, de deux `setDonnees`
  rapprochés le plus lent validait après le plus récent et remettait l'état
  précédent.
- **Une lecture ratée n'est pas un poste vide.** `chargerDonnees` rendait
  `VIDE` sur toute erreur, et l'effet d'enregistrement écrasait aussitôt le
  bloc encore intact par cet état vide : une lecture ratée détruisait les
  données. Elle rend maintenant `{ donnees, etat }` avec `etat` à `'vide'`
  (rien de stocké) ou `'illisible'` (un bloc existe, il n'a pas pu être lu) —
  et sur `'illisible'` toute écriture est suspendue, écran bloquant
  (`EcranBlocIllisible`). `tests/test_stockage.mjs` couvre les deux états, le
  quota, le repli, la migration et la sérialisation.
- **Le champ `source`.** Ici il désigne la tablette d'origine ; côté DatABA il
  désigne l'origine d'un relevé. Renommé `origine` à l'import, dans
  `fusionnerImport`. Toute nouvelle donnée importée qui porte un `source` doit
  passer par le même traitement.
- **Les purges doivent être exhaustives.** Une suppression par date, par source
  ou par personne doit atteindre *tous* les tableaux — séances, crises,
  relevés de suivi continu (`suivi` **et** `stabilite`) — **et tous les
  dictionnaires** : `alias`, `commentaires`, `objectifsSuivi`, `rapports`. Un
  tableau oublié laisse des données d'usager derrière une purge que
  l'utilisateur croit complète ; un dictionnaire oublié laisse des réglages
  orphelins qui ressuscitent sur quelqu'un d'autre au premier import ramenant
  les mêmes initiales. Les deux sont déjà arrivés — la purge par source ne
  nettoyait aucun dictionnaire, la purge par personne oubliait les rapports.
  `tests/test_purge.mjs` couvre les trois purges sur tous les tableaux et tous
  les dictionnaires.
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
- **Les cinq tables par source se complètent, elles ne se remplacent pas.**
  `_idVersInitiales`, `_ateliers`, `_intervenants`, `_compteurs`, `_axesSuivi`
  et `_guidances` fusionnent par identifiant à l'import, le fichier entrant
  gagnant sur une entrée déjà connue. `_axesSuivi` a été la dernière à
  remplacer : un second export de la même tablette ayant perdu un axe faisait
  basculer en « Suivi retiré » tous les relevés passés qui s'y rattachaient,
  alors qu'ils restaient bien en base. `_guidances` est le jeu de guidances de
  l'établissement (`backup.guidances`), repli d'`objectiveScoreValue` quand
  l'objectif ne porte pas son propre `config.guidanceSet` — sans lui, Manager
  retombait en dur sur le code `I` là où la tablette lit cette liste, et deux
  pourcentages divergeaient sans le dire dès qu'un établissement renommait son
  code d'indépendance.
- **`objectiveScoreValue` est un auxiliaire de `valeurCotation`, pas une
  fonction d'écran.** Il ne calcule que les modes dont le score est un
  pourcentage *direct* et rend `null` pour l'occurrence comme pour
  l'intervalle. L'appeler depuis un écran y fait disparaître ces deux modes
  sans le moindre signal : le détail d'une séance affichait « non coté » sur
  plus d'une cotation sur trois, la liste des séances sous-comptait toutes ses
  séances, et la table de faits sortait l'intervalle du taux d'autonomie —
  trois écrans à la fois, pendant que les 24 suites étaient vertes. **Toute
  lecture d'une cotation passe par `valeurCotation`**, qui rend une valeur
  *et son unité* ; le contrôle « 2 quater bis » de `verifier.sh` interdit
  désormais tout autre appel. Corollaire d'affichage : une valeur se montre
  avec son unité, jamais en pourcentage par défaut — un compteur à douze n'est
  pas un score de douze pour cent.
- **Un écran qui porte un sélecteur de période ne lit pas `lignes` brut.**
  `filtrerLignePeriode` d'abord, et tout ce que l'écran compte se compte sur le
  résultat. Le Tableau de bord lisait `lignes` pour ses sept pastilles et leur
  liste dépliée pendant que le reste de l'écran lisait `recentes` : à sept
  jours, cent objectifs annoncés en haut pour cinquante affichés en dessous, et
  un clic sur une pastille ouvrait des objectifs absents de la liste. Contrôle
  structurel dans `verifier.sh`, même section. Corollaire : le nombre de
  cotations d'une ligne est `points.length + mesures.length` — une ligne en
  mesure brute n'a pas de `points` et s'annonçait « 0 séance ».
- **Les trois natures de séance de DatABA, pour deux valeurs de `mode`.**
  `mode: 'balance'` est une séance Équilibre ; `mode: 'atelier'` **sans**
  `atelierId` est une séance libre ; avec, c'est une séance d'atelier.
  `nomAtelier` rend « Hors atelier » dès que l'identifiant est nul et
  confondait donc les deux premières — invisibles à la recherche, fondues dans
  la dimension Atelier d'Explorer. `libelleSeance` porte la règle une seule
  fois : liste, recherche, détail, table de faits, appariement IOA.
- **Le fichier importé gagne.** `fusionnerParId` remplace un enregistrement
  déjà connu par sa version entrante — c'est ce qui fait remonter une séance
  re-cotée ou une crise complétée après coup. Contrepartie assumée :
  réimporter un fichier plus ancien que ce qui est consolidé fait régresser
  les enregistrements concernés, aucune date de version n'étant comparée.
- **DatABA ne sait pas déclarer qu'un axe de suivi ou un compteur cote un
  objectif.** Le choix se fait ici (`donnees.objectifsSuivi`, par personne),
  et `lignesSuiviContinu` fabrique alors une ligne de la même forme que
  `construireLignes` en produit pour une séance. Piège d'identité :
  `objectif` est un nom, clé React, ancre DOM, clé d'alias et de commentaire —
  s'il coïncide avec un objectif déjà coté chez la même personne, il est
  suffixé (« (suivi continu) » / « (compteur) »), sinon deux lignes
  partageraient tout cela en silence. Sur les six consommateurs de `lignes`,
  quatre jetaient toute ligne sans `points` (une mesure brute n'y vit que dans
  `mesures`) — corrigé au Tableau de bord, à la fiche personne et dans
  `construireFaits`, laissé tel quel dans `RadarObjectifs` (échelle 0-100 en
  pourcentage, une mesure brute n'y a pas sa place). `mesures` n'était filtré
  par la période nulle part : `filtrerLignePeriode` centralise ce filtrage,
  les trois écrans doivent continuer à l'appeler plutôt que de refiltrer
  `points` seul.
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
- **Le hors-ligne ne se découvre pas à l'exécution.** `public/sw.js` ne peut
  pas deviner les noms hachés des fichiers compilés
  (`assets/index-XXXXXX.js`) : jusqu'à ce que ce piège soit corrigé, c'est
  `src/main.jsx` qui les découvrait après coup (`performance.getEntriesByType`)
  et les envoyait au service worker par `postMessage`. Deux défauts
  s'additionnaient. D'abord un ordre d'activation cassé :
  `self.skipWaiting()` était appelé avant tout précache, et `activate`
  supprimait sans condition tous les caches autres que le sien ; sur une mise
  en ligne, l'ancien service worker (encore actif le temps que la page
  réponde) écrivait la liste reçue dans SON cache, pendant que le nouveau,
  déjà activé, l'avait déjà supprimé — le cache effectivement servi ne
  contenait plus que la coquille, aucun `.js`, aucun `.css`. Ensuite un
  défaut structurel : la liste n'existant qu'à l'exécution, le hors-ligne ne
  pouvait jamais fonctionner à la première ouverture d'une version, seulement
  après une visite en ligne entière et réussie — sur un dépôt qui publie à
  chaque push (`.github/workflows/deploy.yml`), cette fenêtre ne s'ouvrait
  presque jamais. La liste des fichiers à précacher et la version de cache
  sont maintenant calculées par `scripts/precache.mjs` à partir des fichiers
  réellement produits, et injectées dans `dist/sw.js` par `vite.config.js` —
  la page n'a plus rien à dicter, seulement à interroger (`CarteHorsLigne`,
  écran Gestion). Tout nouveau fichier servi à l'exécution doit entrer dans
  cette liste au build, jamais dans un message envoyé après coup — et les
  polices (`src/polices/`) sont embarquées pour la même raison : une police
  chargée depuis `fonts.googleapis.com` n'est plus servable dès que le
  navigateur n'en a pas déjà sa propre copie en cache HTTP.
  `tests/test_horsligne.mjs` rejoue la régression (ordre `skipWaiting`,
  purge conditionnelle à l'activation, réponses hors ligne) sur un faux
  service worker ; `verifier.sh` (section « 4. Hors ligne ») construit
  réellement le projet et vérifie que rien, dans `dist/`, ne dépend plus du
  réseau.

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
