# Suivi ABA — cadres pédagogiques

Application web pour consolider et analyser les cotations remontées des
tablettes ABA. Fonctionne dans un navigateur, sans installation.

## Mise en ligne

Même procédure que pour l'application tablette : créez un dépôt GitHub
**public** (nécessaire pour l'hébergement gratuit), déposez le contenu de ce
dossier, activez **GitHub Pages** avec la source **GitHub Actions** dans les
paramètres du dépôt. La publication se fait ensuite automatiquement.

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

## À venir

Graphiques personnalisables, vue par personne avec temporalité ajustable, et
génération de documents PDF (rapports, bilans) avec logo de l'association,
pensés pour un export direct vers Airmes ou une impression.
