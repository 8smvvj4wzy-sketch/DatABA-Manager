/* Classes (ex-Groupes DatABA) : lecture à l'import, alias `groupes` de
   compatibilité, et la collision d'initiales entre classes qu'elles peuvent
   révéler. Fonctions extraites de src/App.jsx, pas recopiées — voir
   test_acquisition.mjs pour la raison. */

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

const NOMS = ['fusionnerClasses', 'fusionnerImport', 'nomClasseDe'];
const code = [
  `const VIDE = ${extraire('VIDE').replace(/^const VIDE = /, '')}`,
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, VIDE };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { fusionnerClasses, fusionnerImport, nomClasseDe, VIDE } = new Function(code)();

/* ==================== VIDE et fusionnerClasses ==================== */

t('VIDE porte une liste de classes vide', VIDE.classes, []);

t('classes du backup reprises telles quelles',
  fusionnerClasses([], { classes: [{ id: 'c1', name: 'CE2' }] }), [{ id: 'c1', nom: 'CE2' }]);
t('alias groupes lu si classes absent',
  fusionnerClasses([], { groupes: [{ id: 'c1', name: 'CE2' }] }), [{ id: 'c1', nom: 'CE2' }]);
t('classes prime sur groupes si les deux sont présents (même contenu attendu)',
  fusionnerClasses([], { classes: [{ id: 'c1', name: 'CE2' }], groupes: [{ id: 'c1', name: 'CE2' }] }).length, 1);
t('une classe déjà connue n est pas dupliquée',
  fusionnerClasses([{ id: 'c1', nom: 'CE2' }], { classes: [{ id: 'c1', name: 'CE2' }] }).length, 1);
t('une classe sans id est ignorée', fusionnerClasses([], { classes: [{ name: 'Sans id' }] }), []);
t('deux classes distinctes s additionnent',
  fusionnerClasses([{ id: 'c1', nom: 'CE2' }], { classes: [{ id: 'c2', name: 'CM1' }] }).map((c) => c.id).sort(),
  ['c1', 'c2']);

/* ==================== fusionnerImport : classeId sur la personne ==================== */

const backupBase = {
  students: [{ id: 'a1', initials: 'L.M.', classeId: 'c1' }],
  classes: [{ id: 'c1', name: 'CE2' }],
  sessions: [], crises: [], stabilite: [], ateliers: [], intervenants: [],
};

const r1 = fusionnerImport(VIDE, backupBase, 'tabA');
t('la personne porte la classe de son import', r1.personnes[0].classeId, 'c1');
t('la classe apparaît dans la liste', r1.classes.map((c) => c.nom), ['CE2']);
t('aucune collision sur un premier import', r1.collisionsInitiales, 0);
t('nomClasseDe résout le nom', nomClasseDe(r1, 'L.M.'), 'CE2');
t('nomClasseDe renvoie null pour une personne inconnue', nomClasseDe(r1, 'X.X.'), null);

/* Alias `groupeId` / `groupes`, émis par une tablette pas encore migrée. */
const r1bis = fusionnerImport(VIDE, {
  students: [{ id: 'a1', initials: 'L.M.', groupeId: 'g1' }],
  groupes: [{ id: 'g1', name: 'CM2' }],
  sessions: [], crises: [], stabilite: [],
}, 'tabA');
t('groupeId est lu comme classeId', r1bis.personnes[0].classeId, 'g1');
t('groupes est lu comme classes', r1bis.classes.map((c) => c.nom), ['CM2']);

/* Une personne déjà connue sans classe complète sa classe au réimport. */
const sansClasse = { ...VIDE, personnes: [{ id: 'a1', initials: 'L.M.', classeId: null }] };
const r2 = fusionnerImport(sansClasse, backupBase, 'tabA');
t('la classe complète une personne qui n en avait pas', r2.personnes[0].classeId, 'c1');

/* Collision : deux personnes aux mêmes initiales, classes différentes. La
   fusion par initiales les réunit quand même — c'est le comportement
   existant — mais la compte et le signale, plutôt que de l'ignorer. */
const avecClasse = fusionnerImport(VIDE, backupBase, 'tabA');
const r3 = fusionnerImport(avecClasse, {
  students: [{ id: 'b1', initials: 'L.M.', classeId: 'c2' }],
  classes: [{ id: 'c2', name: 'CM1' }],
  sessions: [], crises: [], stabilite: [],
}, 'tabB');
t('la collision de classes est comptée', r3.collisionsInitiales, 1);
t('une seule personne reste malgré la collision', r3.personnes.length, 1);

/* Deux tablettes sur la même classe : pas de collision. */
const r4 = fusionnerImport(avecClasse, backupBase, 'tabB');
t('même classe sur deux tablettes : aucune collision', r4.collisionsInitiales, 0);

console.log(`\n${ok} réussis, ${ko} en échec`);
process.exit(ko ? 1 : 0);
