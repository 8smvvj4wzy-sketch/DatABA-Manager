# DatABA Manager

Application web de consolidation et d'analyse des cotations DatABA, pour les
cadres pédagogiques. Fonctionne dans un navigateur, sans installation.

## Sécurité

Au premier lancement, l'application demande de créer un mot de passe. Il
verrouille l'accès et **chiffre les données consolidées** sur cet ordinateur.
Verrouillage automatique à la mise en veille et après 15 minutes d'inactivité,
blocage progressif après plusieurs essais erronés. Le mot de passe se modifie
ou se retire depuis l'onglet Gestion.

> Le mot de passe perdu, les données consolidées ne sont pas récupérables. Ce
> n'est pas dramatique : il suffit de tout effacer et de réimporter les
> sauvegardes depuis le dossier partagé.

## Installer sur PC

Ouvrez l'adresse dans **Chrome** ou **Edge** : une icône d'installation apparaît
dans la barre d'adresse (ou menu **⋮ → Installer l'application…**).

## Choisir la période

Trois façons de définir la fenêtre d'observation, disponibles partout :

- **Raccourci** — 7 jours, 30 jours, 3 mois, 6 mois, 1 an, ou tout.
- **Dates précises** — au jour près, avec date de début et de fin.
- **Mois calendaires** — « de septembre à janvier ». Le mois de fin est inclus
  en entier, y compris le 29 février d'une année bissextile.

Sur les vues qui agrègent, un réglage supplémentaire permet de **regrouper par
jour, par semaine ou par mois**.

Les analyses s'affichent au choix **en nombre ou en pourcentage**.

## Les sept onglets

**Tableau de bord** — l'avancée récente sur la période choisie. Répartition des
objectifs, volume de crises avec sa tendance, puis **deux listes distinctes** :
« Objectifs prioritaires » et « Autres objectifs travaillés », chacune avec son
mini-graphique et son état (Bientôt, Plateau, En cours, Dormant). Quand des
prioritaires existent, la seconde liste est repliée — un appui sur son titre la
déplie. Un appui sur une ligne ouvre la fiche complète de la personne.

**Séances** — la liste de tout ce qui a été importé, avec **recherche** (date,
personne, atelier) et tri par date ou par nombre de cotations. Un appui déplie
le **détail complet** de la séance : intervenant, durée, et pour chaque
personne ses objectifs cotés avec leur résultat, ses notes et son temps de
renforcement.

Un bouton **Retirer cette séance de l'analyse** la fait disparaître des
graphiques et des rapports de ce poste. Les cotations elles-mêmes ne sont pas
modifiables ici : la tablette reste la source. Réimporter une sauvegarde qui
contient cette séance la ramènera — c'est rappelé dans la confirmation.

Plus bas, l'**accord inter-observateurs**. Les paires sont repérées
automatiquement : deux séances du même jour, du même atelier, marquées « deux
observateurs en parallèle » dans DatABA et venues d'appareils différents.

**Personnes accompagnées** — le suivi complet, avec six vues : Objectifs,
Bilan, **Radar** (quels objectifs sont travaillés et à quel niveau), Crises,
Renforcement, Croisement autonomie/crises. La période est ajustable partout.

En haut de la fiche, un **aperçu des crises** de la période : les occurrences
seules, en barres, avec une **courbe de tendance** et la mention « en hausse »
ou « en baisse » quand l'évolution est nette. Un appui bascule vers l'onglet
Crises, déjà filtré sur cette personne.

Dans la vue Objectifs, chaque courbe porte trois commandes : **Replier** (pour
se concentrer sur les autres), **Agrandir** (une courbe dense est illisible en
petit) et **PNG** pour l'enregistrer en image et la coller dans un compte rendu.

> L'image exportée reprend le graphique tel qu'il est affiché, en double
> résolution pour rester net à l'impression. Les polices du site n'y sont pas
> embarquées : les étiquettes sortent dans une police système approchante.

Deux boutons de rapport : **Générer un rapport** reprend la personne, ses
objectifs et la période ; **Rapport de crise** ouvre le même document centré
sur le bilan des crises.

**Crises** — d'abord une **chronologie** : l'évolution au fil du temps, en
barres empilées ou en courbes, regroupée par jour, semaine ou mois. Un
sélecteur **« Découper par »** transforme chaque dimension en séries —
intensité, personne, atelier, antécédent, comportement, conséquence, fonction
supposée — comme les segments d'un tableau croisé dynamique. Un bouton **PNG**
enregistre le graphique en image.

Une bascule **« Mesurer »** choisit ce que compte le graphique : le **nombre**
d'enregistrements, ou la **durée cumulée** en minutes. Les deux ne racontent pas
la même chose — une semaine peut compter peu de crises mais très longues.

La carte de synthèse affiche la **durée cumulée**, la **durée moyenne** et la
**plus longue**. La moyenne ne porte que sur les enregistrements réellement
chronométrés : une observation ABC n'a pas de durée, et l'inclure tirerait la
moyenne vers zéro.

Viennent ensuite les répartitions d'ensemble : **occurrences par intensité**,
puis par **jour de la semaine**, **atelier**, **antécédent**, **comportement**
et **conséquence**.

Le tout filtrable **par personne** et par type (crises, observations, les deux),
lisible en nombre ou en pourcentage. Accessible aussi d'un appui sur la carte
Crises du tableau de bord.

> Les dimensions à valeurs multiples — antécédents, comportements, conséquences —
> font qu'une même crise compte dans plusieurs séries : le total empilé dépasse
> alors le nombre de crises. C'est signalé sous le graphique. Au-delà de six
> séries, les moins fréquentes sont réunies sous « Autres », sans qu'aucune
> crise ne soit perdue.

