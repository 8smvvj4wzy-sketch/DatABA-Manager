/* Import partiel : un fichier qui ne porte que des relevés de suivi continu,
   venu d'une tablette déjà importée.

   Les tables indexées par source (`_idVersInitiales`, `_ateliers`,
   `_intervenants`) étaient remplacées à chaque import et non complétées : un
   fichier sans `students` y posait une table vide, et toutes les données déjà
   consolidées pour cette tablette devenaient orphelines — plus une seule
   cotation, plus un seul relevé rattaché à quiconque — sans le moindre
   message, alors qu'elles restaient bien en mémoire.

   Fonctions extraites de src/App.jsx, pas recopiées : voir test_suivi.mjs. */

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
  'fusionnerParId', 'fusionnerImport', 'fusionnerClasses', 'normaliser',
  'axeDe', 'metaCritereSuivi', 'axeEtCritereDuReleve', 'suiviDePersonne',
  'compteursDePersonne',
];
const code = [
  `const estReleveCompteur = ${extraireLigne('estReleveCompteur')};`,
  `const nomCompteurDe = ${extraireLigne('nomCompteurDe')};`,
  `const ACQUIS = '#0F8B6C'; const EN_COURS = '#D69A2D'; const NON_ACQUIS = '#A8402F'; const INK_SOFT = '#6B7280'; const CAT_INDIGO = '#3B5BDB';`,
  `const CRITERE_INCONNU_SUIVI = ${extraireLigne('CRITERE_INCONNU_SUIVI')};`,
  extraire('VIDE'),
  extraire('CRITERES_STABILITE_V3'),
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, VIDE };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { fusionnerImport, normaliser, suiviDePersonne, VIDE } = new Function(code)();

const axes = [{ id: 'principal', nom: 'Suivi de stabilité', criteres: [
  { k: 'stable', l: 'Stable', color: '#0F8B6C' },
  { k: 'crise', l: 'Crise', color: '#A8402F' },
] }];

/* Premier import : la sauvegarde complète d'une tablette. */
const complet = {
  students: [{ id: 'e1', initials: 'L.M.' }, { id: 'e2', initials: 'T.B.' }],
  ateliers: [{ id: 'at1', name: 'Repas' }],
  intervenants: [{ id: 'i1', name: 'Camille' }],
  axesSuivi: axes,
  sessions: [{ id: 's1', date: '2026-06-01', studentIds: ['e1'], atelierId: 'at1', intervenantId: 'i1' }],
  crises: [],
  suivi: [{ id: 'r1', studentId: 'e1', suiviId: 'principal', critere: 'stable', timestamp: '2026-06-01T09:00:00' }],
};
const apres1 = normaliser(fusionnerImport(normaliser(VIDE), complet, 'tabA'));

t('premier import : la personne est rattachée', suiviDePersonne(apres1, 'L.M.').length, 1);
t('premier import : un relevé compté', apres1.nbNouveauxReleves, 1);

/* Second import : le même appareil, mais un fichier qui ne porte que des
   relevés — ni students, ni ateliers, ni intervenants. */
const suivisSeuls = {
  axesSuivi: axes,
  suivi: [
    { id: 'r1', studentId: 'e1', suiviId: 'principal', critere: 'stable', timestamp: '2026-06-01T09:00:00' },
    { id: 'r2', studentId: 'e1', suiviId: 'principal', critere: 'crise', timestamp: '2026-06-02T10:30:00' },
    { id: 'r3', studentId: 'e2', suiviId: 'principal', critere: 'stable', timestamp: '2026-06-02T11:00:00' },
  ],
};
const apres2 = normaliser(fusionnerImport(apres1, suivisSeuls, 'tabA'));

t('la table des initiales survit', apres2._idVersInitiales.tabA, { e1: 'L.M.', e2: 'T.B.' });
t('les ateliers survivent', apres2._ateliers.tabA, { at1: 'Repas' });
t('les intervenants survivent', apres2._intervenants.tabA, { i1: 'Camille' });
t('les relevés déjà là ne sont pas dupliqués', apres2.suivi.length, 3);
t('seuls les nouveaux sont comptés', apres2.nbNouveauxReleves, 2);
t('les relevés restent rattachés', suiviDePersonne(apres2, 'L.M.').map((r) => r.id), ['r2', 'r1']);
t('la seconde personne aussi', suiviDePersonne(apres2, 'T.B.').map((r) => r.id), ['r3']);
t('la séance déjà consolidée ne bouge pas', apres2.seances.map((s) => s.id), ['s1']);
t('la personne n’est pas dupliquée', apres2.personnes.map((p) => p.initials), ['L.M.', 'T.B.']);

/* Le champ `source` du relevé désigne l'origine du geste côté DatABA : il est
   renommé `origine`, `source` revenant à la tablette. Vrai aussi sur un import
   partiel — c'est le seul chemin par lequel ces relevés entrent. */
const avecOrigine = normaliser(fusionnerImport(apres2, {
  axesSuivi: axes,
  suivi: [{ id: 'r4', studentId: 'e1', suiviId: 'principal', critere: 'stable', source: 'pastille', timestamp: '2026-06-03T08:00:00' }],
}, 'tabA'));
const r4 = avecOrigine.suivi.find((r) => r.id === 'r4');
t('source du relevé renommé en origine', [r4.origine, r4.source], ['pastille', 'tabA']);

/* Une tablette encore inconnue ne doit pas hériter des tables d'une autre. */
const autreTablette = normaliser(fusionnerImport(apres2, suivisSeuls, 'tabB'));
t('une source neuve part d’une table vide', autreTablette._idVersInitiales.tabB, {});
t('sans écraser celle de la première', autreTablette._idVersInitiales.tabA, { e1: 'L.M.', e2: 'T.B.' });
t('des relevés non rattachables restent invisibles côté personne',
  suiviDePersonne(autreTablette, 'L.M.').filter((r) => r.source === 'tabB').length, 0);

/* Un fichier vide n'efface rien : c'est le cas dégénéré du même bug. */
const vide = normaliser(fusionnerImport(apres2, {}, 'tabA'));
t('un fichier vide ne vide pas la table', vide._idVersInitiales.tabA, { e1: 'L.M.', e2: 'T.B.' });
t('un fichier vide ne retire aucun relevé', vide.suivi.length, 3);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
