/* Ce sur quoi la décision repose : remontées par tablette, et objectifs restés
   entre les mains d'un seul observateur.

   Deux angles morts du même sujet. `donnees.sources` n'était qu'une liste de
   noms : une tablette qui a cessé de remonter y était indiscernable d'une
   tablette à jour, et le poste continuait d'afficher des chiffres complets sur
   une photo périmée. Et l'accord inter-observateurs ne peut montrer que les
   doubles cotations QUI ONT EU LIEU — là où elle n'a jamais eu lieu, rien ne
   signalait qu'une série entière reposait sur une seule main.

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

const NOMS = [
  'jourLocal', 'remonteesParSource',
  'objectiveScoreValue', 'parseHM', 'partNiveauCible', 'valeurCotation', 'objectifsMonoObservateur',
];
const code = [
  `const TYPES_POURCENT = ${extraireLigne('TYPES_POURCENT')};`,
  `const guidancesDe = ${extraireLigne('guidancesDe')};`,
  extraire('UNITES_BRUTES'),
  NOMS.map(extraire).join('\n'),
  `const MONO_OBSERVATEUR_MIN = ${extraireLigne('MONO_OBSERVATEUR_MIN')};`,
  `return { remonteesParSource, objectifsMonoObservateur, MONO_OBSERVATEUR_MIN };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { remonteesParSource, objectifsMonoObservateur, MONO_OBSERVATEUR_MIN } = new Function(code)();

/* ==================== remonteesParSource ==================== */
const donnees = {
  sources: ['Salle A', 'Salle B', 'Salle C'],
  _idVersInitiales: { 'Salle A': { e1: 'L.M.' }, 'Salle B': { z1: 'T.B.' } },
  seances: [
    { id: 's1', source: 'Salle A', date: '2026-06-02T09:00:00' },
    { id: 's2', source: 'Salle A', date: '2026-06-20T09:00:00' },
    { id: 's3', source: 'Salle B', date: '2026-04-11T09:00:00' },
  ],
  crises: [{ id: 'c1', source: 'Salle A', date: '2026-06-25T10:00:00' }],
  suivi: [{ id: 'r1', source: 'Salle B', timestamp: '2026-04-14T08:00:00' }],
  stabilite: [{ id: 'v1', source: 'Salle B', timestamp: '2026-04-18T08:00:00' }],
};

const remontees = remonteesParSource(donnees);
const src = (nom) => remontees.find((r) => r.source === nom);

t('une ligne par source déclarée, dans l’ordre d’import',
  remontees.map((r) => r.source), ['Salle A', 'Salle B', 'Salle C']);
t('les trois natures sont comptées séparément',
  [src('Salle A').seances, src('Salle A').crises, src('Salle A').releves], [2, 1, 0]);
t('les relevés v3 et v4 comptent ensemble', src('Salle B').releves, 2);
t('la date retenue est la plus récente, toutes natures confondues',
  src('Salle A').derniere, '2026-06-25');
t('un relevé peut être la donnée la plus récente d’une tablette',
  src('Salle B').derniere, '2026-04-18');
t('une source déclarée mais sans aucune donnée existe et ne ment pas',
  [src('Salle C').seances, src('Salle C').derniere], [0, null]);

/* Une source présente dans les données mais absente de `sources` : anomalie
   réelle (paquet inter-Manager mal formé), montrée en fin de liste plutôt que
   passée sous silence. */
const orpheline = remonteesParSource({
  ...donnees,
  seances: [...donnees.seances, { id: 's9', source: 'Salle Z', date: '2026-06-28T09:00:00' }],
});
t('une source inconnue est ajoutée en fin de liste',
  orpheline.map((r) => r.source), ['Salle A', 'Salle B', 'Salle C', 'Salle Z']);
t('et porte bien ses données', orpheline[3].derniere, '2026-06-28');

t('un bloc vide ne rend rien', remonteesParSource({ sources: [] }), []);

/* ==================== objectifsMonoObservateur ==================== */
/* Objectifs en essais (`trials`) : trois essais indépendants valent 100 %.
   Ce qui compte ici n'est pas le score mais le fait qu'une cotation existe. */
