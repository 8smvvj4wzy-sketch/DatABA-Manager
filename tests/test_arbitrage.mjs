/* La file « À arbitrer » du Tableau de bord.

   `etatDeSerie` calculait déjà `streak`, `jours` et `moyenne`, et `Ecart`
   décidait déjà de ce qu'est une hausse nette — mais rien ne réunissait ces
   faits ni ne les classait : ils n'existaient qu'éparpillés derrière sept
   pastilles à cliquer. Cette suite verrouille les trois choses qui peuvent
   silencieusement dériver : le seuil de netteté (le même que celui affiché en
   couleur ailleurs, pas un second), la règle de non-redondance entre une
   personne sans trace et ses objectifs dormants, et l'ordre de remontée.

   Fonctions extraites de src/App.jsx, pas recopiées — voir test_suivi.mjs pour
   la raison. */

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

const NOMS = ['jourLocal', 'derniereTraceParPersonne', 'joursDepuis', 'ecartNet', 'situationsAArbitrer'];
const code = [
  `const DORMANT_JOURS = ${extraireLigne('DORMANT_JOURS')};`,
  `const POIDS_ARBITRAGE = ${extraireLigne('POIDS_ARBITRAGE')};`,
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, DORMANT_JOURS, POIDS_ARBITRAGE };`,
].join('\n');
// eslint-disable-next-line no-new-func
const {
  derniereTraceParPersonne, joursDepuis, ecartNet, situationsAArbitrer, DORMANT_JOURS,
} = new Function(code)();

/* Instant de référence fixe : rien ici ne doit dépendre de l'heure à laquelle
   la suite tourne. Le 30 juin 2026 à midi. */
const T0 = new Date('2026-06-30T12:00:00').getTime();

/* ==================== ecartNet ==================== */
/* Les deux gardes se cumulent : au moins 1 en absolu ET au moins un quart de
   la référence. C'est exactement ce qu'affiche `Ecart` — si l'une des deux
   bouge ici sans bouger là, la file remontera des hausses que l'écran appelle
   « stable » deux lignes plus haut. */
t('onze crises contre cinq : net', ecartNet(11, 5), true);
t('dix contre neuf : le quart de la référence n’est pas atteint', ecartNet(10, 9), false);
t('deux contre une : net (le quart de 1 vaut 0,25)', ecartNet(2, 1), true);
t('une contre zéro : net', ecartNet(1, 0), true);
t('égalité : rien à annoncer', ecartNet(5, 5), false);
t('une baisse franche est nette elle aussi', ecartNet(2, 12), true);
t('valeur absente : jamais net', ecartNet(null, 5), false);
t('référence absente : jamais net', ecartNet(5, null), false);

/* ==================== joursDepuis ==================== */
t('la veille au soir compte pour un jour', joursDepuis('2026-06-29', T0), 1);
t('le jour même compte pour zéro', joursDepuis('2026-06-30', T0), 0);
t('vingt-neuf jours plus tôt', joursDepuis('2026-06-01', T0), 29);
t('sans jour, aucun décompte', joursDepuis(null, T0), null);
t('un jour illisible ne rend pas NaN', joursDepuis('pas-une-date', T0), null);

/* ==================== derniereTraceParPersonne ==================== */
const donnees = {
  _idVersInitiales: { tabA: { e1: 'L.M.', e2: 'T.B.' }, tabB: { x9: 'L.M.' } },
  personnes: [{ initials: 'L.M.' }, { initials: 'T.B.' }],
  seances: [
    { id: 's1', date: '2026-06-01T09:00:00', source: 'tabA', studentIds: ['e1', 'e2'] },
    { id: 's2', date: '2026-06-20T09:00:00', source: 'tabA', studentIds: ['e1'] },
  ],
  crises: [{ id: 'c1', date: '2026-06-05T10:00:00', source: 'tabA', studentId: 'e2' }],
  suivi: [{ id: 'r1', source: 'tabB', studentId: 'x9', timestamp: '2026-06-28T08:00:00' }],
  stabilite: [{ id: 'v1', source: 'tabA', studentId: 'e2', timestamp: '2026-06-09T08:00:00' }],
};

const traces = derniereTraceParPersonne(donnees);
t('la trace la plus récente gagne, quelle que soit sa nature', traces['L.M.'], '2026-06-28');
t('une trace venue d’une autre tablette compte comme les autres',
  derniereTraceParPersonne({ ...donnees, suivi: [] })['L.M.'], '2026-06-20');
t('un relevé v3 (stabilite) compte au même titre qu’un v4', traces['T.B.'], '2026-06-09');
t('une séance partagée trace chacun de ses participants',
  derniereTraceParPersonne({ ...donnees, crises: [], suivi: [], stabilite: [] })['T.B.'], '2026-06-01');
t('personne d’autre n’est inventé', Object.keys(traces).sort(), ['L.M.', 'T.B.']);

/* ==================== situationsAArbitrer ==================== */
const ligne = (initials, objectif, reste) => ({ initials, objectif, ...reste });

/* Une base saine : rien à arbitrer. */
t('aucune situation sur une base saine',
  situationsAArbitrer(
    [ligne('L.M.', 'Demander', { etat: 'en_cours' }), ligne('T.B.', 'Attendre', { etat: 'acquis' })],
    { 'L.M.': 2 }, { 'L.M.': 2 }, { 'L.M.': '2026-06-29', 'T.B.': '2026-06-29' }, T0,
  ), []);

const recentes = [
  ligne('L.M.', 'Demander de l’aide', { etat: 'bientot', streak: 4, needed: 5 }),
  ligne('L.M.', 'Attendre son tour', { etat: 'plateau', moyenne: 62, threshold: 80 }),
  ligne('L.M.', 'Ranger', { etat: 'dormant', jours: 27 }),
  ligne('T.B.', 'Saluer', { etat: 'dormant', jours: 24 }),
  ligne('T.B.', 'Se laver les mains', { etat: 'en_cours' }),
];
const recentesTrace = { 'L.M.': '2026-06-29', 'T.B.': '2026-06-01' };
const file = situationsAArbitrer(recentes, { 'L.M.': 11, 'T.B.': 1 }, { 'L.M.': 5, 'T.B.': 1 }, recentesTrace, T0);

t('chaque fait porte ses chiffres, pas une phrase',
  file.find((s) => s.kind === 'bientot'),
  { kind: 'bientot', poids: 1, initiales: 'L.M.', objectif: 'Demander de l’aide', streak: 4, needed: 5 });
t('le plateau porte sa moyenne et son seuil',
  file.find((s) => s.kind === 'plateau'),
  { kind: 'plateau', poids: 3, initiales: 'L.M.', objectif: 'Attendre son tour', moyenne: 62, seuil: 80 });
t('la hausse de crises porte les deux chiffres comparés',
  file.find((s) => s.kind === 'crises_hausse'),
  { kind: 'crises_hausse', poids: 0, initiales: 'L.M.', objectif: null, n: 11, reference: 5 });

/* La non-redondance : T.B. n'a plus aucune trace depuis vingt-neuf jours. Son
   objectif dormant ne doit pas produire une seconde ligne qui raconte la même
   absence — c'est ce qui noierait la file sur un effectif en vacances. */
t('une personne sans trace remonte une seule fois',
  file.filter((s) => s.initiales === 'T.B.').map((s) => s.kind), ['sans_trace']);
t('mais un objectif dormant chez une personne active remonte bien',
  file.some((s) => s.kind === 'dormant' && s.initiales === 'L.M.'), true);

/* L'ordre de remontée. */
t('le poids classe les types',
  file.map((s) => s.kind), ['crises_hausse', 'bientot', 'sans_trace', 'plateau', 'dormant']);

const deuxHausses = situationsAArbitrer(
  [], { A: 11, B: 30 }, { A: 5, B: 10 }, {}, T0,
);
t('à poids égal, la plus forte hausse passe devant',
  deuxHausses.map((s) => s.initiales), ['B', 'A']);

const deuxAbsences = situationsAArbitrer([], {}, {}, { A: '2026-06-08', B: '2026-06-01' }, T0);
t('à poids égal, l’absence la plus longue passe devant',
  deuxAbsences.map((s) => s.initiales), ['B', 'A']);

/* Le tri est stable : deux plateaux ne se comparent pas — deux moyennes sous
   deux seuils différents ne se classent pas — et gardent donc l'ordre de
   `recentes`. */
const deuxPlateaux = situationsAArbitrer([
  ligne('A', 'Un', { etat: 'plateau', moyenne: 70, threshold: 80 }),
  ligne('B', 'Deux', { etat: 'plateau', moyenne: 30, threshold: 40 }),
], {}, {}, {}, T0);
t('deux plateaux gardent l’ordre de la liste', deuxPlateaux.map((s) => s.initiales), ['A', 'B']);

/* Sans période de comparaison, aucune hausse n'est annoncée : il n'y a rien à
   comparer, et zéro n'est pas une référence. */
t('sans comparaison, aucune ligne de crises',
  situationsAArbitrer([], { 'L.M.': 11 }, null, {}, T0).length, 0);
t('une baisse de crises n’est pas une situation à arbitrer',
  situationsAArbitrer([], { 'L.M.': 2 }, { 'L.M.': 12 }, {}, T0).length, 0);

/* La borne exacte de la dormance : à DORMANT_JOURS pile, la personne remonte. */
const borne = (jour) => situationsAArbitrer([], {}, {}, { A: jour }, T0).length;
t(`à ${DORMANT_JOURS} jours pile, la personne remonte`, borne('2026-06-09'), 1);
t(`à ${DORMANT_JOURS - 1} jours, elle ne remonte pas`, borne('2026-06-10'), 0);

/* Une personne jamais vue n'a pas de trace du tout : elle ne doit pas être
   annoncée « absente depuis NaN jours ». */
t('une trace absente ne produit pas de ligne',
  situationsAArbitrer([], {}, {}, { A: null }, T0).length, 0);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
