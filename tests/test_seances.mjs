/* Écran Séances : nature d'une séance, et décompte de ses cotations.

   Deux fautes couvertes ici, toutes deux invisibles pour les 24 suites qui
   étaient vertes au moment où elles ont été trouvées.

   1. DatABA connaît trois natures de séance mais son modèle n'en nomme que
      deux : `mode` vaut 'atelier' ou 'balance', et la séance libre est un
      'atelier' SANS atelier. Manager les résolvait toutes par `nomAtelier`,
      qui rend « Hors atelier » — séance libre et séance Équilibre
      s'affichaient à l'identique, restaient introuvables par la recherche et
      se confondaient dans la dimension Atelier d'Explorer.

   2. Le décompte des cotations passait par `objectiveScoreValue`, qui ignore
      l'occurrence et l'intervalle : sur le jeu de démonstration de DatABA, 1 180
      cotations annoncées au lieu de 1 808, sur les 134 séances sans exception.
      La règle est vérifiée ici sur les six modes ; le verificateur interdit par
      ailleurs tout appel direct à `objectiveScoreValue` depuis un écran.

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
const lignes = source.split('\n');

function extraire(nom) {
  const debut = lignes.findIndex((l) => l.startsWith(`function ${nom}(`) || l.startsWith(`const ${nom} =`));
  if (debut < 0) throw new Error(`Déclaration introuvable dans src/App.jsx : ${nom}`);
  if (/;\s*$/.test(lignes[debut])) return lignes[debut];
  for (let i = debut; i < lignes.length; i++) {
    if (i > debut && /^(\}|\];|\);)/.test(lignes[i])) return lignes.slice(debut, i + 1).join('\n');
  }
  throw new Error(`Fin de déclaration introuvable : ${nom}`);
}

const NOMS = ['nomAtelier', 'libelleSeance', 'objectiveScoreValue', 'UNITES_BRUTES', 'parseHM',
  'partNiveauCible', 'valeurCotation', 'mesuresAppoint', 'minutesAppoint', 'libelleAppoint'];
const ordre = (n) => {
  const i = lignes.findIndex((l) => l.startsWith(`function ${n}(`) || l.startsWith(`const ${n} =`));
  return i < 0 ? Infinity : i;
};
NOMS.sort((a, b) => ordre(a) - ordre(b));
// eslint-disable-next-line no-new-func
const M = new Function(`${NOMS.map(extraire).join('\n')}\nreturn { ${NOMS.join(', ')} };`)();

const D = { _ateliers: { T1: { at1: 'Repas' } } };

/* ==================== Nature d'une séance ==================== */
t('une séance d’atelier porte le nom de son atelier',
  M.libelleSeance(D, { source: 'T1', mode: 'atelier', atelierId: 'at1' }), 'Repas');
t('POINT CLÉ : un mode atelier sans atelier est une séance libre',
  M.libelleSeance(D, { source: 'T1', mode: 'atelier', atelierId: null }), 'Séance libre');
t('POINT CLÉ : un mode balance est une séance Équilibre',
  M.libelleSeance(D, { source: 'T1', mode: 'balance', atelierId: null }), 'Équilibre');
t('les deux ne se confondent plus sous « Hors atelier »',
  M.libelleSeance(D, { source: 'T1', mode: 'atelier', atelierId: null })
  !== M.libelleSeance(D, { source: 'T1', mode: 'balance', atelierId: null }), true);
/* Une séance Équilibre reste `atelierId: null` côté DatABA, mais rien
   n'interdit qu'une tablette en porte un : l'atelier prime, il est plus
   précis que la nature. */
t('un atelier renseigné prime sur le mode',
  M.libelleSeance(D, { source: 'T1', mode: 'balance', atelierId: 'at1' }), 'Repas');
t('un atelier retiré de la tablette reste « Hors atelier »',
  M.libelleSeance(D, { source: 'T1', mode: 'atelier', atelierId: 'disparu' }), 'Hors atelier');
t('séance absente : pas d’exception', M.libelleSeance(D, null), 'Hors atelier');

/* ==================== Décompte des cotations ==================== */
/* La règle de l'écran : une cotation compte si `valeurCotation` en rend une. */
const compte = (obj, entry) => (M.valeurCotation(obj, entry) != null ? 1 : 0);

