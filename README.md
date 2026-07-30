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

## Les cinq onglets

**Tableau de bord** — l'avancée récente sur la période choisie. Répartition des objectifs, volume de crises
avec sa tendance, et la liste des objectifs prioritaires avec un mini-graphique
et leur état : Bientôt, Plateau, En cours, Dormant. Un appui ouvre la fiche
complète de la personne concernée.

**Séances** — les séances les plus cotées, et l'accord inter-observateurs. Les
paires sont repérées automatiquement : deux séances du même jour, du même
atelier, marquées « deux observateurs en parallèle » dans DatABA et venues
d'appareils différents.

**Personnes** — le suivi complet, avec cinq vues : Objectifs (courbes, quatre
styles au choix), Bilan, **Radar** (quels objectifs sont travaillés et à quel
niveau), Crises, Croisement autonomie/crises. La période est ajustable partout.
Un bouton **Générer un rapport** reprend la personne, ses objectifs et la
période en cours.

**Crises** — les répartitions en graphiques : **occurrences par intensité**,
puis par **jour de la semaine**, **atelier**, **antécédent**, **comportement** et
**conséquence**. Filtrable par type (crises, observations, les deux), lisible en
nombre ou en pourcentage. Accessible aussi d'un appui sur la carte Crises du
tableau de bord.

**Rapport** — le document à transmettre. Les objectifs y apparaissent en
**Acquis / En cours d'acquisition / Non acquis** — les nuances de travail
interne (plateau, dormant) n'ont pas leur place dans un document officiel.
Graphiques optionnels, **commentaire libre sous chaque objectif**, et
**personnalisation des libellés** pour reprendre les termes exacts du projet
personnalisé. Logo et nom d'association en en-tête. Le bouton ouvre la fenêtre
d'impression : imprimante, ou « Enregistrer au format PDF » pour Airmes.

**Gestion** — import des sauvegardes DatABA (chiffrées ou non), export d'une ou
plusieurs personnes vers un autre poste Manager, **purge des données**,
**lecture d'un rapport Excel** sans ouvrir Excel, et réglages de sécurité.

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

## Rapprochement des personnes

Les personnes venant de tablettes différentes sont rapprochées par leurs
**initiales**. Deux personnes partageant exactement les mêmes initiales sur
deux tablettes distinctes seraient à tort confondues — à éviter en harmonisant
les initiales entre tablettes si le cas peut se présenter.

## Mise à jour

Après chaque mise en ligne, incrémentez `CACHE_VERSION` dans `public/sw.js`,
puis fermez et rouvrez l'application.
