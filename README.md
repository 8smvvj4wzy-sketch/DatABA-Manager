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

## Fonctionner sans réseau

Une seule ouverture en ligne suffit : l'application enregistre alors sur ce
poste tout ce qu'il lui faut pour fonctionner ensuite sans réseau — y compris
ses polices, qui ne sont plus chargées depuis internet. Une nouvelle mise en
ligne de l'application redemande une ouverture en ligne, une seule, avant que
le hors-ligne fonctionne à nouveau, cette fois avec la nouvelle version.

L'onglet **Gestion** dit si le poste est prêt : carte « Hors ligne », sous
« Enregistrement sur ce poste ».

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
objectifs — chaque état portant son **écart avec la période de comparaison** —
et volume de crises avec sa tendance.

Vient ensuite **« À arbitrer »** : les situations qui appellent une décision,
classées. Une hausse nette de crises, une personne dont plus rien ne remonte, un
objectif qui stagne sous son seuil, un objectif jamais coté, un objectif qui
n'est plus coté. Chaque ligne énonce le fait et ses chiffres — « moyenne 62 %
sur les cinq dernières cotations, pour un seuil à 80 % » — puis mène là où on
peut le vérifier.

> Un objectif **bientôt acquis** n'y figure pas : une acquisition qui approche
> est une bonne nouvelle en cours de route, elle n'appelle aucune décision. Elle
> reste lisible dans les pastilles d'états, plus bas.

> Une personne dont plus aucune trace ne remonte apparaît **une seule fois**, et
> non une fois par objectif dormant : quinze lignes racontant la même absence
> noieraient le reste.

Enfin les objectifs, sous deux lectures au choix :

- **Par objectif** — **deux listes distinctes** : « Objectifs prioritaires » et
  « Autres objectifs travaillés », chacune avec son mini-graphique et son état
  (Bientôt, Plateau, En cours, Dormant). Quand des prioritaires existent, la
  seconde liste est repliée — un appui sur son titre la déplie.
- **Par personne** — une ligne par personne, **triable sur chaque colonne** :
  répartition des états en barre, objectifs acquis sur la période, objectifs à
  un pas de l'acquisition, crises avec leur écart, cotations et séances,
  dernière trace. Un bouton **PDF** imprime ce tableau seul, pour une réunion.

Un appui sur une ligne ouvre la fiche complète de la personne.

> Le tableau part de l'effectif, pas des cotations : une personne sans rien sur
> la période y figure avec ses compteurs à zéro. C'est précisément celle qu'on
> cherche. La **dernière trace** ne suit pas la période — elle remonte à la plus
> récente séance, crise ou relevé, même hors fenêtre.

**Séances** — la liste de tout ce qui a été importé, avec **recherche** (date,
personne, atelier) et tri par date ou par nombre de cotations. Un appui déplie
le **détail complet** de la séance : intervenant, durée, et pour chaque
personne ses objectifs cotés avec leur résultat et ses notes.

Un bouton **Retirer cette séance de l'analyse** la fait disparaître des
graphiques et des rapports de ce poste. Les cotations elles-mêmes ne sont pas
modifiables ici : la tablette reste la source. Réimporter une sauvegarde qui
contient cette séance la ramènera — c'est rappelé dans la confirmation.

Plus bas, l'**accord inter-observateurs**. Les paires sont repérées
automatiquement : deux séances du même jour, du même atelier, marquées « deux
observateurs en parallèle » dans DatABA et venues d'appareils différents.

Puis son complément : **« Objectifs cotés par un seul observateur »**. L'accord
inter-observateurs ne montre que les doubles cotations qui ont eu lieu ; cette
liste montre les séries où elle n'a jamais eu lieu — les objectifs dont toutes
les cotations portent le même intervenant, à partir de trois cotations.

> Compté sur toute la base, pas sur la période affichée. DatABA ne note qu'un
> intervenant par séance : c'est celui qui l'a ouverte qui compte, même si
> d'autres y sont intervenus. Un objectif dont l'intervenant n'est pas renseigné
> n'apparaît pas — ne pas savoir qui a coté n'est pas savoir qu'une seule
> personne l'a fait.

**Personnes accompagnées** — le suivi complet, avec quatre vues : **Bilan des
objectifs**, **Radar** (quels objectifs sont travaillés et à quel niveau),
**Crises** et **Suivi continu**. La période est ajustable partout.

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

Un **changement de phase** — passage de la ligne de base à l'intervention, puis
au maintien — trace une **verticale datée** portant le nom de la phase, comme
sur la courbe de la tablette. Elle se pose sur la première séance postérieure au
changement, la seule où elle est lisible. On la retrouve dans « Agrandir », dans
le PNG et dans le rapport imprimé, où la phase en cours s'affiche par ailleurs à
côté du critère. Une phase changée après la dernière séance de la période ne
trace rien : il n'y a pas encore de point à marquer.

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
dynamique, avec export CSV. Aux axes habituels (personne, atelier, intervenant,
objectif, jour de la semaine, semaine, mois…) s'ajoutent la **classe**, la
**tablette** d'origine et la **tranche horaire**, par pas de deux heures. Côté
mesures, le **temps d'accompagnement** cumule les durées de séance.

