/* Courbes de lecture superposables aux graphiques : moyenne mobile, médiane,
   moyenne. Deux règles à ne pas perdre — la moyenne mobile ne rétrécit pas sa
   fenêtre sur les bords (une moyenne calculée sur un point isolé n'en est pas
   une, la courbe doit s'arrêter là où le calcul s'arrête), et les trois
   lectures partagent le seuil de trois points de `tendanceLineaire` pour
   apparaître et disparaître ensemble.

   Fonctions extraites de src/App.jsx, pas recopiées — voir test_suivi.mjs. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let ok = 0, ko = 0;
const t = (n, a, e) => {
  const p = JSON.stringify(a) === JSON.stringify(e);
  console.log(`${p ? 'OK  ' : 'ECHEC'} ${n}` + (p ? '' : ` → ${JSON.stringify(a)} au lieu de ${JSON.stringify(e)}`));
  p ? ok++ : ko++;
};

const ici = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(ici, '..', 'src', 'App.jsx'), 'utf8');

function extraire(nom) {
  const lignes = source.split('\n');
  const debut = lignes.findIndex((l) => l.startsWith(`function ${nom}(`) || l.startsWith(`const ${nom} =`));
  if (debut < 0) throw new Error(`Déclaration introuvable dans src/App.jsx : ${nom}`);
  for (let i = debut; i < lignes.length; i++) {
    if (i > debut && /^(\}|\];|\);)/.test(lignes[i])) {
      return lignes.slice(debut, i + 1).join('\n');
    }
  }
  throw new Error(`Fin de déclaration introuvable : ${nom}`);
}
function extraireLigne(nom) {
  const re = new RegExp(`^const ${nom} = (.+);$`, 'm');
  const m = source.match(re);
  if (!m) throw new Error(`Constante introuvable (ligne unique) dans src/App.jsx : ${nom}`);
  return m[1];
}

const NOMS = ['moyenneMobile', 'medianeDe', 'moyenneDe', 'tendanceLineaire', 'reperesDePhase', 'placerEtiquettesReperes'];
const code = [
  `const LARGEUR_TRACE_REF = ${extraireLigne('LARGEUR_TRACE_REF')};`,
  `const PX_PAR_CARACTERE = ${extraireLigne('PX_PAR_CARACTERE')};`,
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')} };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { moyenneMobile, medianeDe, moyenneDe, tendanceLineaire, reperesDePhase, placerEtiquettesReperes } = new Function(code)();

/* ==================== moyenneMobile ==================== */
t('fenêtre de 3 : les bords restent inconnus',
  moyenneMobile([0, 3, 6, 9, 12]), [null, 3, 6, 9, null]);
t('la valeur centrale est bien la moyenne des trois',
  moyenneMobile([10, 20, 60]), [null, 30, null]);
t('arrondi au centième',
  moyenneMobile([0, 1, 0]), [null, 0.33, null]);
t('série trop courte pour la fenêtre', moyenneMobile([5, 7]), null);
t('série vide', moyenneMobile([]), null);
t('fenêtre de 5 : deux valeurs perdues de chaque côté',
  moyenneMobile([1, 2, 3, 4, 5], 5), [null, null, 3, null, null]);
t('fenêtre paire refusée (pas de centre)', moyenneMobile([1, 2, 3, 4], 4), null);
t('fenêtre de 1 refusée', moyenneMobile([1, 2, 3], 1), null);
t('une série plate reste plate',
  moyenneMobile([4, 4, 4, 4]), [null, 4, 4, null]);

/* ==================== medianeDe ==================== */
t('longueur impaire : la valeur du milieu', medianeDe([1, 100, 2]), 2);
t('longueur paire : la moyenne des deux du milieu', medianeDe([1, 2, 3, 4]), 2.5);
t('la médiane résiste à une séance exceptionnelle',
  [medianeDe([10, 12, 11, 200]), moyenneDe([10, 12, 11, 200])], [11.5, 58.25]);
t('deux valeurs : trop court', medianeDe([3, 9]), null);
t('série vide', medianeDe([]), null);

/* ==================== moyenneDe ==================== */
t('moyenne simple', moyenneDe([2, 4, 6]), 4);
t('arrondi au centième', moyenneDe([1, 1, 2]), 1.33);
t('deux valeurs : trop court', moyenneDe([1, 2]), null);

/* ==================== seuil commun aux quatre lectures ====================
   Les quatre doivent basculer ensemble : une série de deux points ne doit en
   activer aucune, une série de trois doit toutes les activer. */
const deux = [5, 9];
t('à deux points, aucune lecture',
  [tendanceLineaire(deux), moyenneMobile(deux), medianeDe(deux), moyenneDe(deux)],
  [null, null, null, null]);
