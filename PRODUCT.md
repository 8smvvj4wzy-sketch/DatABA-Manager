# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cadres pédagogiques (coordinateurs, chefs de service) en établissement
médico-social, qui pilotent le suivi de plusieurs personnes accompagnées à
partir des données remontées par les éducateurs sur DatABA. Ils travaillent
assis, à un poste fixe ou un ordinateur portable, souris et clavier — hors
situation d'intervention.

## Product Purpose

Consolider les exports chiffrés de plusieurs tablettes DatABA en un seul
tableau de bord, calculer les états d'acquisition par objectif, croiser
séances/crises/ateliers pour repérer des pistes à vérifier, et produire des
bilans imprimables ou transmissibles (Airmes). L'application sœur DatABA
s'adresse aux éducateurs pour la cotation en séance ; les deux échangent
uniquement par fichier JSON chiffré, jamais par serveur partagé.

## Positioning

Deux mécanismes qu'un concurrent ne peut pas copier sans changer la nature du
produit :

- **Zéro-serveur, chiffrement local.** Les données consolidées ne quittent
  jamais ce poste hors export explicite chiffré : pas de compte, pas de
  cloud, pas de sous-traitant hébergeur, pas de collecte de PII (initiales
  uniquement). Même garantie structurelle que DatABA.
- **Séparation terrain / pilotage.** DatABA (cotation en séance) et DatABA
  Manager (consolidation, bilans) sont deux applications distinctes qui
  échangent par fichier JSON chiffré. Aucune donnée comportementale ne
  transite par un serveur partagé entre les deux usages.

## Operating Context

Poste de bureau, écran large, souvent plusieurs sauvegardes de tablettes
différentes importées au fil des semaines. Sept destinations dans une
navigation latérale persistante (Tableau de bord, Séances, Personnes
accompagnées, Crises, Explorer, Rapport, Gestion). Le travail est de
consultation et de comparaison — pas de cotation en temps réel — donc pas de
contrainte de vitesse de saisie comparable à DatABA ; en revanche
l'impression (bilans, PDF ciblés) est une fonction centrale, absente de
DatABA.

## Capabilities and Constraints

- Fonctionne hors ligne après la première ouverture (PWA, service worker).
- Import de sauvegardes DatABA (format `aba-backup`, chiffrées ou en clair),
  fusion multi-tablettes par déduplication d'identifiants, alias de
  compatibilité pour les formats antérieurs (`groupes`→`classes`,
  `stabilite`→`suivi`) tant que des tablettes n'ont pas migré.
- Verrouillage par mot de passe qui chiffre aussi les données consolidées ;
  pas de tolérance d'usage sans protection au-delà de ce que l'utilisateur
  choisit explicitement (option « désactiver la protection »).
- Export Excel avec tri et filtres, export PDF ciblé (une zone à l'écran) en
  plus du rapport complet.
- Contrainte technique délibérée : tout le code applicatif tient dans un
  seul fichier `src/App.jsx`, pas d'outillage de build modulaire local — même
  logique que DatABA, voir CLAUDE.md pour la justification.
- Piège connu : DatABA et DatABA Manager partagent le même `localStorage`
  sous la même adresse `github.io` ; toute suppression de données doit rester
  bornée au préfixe `aba-cadre:` (jamais de clear global) et atteindre *tous*
  les tableaux concernés (séances, crises, suivi continu) — une purge
  partielle a déjà laissé des données d'usager derrière une suppression
  qu'on croyait complète.

## Brand Commitments

Nom du produit : DatABA Manager (application sœur : DatABA). Aucune identité
visuelle de marque externe imposée à ce jour.

## Evidence on Hand

Les personnes accompagnées sont identifiées par initiales uniquement (ex.
« J.D. ») — aucun nom, date de naissance ou adresse. À ne pas fabriquer dans
un contenu de démonstration ou de maquette.

## Product Principles

- Aucune donnée sensible ne quitte le poste sans export explicite et
  chiffré.
- Les outils de croisement montrent des pistes à vérifier, jamais des
  preuves de causalité — un écart sur un atelier peut venir de l'heure à
  laquelle il est programmé. Le texte d'accompagnement le dit à chaque vue,
  et plus encore pour un croisement par intervenant : il se lit vite comme
  une évaluation de professionnel, ce qu'il n'est pas.
- Pas de listes de vérification de fidélité procédurale embarquées :
  la supervision humaine du programme d'intervention ne se remplace pas par
  des cases à cocher — même principe que DatABA.
- Un seul fichier applicatif assumé : pas de fragmentation en modules sans
  demande explicite.
- Une purge de données doit être exhaustive ou ne pas prétendre l'être :
  mieux vaut un tableau explicitement non couvert qu'un tableau oublié en
  silence.

## Accessibility & Inclusion

Poste de bureau, clavier et souris : anneau de focus visible et navigation
au clavier sont attendus, contrairement à DatABA (écart assumé côté
tablette). Aucune exigence d'accessibilité normée (WCAG, RGAA) formellement
documentée à ce jour au-delà de ce traitement du focus.
