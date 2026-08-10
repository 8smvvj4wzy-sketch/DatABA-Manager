/* Suivi continu multi-axes : `suivi` (v4) prime sur `stabilite` (alias v3)
   à l'import, jamais les deux pour ne pas dupliquer les mêmes relevés ; un
   critère retiré de la configuration retombe sur CRITERE_INCONNU_SUIVI sans
   jamais ressusciter la clé d'origine. Fonctions extraites de src/App.jsx. */

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
  'fusionnerImport', 'fusionnerClasses', 'idPourSource',
  'axeDe', 'metaCritereSuivi', 'axeEtCritereDuReleve', 'suiviDePersonne',
];
const code = [
  `const ACQUIS = '#0F8B6C'; const EN_COURS = '#D69A2D'; const NON_ACQUIS = '#A8402F'; const INK_SOFT = '#6B7280'; const CAT_INDIGO = '#3B5BDB';`,
  `const CRITERE_INCONNU_SUIVI = ${extraireLigne('CRITERE_INCONNU_SUIVI')};`,
  extraire('VIDE'),
  extraire('CRITERES_STABILITE_V3'),
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, VIDE, CRITERE_INCONNU_SUIVI };`,
].join('\n');
// eslint-disable-next-line no-new-func
const {
  fusionnerImport, axeDe, metaCritereSuivi, axeEtCritereDuReleve, suiviDePersonne, VIDE, CRITERE_INCONNU_SUIVI,
} = new Function(code)();

/* ==================== Priorité suivi / stabilite à l'import ==================== */

const axesSuivi = [{ id: 'principal', nom: 'Suivi de stabilité', criteres: [
  { k: 'stable', l: 'Stable', color: '#0F8B6C' },
  { k: 'crise', l: 'Crise', color: '#A8402F' },
] }];

const backupV4 = {
  students: [{ id: 'a1', initials: 'L.M.' }],
  axesSuivi,
  suivi: [{ id: 'r1', studentId: 'a1', timestamp: '2026-05-01T09:00:00.000Z', suiviId: 'principal', critere: 'stable' }],
  /* Le même relevé, projeté en v3 — présent dans tout fichier v4 réel, et qui
     ne doit surtout pas être additionné à `suivi`. */
  stabilite: [{ id: 'r1', studentId: 'a1', timestamp: '2026-05-01T09:00:00.000Z', etat: 'stable', source: 'pastille' }],
  sessions: [], crises: [],
};
const rV4 = fusionnerImport(VIDE, backupV4, 'tabA');
t('un fichier v4 alimente suivi', rV4.suivi.length, 1);
t('un fichier v4 n alimente pas stabilite en plus', rV4.stabilite.length, 0);
t('les axes sont stockés par source', rV4._axesSuivi.tabA, axesSuivi);
t('le relevé garde son origine, sa source devient la tablette',
  [rV4.suivi[0].origine, rV4.suivi[0].source], [null, 'tabA']);

const backupV3 = {
  students: [{ id: 'a1', initials: 'L.M.' }],
  stabilite: [{ id: 'r2', studentId: 'a1', timestamp: '2026-05-02T09:00:00.000Z', etat: 'crise', source: 'pastille' }],
  sessions: [], crises: [],
};
const rV3 = fusionnerImport(VIDE, backupV3, 'tabB');
t('un fichier v3 (sans suivi) alimente stabilite', rV3.stabilite.length, 1);
t('un fichier v3 n alimente pas suivi', rV3.suivi.length, 0);

/* Un fichier v4 dont `suivi` est vide (aucun relevé sur la sélection
   exportée) reste un fichier v4 : la présence de la clé prime sur son
   contenu, sinon Manager retomberait sur `stabilite` et dupliquerait au
   prochain import qui, lui, en contiendrait. */
const rV4Vide = fusionnerImport(VIDE, { ...backupV4, suivi: [], stabilite: backupV4.stabilite }, 'tabA');
t('suivi vide mais présent : pas de repli sur stabilite', rV4Vide.stabilite.length, 0);

/* Réimporter le même fichier ne duplique rien, dans un sens comme dans l autre. */
const reimportV4 = fusionnerImport(rV4, backupV4, 'tabA');
t('réimport v4 : pas de doublon', reimportV4.suivi.length, 1);

/* ==================== Lecture d un relevé : axe, critère, repli ==================== */

const donneesLecture = {
  ...rV4,
  personnes: [{ id: 'a1', initials: 'L.M.' }],
  _idVersInitiales: { tabA: { a1: 'L.M.' } },
};

t('axeDe retrouve l axe par id', axeDe(axesSuivi, 'principal').nom, 'Suivi de stabilité');
t('axeDe renvoie null pour un axe inconnu', axeDe(axesSuivi, 'fantome'), null);
t('metaCritereSuivi retrouve le critère', metaCritereSuivi(axesSuivi[0].criteres, 'stable').l, 'Stable');
t('metaCritereSuivi replie sur CRITERE_INCONNU_SUIVI', metaCritereSuivi(axesSuivi[0].criteres, 'retire'), CRITERE_INCONNU_SUIVI);

const releveV4 = { source: 'tabA', suiviId: 'principal', critere: 'stable' };
const infosV4 = axeEtCritereDuReleve(donneesLecture, releveV4, true);
t('un relevé v4 résout l axe de sa source', infosV4.nomAxe, 'Suivi de stabilité');
t('un relevé v4 résout le critère', infosV4.meta.l, 'Stable');

const releveAxeRetire = { source: 'tabA', suiviId: 'axe-supprime', critere: 'stable' };
const infosAxeRetire = axeEtCritereDuReleve(donneesLecture, releveAxeRetire, true);
t('un axe retiré de la configuration ne ressuscite pas', infosAxeRetire.nomAxe, 'Suivi retiré');
t('son critère retombe sur le repli générique', infosAxeRetire.meta, CRITERE_INCONNU_SUIVI);

const releveV3 = { source: 'tabB', etat: 'crise' };
const infosV3 = axeEtCritereDuReleve(donneesLecture, releveV3, false);
t('un relevé v3 porte l axe historique implicite', infosV3.nomAxe, 'Suivi de stabilité');
t('un relevé v3 résout son état sur les critères historiques', infosV3.meta.l, 'Crise');

/* ==================== suiviDePersonne : v4 et v3 réunis ==================== */

const donneesMixtes = {
  ...VIDE,
  personnes: [{ id: 'a1', initials: 'L.M.' }],
  _idVersInitiales: { tabA: { a1: 'L.M.' } },
  _axesSuivi: { tabA: axesSuivi },
  suivi: [{ id: 'r1', studentId: 'a1', timestamp: '2026-05-03T09:00:00.000Z', suiviId: 'principal', critere: 'stable', source: 'tabA' }],
  stabilite: [{ id: 'r0', studentId: 'a1', timestamp: '2026-05-01T09:00:00.000Z', etat: 'crise', source: 'tabA' }],
};
const historique = suiviDePersonne(donneesMixtes, 'L.M.');
t('les deux formats apparaissent dans le même historique', historique.length, 2);
t('trié du plus récent au plus ancien', historique.map((r) => r.id), ['r1', 'r0']);
t('une personne sans relevé n a pas d historique', suiviDePersonne(donneesMixtes, 'X.X.'), []);

console.log(`\n${ok} réussis, ${ko} en échec`);
process.exit(ko ? 1 : 0);