**Explorer** — le croisement libre de deux axes, comme un tableau croisé
dynamique, avec export CSV. En bas du même onglet, la **lecture d'un rapport
Excel** sans ouvrir Excel : tri, filtres et recherche sur le fichier reçu. Elle
reste accessible même si aucune sauvegarde n'a encore été importée.

**Rapport** — le document à transmettre. Les objectifs y apparaissent en
**Acquis / En cours d'acquisition / Non acquis** — les nuances de travail
interne (plateau, dormant) n'ont pas leur place dans un document officiel.
Graphiques optionnels, **commentaire libre sous chaque objectif**, et
**personnalisation des libellés** pour reprendre les termes exacts du projet
personnalisé.

Chaque objectif peut recevoir un **code EFL**, affiché en pastille devant son
intitulé dans le document. Le code est attaché à l'objectif, pas à la
personne : saisi une fois, il vaut pour toutes celles qui travaillent cette
compétence.

Un interrupteur **Inclure un bilan des crises** ajoute au document, pour la
personne et la période retenues : le nombre de crises et d'observations,
l'intensité moyenne, les durées, une chronologie par intensité avec sa
tendance, et les trois antécédents, comportements et conséquences les plus
fréquents. Le rapport peut ne contenir que ce bilan, sans aucun objectif.

Logo et nom d'association en en-tête. Le bouton ouvre la fenêtre d'impression :
imprimante, ou « Enregistrer au format PDF » pour Airmes.

**Gestion** — import des sauvegardes DatABA (chiffrées ou non), export d'une ou
plusieurs personnes vers un autre poste Manager, **purge des données**, et
réglages de sécurité.

## Exporter ce qui est à l'écran

Deux endroits permettent d'exporter directement le réglage en cours, sans
passer par l'onglet Rapport.

**Onglet Crises.** Réglez la chronologie — personnes, type, regroupement,
découpage, nombre ou durée cumulée, barres ou courbes — puis **PNG** pour une
image, ou **PDF** pour un document. Le document reprend le titre, la période et
le rappel des réglages : une chronologie sortie de son contexte ne dit ni sur
qui elle porte, ni ce qu'elle compte.

**Fiche personne, vue Objectifs.** Choisissez le style de courbe, repliez celles
dont vous n'avez pas besoin, puis **PDF**. Seules les courbes restées visibles
sortent dans le document — c'est précisément à quoi sert le repli. Chaque courbe
garde par ailleurs son propre bouton **PNG**.

> Dans la fenêtre d'impression, choisissez votre imprimante, ou « Enregistrer au
> format PDF ». Les commandes, onglets et en-têtes d'écran ne s'impriment pas.

## Objectifs suivis en mesure

Quatre types de cotation ne produisent pas de pourcentage : **occurrence,
timer, intervalle, latence**. Ils sont suivis dans leur unité propre —
occurrences, minutes, secondes, part du niveau cible.

Ces objectifs portent l'état **Suivi en mesure**. Ils n'apparaissent plus comme
« Non acquis », ce qu'ils n'étaient pas : ils n'avaient simplement pas
d'échelle en pourcentage à comparer au seuil d'acquisition.

Leur lecture se fait sur deux chiffres :

- la **moyenne par jour** — plusieurs cotations le même jour sont ramenées à une
  seule valeur, sinon un jour chargé pèserait plus lourd qu'un autre ;
- l'**évolution en pourcentage** de cette moyenne sur la période, lue sur la
  droite de tendance et non sur le premier et le dernier jour, pour qu'une
  journée exceptionnelle ne renverse pas le sens annoncé.

> En dessous de cinq jours de relevé, aucune progression n'est chiffrée : un
> pourcentage calculé sur trois points donnerait un chiffre à du bruit. La
> moyenne reste affichée.

> Une moyenne de départ nulle n'a pas de pourcentage — c'est une division par
> zéro. L'évolution est alors donnée sous la forme « 0 → 4 occurrences ».

Pour la latence, une hausse n'est pas un progrès : la couleur de l'évolution
suit le sens de l'objectif, pas le signe du pourcentage.

## Purger les données

Quatre niveaux, dans l'onglet Gestion :

- **Séances antérieures à une date** — avec le décompte avant de valider.
- **Une source entière** — tout ce qui vient d'une tablette. Une personne qui
  n'apparaît plus sur aucune autre source disparaît aussi.
- **Une personne** — ses crises, libellés et commentaires partent avec elle.
  Dans une séance partagée, seules **ses** cotations sont retirées : la séance
  et les autres participants sont conservés.
- **Tout** — après deux confirmations.

> Les suppressions sont définitives et ne concernent que ce poste. Les tablettes
> gardent leurs propres données : une réimportation depuis le dossier partagé
> reste toujours possible.

Pour retirer **une seule séance** — une cotation d'essai, un doublon — passez
par l'onglet Séances plutôt que par une purge : dépliez la séance et utilisez
**Retirer cette séance de l'analyse**.

## Rapprochement des personnes

Les personnes venant de tablettes différentes sont rapprochées par leurs
**initiales**. Deux personnes partageant exactement les mêmes initiales sur
deux tablettes distinctes seraient à tort confondues — à éviter en harmonisant
les initiales entre tablettes si le cas peut se présenter.

## Mise à jour

Après chaque mise en ligne, incrémentez `CACHE_VERSION` dans `public/sw.js`,
puis fermez et rouvrez l'application.