> Une séance dont la tablette n'a pas noté l'heure se range sous « Heure
> inconnue » plutôt que dans une tranche inventée : une date sans heure est lue
> par le navigateur comme minuit UTC, et la convertir donnerait deux heures du
> matin. Une séance non bornée ne compte pas dans le temps d'accompagnement —
> une durée non mesurée n'est pas une durée nulle. Une séance partagée compte
> une fois pour chaque participant : la somme d'une colonne peut donc dépasser
> le total général.

En bas du même onglet, la **lecture d'un rapport Excel** sans ouvrir Excel :
tri, filtres et recherche sur le fichier reçu. Elle reste accessible même si
aucune sauvegarde n'a encore été importée.

**Rapport** — le document à transmettre. Les objectifs y apparaissent en
**Acquis / En cours d'acquisition / Non acquis** — les nuances de travail
interne (plateau, dormant) n'ont pas leur place dans un document officiel — et
un objectif acquis porte **la date à laquelle son critère a été atteint**.
Graphiques optionnels, **commentaire libre sous chaque objectif**, et
**personnalisation des libellés** pour reprendre les termes exacts du projet
personnalisé.

Chaque objectif peut recevoir un **code EFL**, affiché en pastille devant son
intitulé dans le document. Le code est attaché à l'objectif, pas à la
personne : saisi une fois, il vaut pour toutes celles qui travaillent cette
compétence.

Le bouton **Composer un bilan des crises** bascule vers l'onglet Crises, où le
bilan se règle avec tous les filtres habituels. **Valider et revenir au
rapport** l'y attache ; il s'imprime à la suite des objectifs. Le rapport peut
ne contenir que ce bilan, sans aucun objectif.

**Rapports enregistrés.** Donnez un nom, enregistrez, et retrouvez la
composition plus tard pour la reprendre : personne, période, objectifs retenus
et réglages du bilan des crises.

> Seule la composition est conservée, pas les chiffres. Un rapport rouvert se
> recalcule sur les cotations du moment — c'est ce qu'on veut pour un bilan
> trimestriel qu'on reprend, mais cela signifie qu'il ne rejoue pas à
> l'identique un document déjà transmis. Réenregistrer sous le même nom
> remplace l'existant.

Logo et nom d'association en en-tête. Le bouton ouvre la fenêtre d'impression :
imprimante, ou « Enregistrer au format PDF » pour Airmes.

**Gestion** — import des sauvegardes DatABA (chiffrées ou non), export d'une ou
plusieurs personnes vers un autre poste Manager, **purge des données**, et
réglages de sécurité.

On y trouve aussi **« Remontées par tablette »** : pour chaque tablette, ce
qu'elle a envoyé — séances, crises, relevés — et **jusqu'à quand**. Une tablette
silencieuse depuis plus de trois semaines le dit en clair.

> La date lue est celle de la donnée la plus récente venue de cette tablette,
> pas celle du dernier import : c'est jusque-là que va ce qu'on sait d'elle.

## Le bilan des crises

L'onglet Crises **est** le composeur de bilan. Réglez-y les filtres — personnes,
type, période, regroupement, découpage, nombre ou durée cumulée, barres ou
courbes — puis, sous **Réglages du bilan → Modifier**, décochez les blocs qui
n'ont pas à figurer : les conséquences, les fonctions supposées, le jour de la
semaine… Deux raccourcis, **Tout inclure** et **Le minimum**.

Deux exports, qui ne donnent pas la même chose :

- **PNG du graphique** — l'image de la chronologie seule.
- **PDF du bilan** — le document complet, exactement ce qui est à l'écran, de
  l'évolution dans le temps jusqu'aux conséquences, avec en tête le rappel des
  réglages.

> Ce même bilan est celui qui s'attache à un rapport de personne : le rendu est
> partagé, ce qui est décoché ici est décoché là aussi.

## Exporter ce qui est à l'écran

**Fiche personne, vue Objectifs.** Choisissez le style de courbe, repliez celles
dont vous n'avez pas besoin, puis **PDF**. Seules les courbes restées visibles
sortent dans le document — c'est précisément à quoi sert le repli. Chaque courbe
garde par ailleurs son propre bouton **PNG**.

> Dans la fenêtre d'impression, choisissez votre imprimante, ou « Enregistrer au
> format PDF ». Les commandes, onglets et en-têtes d'écran ne s'impriment pas.

## Ce qui a été acquis, et quand

Un objectif est **acquis** quand son critère a été tenu le nombre de fois
demandé — trois séances à 80 %, par exemple. La **date de cette première
atteinte** est désormais retenue, ce qui permet de répondre à la question du
bilan : combien d'objectifs ont été acquis *pendant* cette période.

C'est ce que compte la colonne **Acquis** de la vue par personne, et ce n'est
pas la même chose que l'état « Acquis » : un objectif atteint en janvier le
reste toute l'année, mais il n'a été acquis qu'une fois. L'état, lui, se lit sur
la barre des états de la même ligne.

La date apparaît aussi dans le document du rapport, à côté du critère.

> C'est la **première** atteinte du critère sur les données présentes. Un
> objectif retombé puis réacquis garde sa première date. Et réimporter une
> sauvegarde plus complète peut la faire remonter dans le temps — même
> contrepartie que « le fichier importé gagne ».

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
