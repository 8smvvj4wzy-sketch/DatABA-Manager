# DatABA Manager

Application web pour consolider et analyser les cotations remontées des
tablettes ABA. Fonctionne dans un navigateur, sans installation.

## Mise en ligne

Même procédure que pour l'application tablette : créez un dépôt GitHub
**public** (nécessaire pour l'hébergement gratuit), déposez le contenu de ce
dossier, activez **GitHub Pages** avec la source **GitHub Actions** dans les
paramètres du dépôt. La publication se fait ensuite automatiquement.

## Sécurité

Au premier lancement, l'application demande de créer un mot de passe. Il
verrouille l'accès et **chiffre les données consolidées** sur cet ordinateur.
Verrouillage automatique à la mise en veille et après 15 minutes d'inactivité,
blocage progressif après plusieurs essais erronés.

> Le mot de passe perdu, les données consolidées ne sont pas récupérables. Ce
> n'est pas dramatique ici : il suffit de tout effacer et de réimporter les
> sauvegardes depuis le dossier partagé.

## Installer sur PC

Une fois en ligne, ouvrez l'adresse dans **Chrome** ou **Edge** : une icône
d'installation apparaît dans la barre d'adresse (ou menu **⋮ → Installer
l'application…**). L'app s'ouvre ensuite dans sa propre fenêtre, avec une
icône sur le bureau, sans dépendre d'un onglet de navigateur resté ouvert.

## Utilisation

1. Un éducateur exporte une sauvegarde chiffrée depuis la tablette
   (**Gestion → Sauvegarde → Exporter**) et la dépose sur SharePoint.
2. Le cadre récupère le fichier, l'importe ici avec le mot de passe transmis.
3. Les séances déjà connues sont ignorées, les nouvelles s'ajoutent — sans
   jamais dupliquer.
4. L'onglet **Bilan** classe chaque objectif de chaque personne en Acquis, En
   cours d'acquisition, ou Non acquis, selon le critère défini pour cet
   objectif sur la tablette.

Les personnes provenant de tablettes différentes sont rapprochées par leurs
**initiales**. Deux personnes qui partageraient exactement les mêmes initiales
sur deux tablettes distinctes seraient à tort confondues — à éviter en
harmonisant les initiales entre tablettes si le cas peut se présenter.

## Les quatre onglets

**Importer** — charge une sauvegarde DatABA. Le format est reconnu au contenu :
chiffrée, la clé est demandée ; en clair, l'import est immédiat. Un rapport
Excel présenté par erreur est refusé avec l'explication de quel fichier
utiliser.

**Tableau de bord** — la situation d'un coup d'œil : répartition des objectifs
en Acquis / En cours d'acquisition / Non acquis, et volume de crises sur
30 jours avec sa tendance, le comportement et l'antécédent les plus fréquents.
La liste détaillée reste filtrable par état.

**Accord observateurs** — les paires de relevés sont repérées automatiquement :
deux séances du même jour, du même atelier, marquées « deux observateurs en
parallèle » dans DatABA et venues d'appareils différents. Sélectionnez-en une
pour obtenir le pourcentage d'accord, global et objectif par objectif.

**Par personne** — une courbe par objectif, avec **quatre styles de graphique**
(courbe, barres, aire, points) et une **fenêtre temporelle** au choix : 30 jours,
3 mois, 6 mois, 1 an ou tout l'historique. Le seuil d'acquisition apparaît en
pointillé.

**Document** — compose un bilan imprimable, avec le **logo de l'association** et
son nom en en-tête, pour une personne ou pour toutes. Le bouton ouvre la fenêtre
d'impression du navigateur : choisissez votre imprimante, ou « Enregistrer au
format PDF » pour obtenir un fichier à déposer dans Airmes. Logo et nom sont
conservés d'une session à l'autre.

## Mise à jour

Après chaque mise en ligne, incrémentez `CACHE_VERSION` dans `public/sw.js`,
puis fermez et rouvrez l'application.
