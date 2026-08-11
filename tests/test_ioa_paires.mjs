/* Accord inter-observateurs : appariement des séances en double cotation, et
   calcul de l'accord entre les deux.

   trouverPaires vivait ici en copie locale, regroupée par `atelierId` — un
   identifiant propre à chaque tablette (`_ateliers` est indexé par source).
   Deux intervenants qui cotent le même atelier depuis deux tablettes portent
   deux `atelierId` différents et ne tombaient jamais dans le même paquet :
   aucune paire ne sortait, et cette copie restait verte pendant que
   l'application ne détectait plus rien. Fonctions désormais extraites de
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

const NOMS = ['nomAtelier', 'trouverPaires', 'ioaPourEntree', 'comparerPaire'];
const code = [NOMS.map(extraire).join('\n'), `return { ${NOMS.join(', ')} };`].join('\n');
// eslint-disable-next-line no-new-func
const { trouverPaires, comparerPaire } = new Function(code)();

/* Séance minimale, avec sa tablette d'origine dans `_ateliers`/`_idVersInitiales`
   pour que nomAtelier et comparerPaire puissent résoudre nom d'atelier et
   initiales sans donnée superflue. */
const donnees = (ateliersParSource) => ({
  _ateliers: ateliersParSource,
  _idVersInitiales: {},
});
const s = (id, date, src, dbl, atelierId = 'a1') => ({
  id, date, source: src, doubleCotation: dbl, atelierId,
  studentIds: [], selectedObjectives: {}, data: {},
});

const memeAtelierPartout = donnees({
  tabA: { a1: 'Repas' }, tabB: { a1: 'Repas' }, tabC: { a1: 'Repas' },
});

t('aucune paire sans le marqueur',
  trouverPaires({ ...memeAtelierPartout, seances: [s('1', '2026-07-20', 'tabA', false), s('2', '2026-07-20', 'tabB', false)] }).length, 0);

t('paire détectée : même jour, deux appareils',
  trouverPaires({ ...memeAtelierPartout, seances: [s('1', '2026-07-20T09:00', 'tabA', true), s('2', '2026-07-20T09:05', 'tabB', true)] })
    .map((p) => [p.a.id, p.b.id]), [['1', '2']]);

t('même appareil : ce ne sont pas deux observateurs',
  trouverPaires({ ...memeAtelierPartout, seances: [s('1', '2026-07-20', 'tabA', true), s('2', '2026-07-20', 'tabA', true)] }).length, 0);

t('jours différents : aucune paire',
  trouverPaires({ ...memeAtelierPartout, seances: [s('1', '2026-07-20', 'tabA', true), s('2', '2026-07-21', 'tabB', true)] }).length, 0);

t('deux paires distinctes sur deux jours',
  trouverPaires({ ...memeAtelierPartout, seances: [
    s('1', '2026-07-20', 'tabA', true), s('2', '2026-07-20', 'tabB', true),
    s('3', '2026-07-22', 'tabA', true), s('4', '2026-07-22', 'tabB', true),
  ] }).length, 2);

t('une séance non marquée est ignorée dans le lot',
  trouverPaires({ ...memeAtelierPartout, seances: [
    s('1', '2026-07-20', 'tabA', true), s('2', '2026-07-20', 'tabB', true),
    s('3', '2026-07-20', 'tabC', false),
  ] }).length, 1);

/* Le cas qui a motivé la réécriture : même atelier, coté depuis deux
   tablettes qui ne s'accordent pas sur son identifiant. Sans le regroupement
   par nom, cette paire n'existait pas. */
t('même atelier, deux tablettes, atelierId différents : une paire',
  trouverPaires({
    _ateliers: { tabA: { at1: 'Repas' }, tabB: { at9: 'Repas' } },
    _idVersInitiales: {},
    seances: [
      s('1', '2026-07-20T09:00', 'tabA', true, 'at1'),
      s('2', '2026-07-20T09:05', 'tabB', true, 'at9'),
    ],
  }).map((p) => [p.a.id, p.b.id]), [['1', '2']]);

t('ateliers vraiment différents, même après résolution du nom : aucune paire',
  trouverPaires({
    _ateliers: { tabA: { at1: 'Repas' }, tabB: { at2: 'Habiletés' } },
    _idVersInitiales: {},
    seances: [
      s('1', '2026-07-20', 'tabA', true, 'at1'),
      s('2', '2026-07-20', 'tabB', true, 'at2'),
    ],
  }).length, 0);

/* ==================== comparerPaire ==================== */
const donneesComparaison = {
  _idVersInitiales: { tabA: { e1: 'L.M.' }, tabB: { e2: 'L.M.' } },
};
const objTrials = { type: 'trials', name: 'Attendre' };
const paire = {
  a: {
    source: 'tabA', studentIds: ['e1'],
    selectedObjectives: { e1: ['o1'] },
    objectiveSnapshot: { o1: objTrials },
    data: { e1: { o1: { trials: [{ code: 'I' }, { code: 'GP' }, { code: 'I' }] } } },
  },
  b: {
    source: 'tabB', studentIds: ['e2'],
    selectedObjectives: { e2: ['o1'] },
    objectiveSnapshot: { o1: objTrials },
    data: { e2: { o1: { trials: [{ code: 'I' }, { code: 'GT' }, { code: 'I' }] } } },
  },
};
const res = comparerPaire(paire, donneesComparaison);
t('deux tiers d’accord sur trois essais', res.pct, 67);
t('une seule ligne, sur la bonne personne', res.lignes.map((l) => l.initials), ['L.M.']);
t('trois points comparés', res.points, 3);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