const objDemander = { name: 'Demander de l’aide', type: 'trials', config: {} };
const objSaluer = { name: 'Saluer', type: 'trials', config: {} };
const troisI = { trials: [{ code: 'I' }, { code: 'I' }, { code: 'I' }] };

const seance = (id, date, intervenantId, objectifs) => ({
  id, date, source: 'Salle A', intervenantId,
  studentIds: ['e1'],
  selectedObjectives: { e1: Object.keys(objectifs) },
  objectiveSnapshot: objectifs,
  data: { e1: Object.fromEntries(Object.keys(objectifs).map((k) => [k, troisI])) },
});

const base = {
  _idVersInitiales: { 'Salle A': { e1: 'L.M.' } },
  _intervenants: { 'Salle A': { i1: 'Camille', i2: 'Dominique' } },
  _guidances: {},
  seances: [
    seance('s1', '2026-06-02', 'i1', { o1: objDemander, o2: objSaluer }),
    seance('s2', '2026-06-09', 'i1', { o1: objDemander, o2: objSaluer }),
    seance('s3', '2026-06-16', 'i1', { o1: objDemander }),
    /* Un second intervenant sur « Saluer » seulement. */
    seance('s4', '2026-06-23', 'i2', { o2: objSaluer }),
  ],
};

const mono = objectifsMonoObservateur(base, MONO_OBSERVATEUR_MIN);
t('un objectif toujours coté par la même personne remonte',
  mono, [{ initiales: 'L.M.', objectif: 'Demander de l’aide', cotations: 3, intervenant: 'Camille' }]);
t('un objectif coté par deux personnes ne remonte pas',
  mono.some((m) => m.objectif === 'Saluer'), false);

/* Le seuil : deux cotations ne sont pas une habitude. */
const deuxSeulement = objectifsMonoObservateur({
  ...base, seances: base.seances.slice(0, 2),
}, MONO_OBSERVATEUR_MIN);
t(`en dessous de ${MONO_OBSERVATEUR_MIN} cotations, rien n’est annoncé`, deuxSeulement, []);
t('à la borne exacte, l’objectif remonte',
  objectifsMonoObservateur(base, 3).length, 1);

/* Un intervenant non renseigné : « on ne sait pas qui a coté » n'est pas
   « une seule personne a coté ». */
const sansIntervenant = objectifsMonoObservateur({
  ...base, _intervenants: { 'Salle A': {} },
}, MONO_OBSERVATEUR_MIN);
t('un intervenant inconnu écarte le couple', sansIntervenant, []);

/* Un objectif sélectionné mais jamais coté ne pèse pas : même règle
   qu’analyserObjectif, qui n’ouvre de série que sur une valeur réelle. */
const nonCote = objectifsMonoObservateur({
  ...base,
  seances: base.seances.map((s) => ({ ...s, data: { e1: {} } })),
}, MONO_OBSERVATEUR_MIN);
t('un objectif sélectionné mais non coté ne compte pas', nonCote, []);

/* Le même intervenant sur deux tablettes porte deux identifiants : c'est le
   NOM qui fait foi, comme pour l'appariement des ateliers dans trouverPaires.
   Ici Camille est i1 en Salle A et j7 en Salle B — un seul observateur. */
const deuxTablettes = objectifsMonoObservateur({
  _idVersInitiales: { 'Salle A': { e1: 'L.M.' }, 'Salle B': { x2: 'L.M.' } },
  _intervenants: { 'Salle A': { i1: 'Camille' }, 'Salle B': { j7: 'Camille' } },
  _guidances: {},
  seances: [
    seance('s1', '2026-06-02', 'i1', { o1: objDemander }),
    seance('s2', '2026-06-09', 'i1', { o1: objDemander }),
    { ...seance('s3', '2026-06-16', 'j7', { o1: objDemander }), source: 'Salle B', studentIds: ['x2'],
      selectedObjectives: { x2: ['o1'] }, data: { x2: { o1: troisI } } },
  ],
}, MONO_OBSERVATEUR_MIN);
t('le même intervenant sur deux tablettes reste un seul observateur',
  deuxTablettes.map((m) => [m.cotations, m.intervenant]), [[3, 'Camille']]);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
