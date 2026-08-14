/* Fusion à l'import : nouvelles entrées ajoutées, entrées déjà connues
   REMPLACÉES par la version entrante, aucun doublon, tables de correspondance
   distinctes par tablette.

   Ce fichier réimplémentait la fusion au lieu de l'extraire, et son en-tête
   annonçait « existantes mises à jour » alors que le code de production
   déduplique — le test serait resté vert quoi qu'il arrive. Il extrait
   désormais `fusionnerParId` et `fusionnerImport` de src/App.jsx, comme
   test_import_suivi_seul.mjs. */

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

const NOMS = ['fusionnerParId', 'fusionnerClasses', 'fusionnerImport'];
const code = [
  extraire('VIDE'),
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, VIDE };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { fusionnerParId, fusionnerImport, VIDE } = new Function(code)();

/* ==================== fusionnerParId ==================== */

const a = { id: 'x', v: 1 };
const b = { id: 'y', v: 2 };
const f1 = fusionnerParId([a], [b], null);
t('un identifiant inconnu s ajoute', f1.liste.map((x) => x.id), ['x', 'y']);
t('et compte comme nouveau', [f1.nouveaux, f1.majs], [1, 0]);

/* LE POINT CLÉ : le fichier importé gagne. Avant, un identifiant déjà connu
   était purement ignoré et sa correction perdue en silence. */
const f2 = fusionnerParId([a, b], [{ id: 'x', v: 99 }], null);
t('un identifiant connu est remplacé', f2.liste.find((x) => x.id === 'x').v, 99);
t('le remplacement reste à sa place dans la liste', f2.liste.map((x) => x.id), ['x', 'y']);
t('et compte comme mise à jour, pas comme nouveau', [f2.nouveaux, f2.majs], [0, 1]);

const f3 = fusionnerParId([a, b], [{ ...a }], null);
t('un enregistrement identique n est pas compté comme mis à jour', [f3.nouveaux, f3.majs], [0, 0]);

const f4 = fusionnerParId([a], [{ id: 'z' }], (x) => ({ ...x, marque: true }));
t('la transformation s applique aux entrants', f4.liste[1].marque, true);
t('elle ne touche pas les enregistrements déjà là', f4.liste[0].marque, undefined);

t('une entrée nulle est ignorée', fusionnerParId([a], [null, undefined], null).liste.length, 1);
t('aucun entrant : la liste ne bouge pas', fusionnerParId([a, b], [], null).liste.length, 2);
t('aucun entrant : rien à signaler', fusionnerParId([a], null, null).nouveaux, 0);

/* ==================== fusionnerImport ==================== */

const backupA = {
  students: [{ id: 'sA1', initials: 'L.M.' }, { id: 'sA2', initials: 'T.B.' }],
  sessions: [{ id: 'sessA1', date: '2026-07-01' }, { id: 'sessA2', date: '2026-07-05' }],
  crises: [{ id: 'cA1', date: '2026-07-01', studentId: 'sA1' }],
};
const r1 = fusionnerImport(VIDE, backupA, 'tablette-atelier1');
t('personnes créées au premier import', r1.personnes.map((p) => p.initials), ['L.M.', 'T.B.']);
t('deux séances importées', r1.seances.length, 2);
t('nouvelles séances comptées', r1.nbNouvellesSeances, 2);
t('source enregistrée', r1.sources, ['tablette-atelier1']);
t('la séance porte sa tablette', r1.seances[0].source, 'tablette-atelier1');

/* Réimport à l'identique : aucun doublon, et surtout aucune mise à jour
   annoncée — sinon le compte gonflerait à chaque envoi du même fichier. */
const r2 = fusionnerImport(r1, backupA, 'tablette-atelier1');
t('réimport identique : aucun doublon', r2.seances.length, 2);
t('aucune nouvelle séance comptée', r2.nbNouvellesSeances, 0);
t('aucune mise à jour annoncée', [r2.nbSeancesMisesAJour, r2.nbCrisesMisesAJour], [0, 0]);
t('aucune personne dupliquée', r2.personnes.length, 2);

