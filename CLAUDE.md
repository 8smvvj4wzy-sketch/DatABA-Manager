# DatABA Manager — poste des cadres pédagogiques

Application React de consolidation et d'analyse des données remontées par les
tablettes DatABA (dépôt séparé). Elle importe des fichiers JSON chiffrés,
fusionne plusieurs sources, et produit rapports et bilans.

## Réponses

En français. Direct et techniquement précis. Les limites et les compromis se
disent, ils ne se lissent pas.

## Architecture

Tout tient dans `src/App.jsx` (~4 350 lignes). Assumé, ne pas proposer de
découpage sans que je le demande.

Données consolidées : un seul bloc JSON dans `localStorage`, chiffré, sous la
clé `aba-cadre:data`. Structure dans la constante `VIDE`.

## Avant toute modification

Lire la zone concernée avant d'éditer — des fonctions en double sont déjà
apparues entre deux sessions. Éditer plutôt que régénérer.

## Avant toute livraison

```bash
./verifier.sh
```

Les 11 suites de `tests/` doivent rester vertes. Ne rien livrer sur un contrôle
rouge.

## Après chaque mise en ligne

**Incrémenter `CACHE_VERSION` dans `public/sw.js`.**

## Pièges connus

- **Collision de stockage.** Les deux applications partagent la même adresse
  `github.io` et le même `localStorage`. Un `localStorage.clear()` global ici a
  déjà effacé les données de production de la tablette. Toute suppression est
  bornée au préfixe `aba-cadre:`. Jamais de clear global.
- **Le champ `source`.** Ici il désigne la tablette d'origine ; côté DatABA il
  désigne l'origine d'un relevé. Renommé `origine` à l'import, dans
  `fusionnerImport`.
- **Les purges doivent être exhaustives.** Une suppression par date, par source
  ou par personne doit atteindre *tous* les tableaux — séances, crises, relevés
  de suivi continu. Un tableau oublié laisse des données d'usager derrière une
  purge que l'utilisateur croit complète. C'est déjà arrivé.
- **`BlocsCrise` est partagé** entre l'écran et l'impression. Ne pas en créer
  une seconde version pour l'impression : c'est exactement ce qui a produit le
  doublon de la vue Renforcement.
- **Impression.** L'export PDF des crises repose sur du CSS par ancêtres
  (`display: none` sur les frères). Ne pas revenir à un conteneur `no-print`
  englobant : ça produisait des pages blanches.

## Principes produit

Les outils de croisement montrent des pistes à vérifier, jamais des preuves de
causalité — un écart sur un atelier peut venir de l'heure à laquelle il est
programmé. Le texte d'accompagnement doit le dire, à chaque vue.