const G = [{ code: 'I', independent: true }, { code: 'GP', independent: false }];
const CAS = [
  ['essais discrets', { type: 'trials', config: { guidanceSet: G } }, { trials: ['I', 'GP'] }],
  ['probe', { type: 'probe', config: {} }, { guidance: 'I' }],
  ['chaînage', { type: 'chaining', config: { steps: [{ id: 'a' }], guidanceSet: G } }, { steps: { a: 'I' } }],
  ['équilibre', { type: 'balance', config: { steps: [{ id: 'a' }] } }, { trials: [{ steps: { a: { outcome: 'reussi' } } }] }],
  ['intervalle', { type: 'interval', config: { levels: [{ id: 'x' }], targetLevelId: 'x' } }, { marks: { 1: 'x' } }],
  ['occurrence', { type: 'occurrence', config: {} }, { count: 12 }],
];
CAS.forEach(([nom, obj, entry]) => {
  t(`POINT CLÉ : ${nom} compte pour une cotation`, compte(obj, entry), 1);
});
t('les six modes comptent, aucun ne manque', CAS.filter(([, o, e]) => compte(o, e)).length, 6);

/* Les deux modes que l'ancien décompte perdait, vérifiés séparément : leur
   score n'existe pas au sens d'objectiveScoreValue, leur valeur si. */
t('l’occurrence n’a pas de score en pourcentage',
  M.objectiveScoreValue({ type: 'occurrence', config: {} }, { count: 12 }), null);
t('mais elle a bien une valeur',
  M.valeurCotation({ type: 'occurrence', config: {} }, { count: 12 }).valeur, 12);
t('et son unité n’est pas le pourcentage',
  M.valeurCotation({ type: 'occurrence', config: {} }, { count: 12 }).unite, 'occurrences');
t('l’intervalle n’a pas de score en pourcentage',
  M.objectiveScoreValue({ type: 'interval', config: { levels: [{ id: 'x' }], targetLevelId: 'x' } }, { marks: { 1: 'x' } }), null);
t('mais sa valeur en est bien un',
  M.valeurCotation({ type: 'interval', config: { levels: [{ id: 'x' }], targetLevelId: 'x' } }, { marks: { 1: 'x' } }).unite, '%');

/* Un objectif sélectionné et laissé vide ne compte pas — c'est le seul cas
   où « non coté » reste la bonne réponse. */
t('un objectif ouvert et non coté ne compte pas',
  compte({ type: 'trials', config: { guidanceSet: G } }, { trials: [] }), 0);
t('une occurrence sans compte relevé ne compte pas',
  compte({ type: 'occurrence', config: {} }, {}), 0);
t('une occurrence à zéro compte : zéro est une mesure',
  compte({ type: 'occurrence', config: {} }, { count: 0 }), 1);

/* ==================== Mesures d'appoint ==================== */
/* `valideA` fait foi, comme dans `mesuresExport` côté DatABA : il distingue
   « pas encore mesuré » de « mesuré à zéro ». */
const aux = (c, h) => ({ mesures: { compteur: c, chrono: h } });
t('rien de validé : aucune mesure d’appoint',
  M.mesuresAppoint(aux({ total: 0, valideA: null }, { elapsedMs: 0, valideA: null })), null);
t('un total sans validation est ignoré',
  M.mesuresAppoint(aux({ total: 9, valideA: null }, { elapsedMs: 0, valideA: null })), null);
t('POINT CLÉ : validé à zéro n’est pas « pas mesuré »',
  M.mesuresAppoint(aux({ total: 0, valideA: 'x' }, { elapsedMs: 0, valideA: null })), { compteur: 0, secondes: null });
t('compteur validé', M.mesuresAppoint(aux({ total: 9, valideA: 'x' }, { elapsedMs: 0, valideA: null })).compteur, 9);
t('chrono validé, rendu en secondes',
  M.mesuresAppoint(aux({ total: 0, valideA: null }, { elapsedMs: 95000, valideA: 'x' })).secondes, 95);
t('entrée sans mesures du tout', M.mesuresAppoint({}), null);
t('entrée absente', M.mesuresAppoint(null), null);

t('minutes pour la table de faits',
  M.minutesAppoint(M.mesuresAppoint(aux({ total: 0, valideA: null }, { elapsedMs: 95000, valideA: 'x' }))), 2);
t('pas de chrono : pas de minutes, et surtout pas un zéro',
  M.minutesAppoint(M.mesuresAppoint(aux({ total: 3, valideA: 'x' }, { elapsedMs: 0, valideA: null }))), null);

t('libellé des deux mesures',
  M.libelleAppoint(M.mesuresAppoint(aux({ total: 9, valideA: 'x' }, { elapsedMs: 95000, valideA: 'x' }))),
  'compteur 9 · chrono 1 min 35 s');
t('sous la minute, le chrono reste en secondes',
  M.libelleAppoint(M.mesuresAppoint(aux({ total: 0, valideA: null }, { elapsedMs: 40000, valideA: 'x' }))),
  'chrono 40 s');
t('rien à dire : rien', M.libelleAppoint(null), null);

console.log(`\n${ok} réussi(s), ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