/* Nouvel export de la même tablette : une séance en plus, et une séance
   existante re-cotée. */
const backupA2 = {
  students: backupA.students,
  sessions: [
    { id: 'sessA1', date: '2026-07-01', data: { sA1: { o1: { count: 8 } } } },
    backupA.sessions[1],
    { id: 'sessA3', date: '2026-07-10' },
  ],
  crises: [{ id: 'cA1', date: '2026-07-01', studentId: 'sA1', durationMs: 600000 }],
};
const r3 = fusionnerImport(r2, backupA2, 'tablette-atelier1');
t('seule la nouvelle séance s ajoute', r3.seances.length, 3);
t('une seule nouvelle comptée', r3.nbNouvellesSeances, 1);
t('LE POINT CLÉ : la séance re-cotée est mise à jour',
  r3.seances.find((s) => s.id === 'sessA1').data.sA1.o1.count, 8);
t('la mise à jour est comptée à part de l ajout', r3.nbSeancesMisesAJour, 1);
t('la crise complétée après coup remonte aussi',
  r3.crises.find((c) => c.id === 'cA1').durationMs, 600000);
t('et compte comme mise à jour de crise', r3.nbCrisesMisesAJour, 1);
t('l ordre de l historique ne se réordonne pas',
  r3.seances.map((s) => s.id), ['sessA1', 'sessA2', 'sessA3']);

/* Un relevé de suivi corrigé suit la même règle. */
const backupSuivi = {
  students: [{ id: 'sA1', initials: 'L.M.' }],
  suivi: [{ id: 'r1', studentId: 'sA1', timestamp: '2026-07-01T09:00:00', suiviId: 'ax', critere: 'calme' }],
  sessions: [], crises: [],
};
const s1 = fusionnerImport(VIDE, backupSuivi, 'tablette-atelier1');
const s2 = fusionnerImport(s1, {
  ...backupSuivi,
  suivi: [{ ...backupSuivi.suivi[0], critere: 'agite' }],
}, 'tablette-atelier1');
t('un relevé corrigé est mis à jour', s2.suivi[0].critere, 'agite');
t('sans compter un relevé de plus', [s2.nbNouveauxReleves, s2.nbRelevesMisAJour], [0, 1]);

/* Une DEUXIÈME tablette, avec une personne différente */
const backupB = {
  students: [{ id: 'sB1', initials: 'J.D.' }],
  sessions: [{ id: 'sessB1', date: '2026-07-03' }],
};
const r4 = fusionnerImport(r3, backupB, 'tablette-atelier2');
t('deux sources désormais connues', r4.sources, ['tablette-atelier1', 'tablette-atelier2']);
t('trois personnes au total', r4.personnes.map((p) => p.initials), ['L.M.', 'T.B.', 'J.D.']);
t('les séances des deux tablettes cohabitent', r4.seances.length, 4);

/* Le même identifiant interne réutilisé sur une AUTRE tablette n'écrase pas la
   table de la première. */
t('table de correspondance distincte par source',
  Object.keys(r4._idVersInitiales), ['tablette-atelier1', 'tablette-atelier2']);
t('la table de la première tablette reste intacte',
  r4._idVersInitiales['tablette-atelier1'].sA1, 'L.M.');

/* --- Classification à trois états --- */
function classer(points, crit) {
  if (!points.length) return 'non_acquis';
  if (!crit) return 'en_cours';
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) { if (points[i].value >= crit.threshold) streak++; else break; }
  return streak >= crit.needed ? 'acquis' : 'en_cours';
}
const crit = { threshold: 80, needed: 3 };
t('aucune donnée → non acquis', classer([], crit), 'non_acquis');
t('en cours, sous le seuil', classer([{ value: 50 }, { value: 60 }], crit), 'en_cours');
t('acquis : 3 d affilée au seuil', classer([{ value: 85 }, { value: 90 }, { value: 82 }], crit), 'acquis');
t('une rupture de série repart de zéro', classer([{ value: 90 }, { value: 90 }, { value: 60 }, { value: 85 }], crit), 'en_cours');
t('sans critère défini : en cours par défaut', classer([{ value: 90 }], null), 'en_cours');

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
