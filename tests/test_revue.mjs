/* La vue « Par personne » du Tableau de bord.

   Le bord agrégeait les objectifs de tout le monde dans une liste à plat, et
   la fiche personne ne montre qu'une personne à la fois : rien ne permettait
   de comparer l'effectif. `revueParPersonne` produit la ligne de chacun.

   Trois règles y sont fragiles et verrouillées ici :
   1. la ligne part de `personnes`, pas des cotations — une personne sans
      aucune cotation sur la période est précisément celle qu'il faut voir, et
      la faire disparaître du tableau supprimerait l'information cherchée ;
   2. les cotations se comptent sur `points` ET `mesures` — une ligne en mesure
      brute n'a pas de `points` et s'annoncerait à zéro, la même faute que le
      Tableau de bord a déjà commise sur ses libellés « 0 séance » ;
   3. sans période de comparaison, `crisesRef` vaut null et non zéro : « pas de
      comparaison » et « zéro crise avant » ne sont pas la même chose, et
      `Ecart` sait déjà rendre « — » sur null.

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

/* Les couleurs sont doublées plutôt qu'extraites : `revueParPersonne` ne lit
   d'`ETATS` que ses clés, et tirer la palette entière n'apprendrait rien de
   plus à cette suite. */
const NOMS = ['bornesDe', 'dansPeriode', 'joursDepuis', 'ETATS', 'revueParPersonne'];
const code = [
  `const CAT_TEAL = '#00A870', CAT_CYAN = '#00B8D9', CAT_AMBER = '#FF8A3D';`,
  `const CAT_INDIGO = '#3B5BDB', CAT_SLATE = '#64748B', CAT_LILAC = '#A78BFA', CAT_CORAL = '#FF4D6D';`,
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')} };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { revueParPersonne, ETATS } = new Function(code)();

const T0 = new Date('2026-06-30T12:00:00').getTime();
const juin = { mode: 'dates', debut: '2026-06-01', fin: '2026-06-30', granularite: 'jour' };
const mai = { mode: 'dates', debut: '2026-05-01', fin: '2026-05-31', granularite: 'jour' };

const donnees = {
  _idVersInitiales: { tabA: { e1: 'L.M.', e2: 'T.B.' } },
  personnes: [{ initials: 'L.M.' }, { initials: 'T.B.' }, { initials: 'A.R.' }],
  seances: [
    { id: 's1', date: '2026-06-02T09:00:00', source: 'tabA', studentIds: ['e1', 'e2'] },
    { id: 's2', date: '2026-06-09T09:00:00', source: 'tabA', studentIds: ['e1'] },
    /* Hors période : ne doit compter nulle part. */
    { id: 's3', date: '2026-05-12T09:00:00', source: 'tabA', studentIds: ['e1'] },
  ],
  crises: [
    { id: 'c1', date: '2026-06-03T10:00:00', source: 'tabA', studentId: 'e1' },
    { id: 'c2', date: '2026-06-14T10:00:00', source: 'tabA', studentId: 'e1' },
    { id: 'c3', date: '2026-05-20T10:00:00', source: 'tabA', studentId: 'e1' },
    /* Une observation ABC n'est pas une crise : elle ne doit pas être comptée
       dans la colonne « Crises », comme la carte du haut ne la compte pas. */
    { id: 'c4', date: '2026-06-04T10:00:00', source: 'tabA', studentId: 'e1', kind: 'abc' },
  ],
};

const pt = (date, value) => ({ date, value });
const recentes = [
  /* Acquis pendant la période. */
  { initials: 'L.M.', objectif: 'Demander', etat: 'acquis', acquisLe: '2026-06-09', points: [pt('2026-06-02', 90), pt('2026-06-09', 95)], mesures: [] },
  { initials: 'L.M.', objectif: 'Attendre', etat: 'bientot', acquisLe: null, points: [pt('2026-06-09', 80)], mesures: [] },
  /* Une ligne en mesure brute : aucun `points`, mais bien deux cotations. */
  { initials: 'L.M.', objectif: 'Demandes spontanées', etat: 'mesure', acquisLe: null, points: [], mesures: [pt('2026-06-02', 4), pt('2026-06-09', 6)] },
  /* Acquis avant la période : l'état reste « acquis », mais l'acquisition
     n'appartient pas à ce bilan-ci. */
  { initials: 'T.B.', objectif: 'Saluer', etat: 'en_cours', acquisLe: '2026-02-11', points: [pt('2026-06-02', 40)], mesures: [] },
];

const revue = revueParPersonne(donnees, donnees.personnes, recentes, juin, mai, {
  'L.M.': '2026-06-29', 'T.B.': '2026-06-09', 'A.R.': '2026-05-02',
}, T0);
const de = (ini) => revue.find((r) => r.initiales === ini);

/* Règle 1 : tout le monde a sa ligne. */
t('une ligne par personne, dans l’ordre reçu', revue.map((r) => r.initiales), ['L.M.', 'T.B.', 'A.R.']);
t('une personne sans aucune cotation garde sa ligne', de('A.R.').total, 0);
t('et ses compteurs valent zéro, pas null', [de('A.R.').cotations, de('A.R.').crises, de('A.R.').seances], [0, 0, 0]);

/* Règle 2 : les deux séries comptent. */
t('les cotations additionnent points et mesures', de('L.M.').cotations, 5);
t('une ligne en mesure brute est bien comptée dans le total', de('L.M.').total, 3);

/* La répartition des états porte les sept clés, à zéro par défaut : la barre
   du tableau les parcourt toutes et ne doit pas rencontrer d'undefined. */
t('les sept états sont présents', Object.keys(de('L.M.').etats).sort(), Object.keys(ETATS).sort());
t('la répartition compte chaque état', [de('L.M.').etats.acquis, de('L.M.').etats.bientot, de('L.M.').etats.mesure], [1, 1, 1]);
t('un état non représenté vaut zéro', de('L.M.').etats.non_acquis, 0);

/* « Acquis » compte les acquisitions DE la période, pas l'état du moment : un
   objectif atteint en février est acquis toute l'année, il n'a été acquis
   qu'une fois. Sans cette distinction, un bilan trimestriel recompte chaque
   trimestre les mêmes acquisitions. */
t('un objectif acquis pendant la période est compté', de('L.M.').acquisPeriode, 1);
t('un objectif acquis avant la période ne l’est pas', de('T.B.').acquisPeriode, 0);
t('mais il garde son état, lui', de('T.B.').etats.en_cours, 1);
t('sans date d’acquisition, rien n’est compté', de('A.R.').acquisPeriode, 0);

/* Séances et crises sont bornées par la période. */
t('les séances de la période, dédupliquées par personne', de('L.M.').seances, 2);
t('une séance partagée compte pour chaque participant', de('T.B.').seances, 1);
t('les crises de la période, hors observations', de('L.M.').crises, 2);
t('la période de comparaison a sa propre valeur', de('L.M.').crisesRef, 1);
t('sans crise, la référence vaut zéro et non null', de('T.B.').crisesRef, 0);

/* Règle 3 : pas de comparaison réglée ≠ zéro. */
const sansRef = revueParPersonne(donnees, donnees.personnes, recentes, juin, null, {}, T0);
t('sans période de comparaison, la référence est null', sansRef.find((r) => r.initiales === 'L.M.').crisesRef, null);

/* La dernière trace ne dépend pas de la période — elle dit à quand remonte le
   dernier signe de vie, même hors fenêtre. */
t('la dernière trace se lit en jours', de('L.M.').joursDepuisTrace, 1);
t('une trace antérieure à la période compte quand même', de('A.R.').joursDepuisTrace, 59);
t('sans aucune trace, la valeur reste null', sansRef.find((r) => r.initiales === 'A.R.').joursDepuisTrace, null);

/* Une personne inconnue de `personnes` ne fabrique pas de ligne, même si des
   cotations la mentionnent : le tableau montre l'effectif déclaré. */
const restreint = revueParPersonne(donnees, [{ initials: 'T.B.' }], recentes, juin, mai, {}, T0);
t('la liste de personnes décide seule des lignes produites',
  restreint.map((r) => r.initiales), ['T.B.']);
t('et les cotations des autres ne fuient pas dedans', restreint[0].total, 1);

/* Un identifiant d'usager que plus aucune personne ne réclame — reste d'une
   purge partielle — ne doit pas ajouter de ligne fantôme. */
const orphelin = revueParPersonne(
  { ...donnees, _idVersInitiales: { tabA: { e1: 'L.M.', e2: 'T.B.', e9: 'Z.Z.' } },
    crises: [...donnees.crises, { id: 'c9', date: '2026-06-05T10:00:00', source: 'tabA', studentId: 'e9' }] },
  donnees.personnes, recentes, juin, mai, {}, T0,
);
t('un identifiant orphelin n’ajoute aucune ligne', orphelin.map((r) => r.initiales), ['L.M.', 'T.B.', 'A.R.']);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