const trois = [5, 9, 13];
t('à trois points, les quatre répondent',
  [tendanceLineaire(trois) !== null, moyenneMobile(trois) !== null,
    medianeDe(trois) !== null, moyenneDe(trois) !== null],
  [true, true, true, true]);

/* ==================== reperesDePhase ====================
   La verticale se pose sur le premier point postérieur au changement. Deux
   silences valent mieux qu'un repère faux : la phase d'origine n'est pas
   datée, et un changement postérieur au dernier point coté ne marque rien
   sur la période affichée. */
const pts = [
  { date: '2026-03-02T09:00:00.000Z', value: 40 },
  { date: '2026-03-09T09:00:00.000Z', value: 55 },
  { date: '2026-03-16T09:00:00.000Z', value: 70 },
];
t('la phase d’origine, sans date, ne marque rien',
  reperesDePhase(pts, [{ id: 'a', name: 'Ligne de base', date: null }]), []);
t('un changement entre deux points marque le point suivant',
  reperesDePhase(pts, [{ id: 'b', name: 'Intervention', date: '2026-03-05T00:00:00.000Z' }]),
  [{ id: 'b', name: 'Intervention', repere: false, index: 1 }]);
t('un changement tombant sur une séance marque cette séance',
  reperesDePhase(pts, [{ id: 'b', name: 'Intervention', date: '2026-03-09T09:00:00.000Z' }]),
  [{ id: 'b', name: 'Intervention', repere: false, index: 1 }]);
t('un changement antérieur à la période marque le premier point',
  reperesDePhase(pts, [{ id: 'b', name: 'Intervention', date: '2026-01-05T00:00:00.000Z' }]),
  [{ id: 'b', name: 'Intervention', repere: false, index: 0 }]);
t('un changement postérieur au dernier point ne marque rien',
  reperesDePhase(pts, [{ id: 'c', name: 'Maintien', date: '2026-04-01T00:00:00.000Z' }]), []);
t('historique complet : seuls les changements datés ressortent',
  reperesDePhase(pts, [
    { id: 'a', name: 'Ligne de base', date: null },
    { id: 'b', name: 'Intervention', date: '2026-03-05T00:00:00.000Z' },
    { id: 'c', name: 'Maintien', date: '2026-03-16T09:00:00.000Z' },
  ]),
  [{ id: 'b', name: 'Intervention', repere: false, index: 1 }, { id: 'c', name: 'Maintien', repere: false, index: 2 }]);
t('objectif sans historique', reperesDePhase(pts, []), []);
t('historique absent — objectif importé d’une version antérieure',
  reperesDePhase(pts, undefined), []);
t('aucun point coté sur la période',
  reperesDePhase([], [{ id: 'b', name: 'Intervention', date: '2026-03-05T00:00:00.000Z' }]), []);
t('le champ repere est transporté, pour distinguer le tracé',
  reperesDePhase(pts, [{ id: 'r', name: 'Guidance dégressive', date: '2026-03-05T00:00:00.000Z', repere: true }]),
  [{ id: 'r', name: 'Guidance dégressive', repere: true, index: 1 }]);

/* ==================== placerEtiquettesReperes ====================
   Même règle que DatABA (tests/test_phases.mjs) : ancrage selon la position
   sur le tracé, empilement sur deux lignes au plus pour deux repères
   rapprochés, troncature au-delà de 18 caractères. */
t('un repère au premier point est ancré à gauche',
  placerEtiquettesReperes([{ id: 'a', name: 'Intervention', repere: false, index: 0 }], 5)[0].ancre, 'start');
t('un repère au dernier point est ancré à droite',
  placerEtiquettesReperes([{ id: 'b', name: 'Intervention', repere: false, index: 4 }], 5)[0].ancre, 'end');
t('un repère au centre, avec un nom court, est centré',
  placerEtiquettesReperes([{ id: 'c', name: 'Interv.', repere: false, index: 2 }], 5)[0].ancre, 'middle');
t('un nom long est tronqué à 18 caractères',
  placerEtiquettesReperes([{ id: 'd', name: 'Renforcement différé progressif', repere: false, index: 2 }], 5)[0].texte.length, 18);
t('deux repères proches se répartissent sur deux lignes',
  placerEtiquettesReperes([
    { id: 'e1', name: 'Intervention', repere: false, index: 2 },
    { id: 'e2', name: 'Maintien', repere: false, index: 3 },
  ], 10).map((p) => p.ligne), [0, 1]);
t('un troisième chevauchement consécutif revient en ligne 0',
  placerEtiquettesReperes([
    { id: 'f1', name: 'Ligne de base', repere: false, index: 1 },
    { id: 'f2', name: 'Intervention', repere: false, index: 2 },
    { id: 'f3', name: 'Maintien', repere: false, index: 3 },
  ], 10).map((p) => p.ligne), [0, 1, 0]);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
