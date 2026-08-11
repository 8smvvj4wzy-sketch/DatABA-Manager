/* Jours observés et squelette de la chronologie des crises.

   `chronologieCrises` ne créait un point que là où une crise existait : une
   semaine à zéro n'apparaissait pas sur l'axe. La tendance se calculait donc
   sur les seules semaines où il s'était passé quelque chose — biais mécanique
   vers le haut — et l'axe mentait sur le temps écoulé en collant deux semaines
   non consécutives. Compter tous les jours du calendrier aurait produit le
   biais inverse : vacances et absences comptées comme des jours sans crise.

   Règle retenue : un jour compte s'il porte une trace de la personne (séance,
   crise, relevé de suivi). Une tranche sans aucune trace n'est pas créée.

   `chronologieCrises` n'avait aucun test jusqu'ici. Fonctions extraites de
   src/App.jsx, pas recopiées — voir test_suivi.mjs pour la raison. */

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

/* `nomAtelier` et `nomAffiche` ne sont pas extraits mais remplacés par des
   doublures : ce sont des constantes fléchées d'une seule ligne, et
   l'extracteur — qui cherche la première ligne commençant par `}` — avalerait
   les déclarations suivantes. Seule la segmentation par intensité est
   exercée ici, ces deux-là ne servent qu'aux autres découpages. */
const NOMS = [
  'jourLocal', 'joursObserves', 'suiviDePersonne', 'axeEtCritereDuReleve',
  'axeDe', 'metaCritereSuivi', 'cleAgregation',
  'etiquetteAgregation', 'valeursSegment', 'chronologieCrises',
];
const code = [
  `const INK_SOFT = '#6B7280'; const ACQUIS = '#0F8B6C'; const EN_COURS = '#D69A2D';`,
  `const NON_ACQUIS = '#A8402F'; const CAT_INDIGO = '#3B5BDB'; const SERIES_MAX = 6;`,
  `const CRITERE_INCONNU_SUIVI = { k: null, l: 'Critère retiré', color: INK_SOFT };`,
  `const CRITERES_STABILITE_V3 = [];`,
  `const INTENSITES = { 1: { label: 'Légère' }, 2: { label: 'Modérée' }, 3: { label: 'Forte' } };`,
  `const FONCTIONS = {};`,
  `const nomAffiche = (d, i) => i;`,
  `const nomAtelier = (d, source, id) => 'Hors atelier';`,
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')} };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { joursObserves, chronologieCrises } = new Function(code)();

/* Une tablette, une personne. Semaines ISO : 2026-06-01 est un lundi, donc
   chaque bloc de sept jours ci-dessous tombe dans une semaine distincte. */
const donnees = {
  _idVersInitiales: { tabA: { e1: 'L.M.', e2: 'T.B.' } },
  _ateliers: { tabA: { at1: 'Repas' } },
  _axesSuivi: { tabA: [] },
  personnes: [{ initials: 'L.M.' }, { initials: 'T.B.' }],
  seances: [
    { id: 's1', date: '2026-06-01T09:00:00', source: 'tabA', studentIds: ['e1'] },
    { id: 's2', date: '2026-06-08T09:00:00', source: 'tabA', studentIds: ['e1'] },
    // Semaine du 15 : personne d'autre que T.B. — L.M. est absente.
    { id: 's3', date: '2026-06-15T09:00:00', source: 'tabA', studentIds: ['e2'] },
    { id: 's4', date: '2026-06-22T09:00:00', source: 'tabA', studentIds: ['e1'] },
  ],
  crises: [
    { id: 'c1', date: '2026-06-01T10:00:00', source: 'tabA', studentId: 'e1', intensite: 2 },
    { id: 'c2', date: '2026-06-22T10:00:00', source: 'tabA', studentId: 'e1', intensite: 2 },
  ],
  suivi: [],
  stabilite: [],
};

/* ==================== joursObserves ==================== */
const joursLM = joursObserves(donnees, 'L.M.');
t('les jours de séance de la personne comptent',
  ['2026-06-01', '2026-06-08', '2026-06-22'].every((j) => joursLM.has(j)), true);
t('la séance d’une autre personne ne compte pas', joursLM.has('2026-06-15'), false);
t('rien d’autre n’est inventé', joursLM.size, 3);

t('sans filtre, toute trace compte quelle que soit la personne',
  joursObserves(donnees, null).has('2026-06-15'), true);

/* Une crise seule, un jour sans séance : la crise est elle-même une trace. */
const avecCriseIsolee = {
  ...donnees,
  crises: [...donnees.crises, { id: 'c3', date: '2026-07-06T10:00:00', source: 'tabA', studentId: 'e1', intensite: 1 }],
};
t('une crise isolée fait exister son jour',
  joursObserves(avecCriseIsolee, 'L.M.').has('2026-07-06'), true);

/* Un relevé de suivi continu aussi. */
const avecReleve = {
  ...donnees,
  _axesSuivi: { tabA: [{ id: 'principal', nom: 'Suivi', criteres: [{ k: 'stable', l: 'Stable', color: '#0F8B6C' }] }] },
  suivi: [{ id: 'r1', studentId: 'e1', suiviId: 'principal', critere: 'stable', source: 'tabA', timestamp: '2026-07-13T09:00:00' }],
};
t('un relevé de suivi fait exister son jour',
  joursObserves(avecReleve, 'L.M.').has('2026-07-13'), true);

/* ==================== chronologieCrises ==================== */
const crisesLM = donnees.crises;

/* Sans jours observés : comportement historique, une tranche par tranche
   portant une crise. C'est le repli qui garde les appels anciens valides. */
const sansJours = chronologieCrises(donnees, crisesLM, 'semaine', 'intensite', 'nombre');
t('sans jours observés, seules les semaines à crise existent', sansJours.donnees.length, 2);

/* Avec les jours observés : la semaine du 8 juin est présente à zéro. */
const avecJours = chronologieCrises(donnees, crisesLM, 'semaine', 'intensite', 'nombre', joursLM);
t('une semaine observée sans crise est présente', avecJours.donnees.length, 3);
t('et vaut zéro', avecJours.donnees.map((d) => d._total), [1, 0, 1]);

/* La semaine du 15 juin, où L.M. n'a aucune trace, reste absente : on ne peut
   pas la distinguer d'une absence, la compter à zéro serait une invention. */
t('une semaine sans aucune trace n’apparaît pas',
  avecJours.donnees.some((d) => d._total === 0 && d.label.includes('15')), false);

/* Le squelette n'invente aucune série : une semaine à zéro porte les mêmes
   colonnes que les autres, à zéro. */
t('les séries restent celles des crises réelles', avecJours.series, ['2 · Modérée']);
t('la semaine à zéro porte la série à zéro', avecJours.donnees[1]['2 · Modérée'], 0);

/* La mesure « durée » suit la même règle de squelette. */
const enDuree = chronologieCrises(
  donnees,
  crisesLM.map((c) => ({ ...c, durationMs: 600000 })),
  'semaine', 'intensite', 'duree', joursLM,
);
t('en durée aussi, la semaine observée sans crise vaut zéro',
  enDuree.donnees.map((d) => d._total), [10, 0, 10]);

/* Aucune crise du tout, mais des jours observés : l'axe existe quand même. */
const zeroCrise = chronologieCrises(donnees, [], 'semaine', 'intensite', 'nombre', joursLM);
t('trois semaines observées sans aucune crise', zeroCrise.donnees.length, 3);
t('toutes à zéro', zeroCrise.donnees.map((d) => d._total), [0, 0, 0]);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
