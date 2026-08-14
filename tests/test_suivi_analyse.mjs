/* Analyse du suivi continu : segments étiquetés par axe, chronologie par
   tranche, croisement de deux droites de tendance.

   Trois règles à ne pas perdre — deux axes se chevauchent dans le temps sans se
   borner l'un l'autre (et une journée ne se prolonge pas dans la suivante),
   une part se calcule sur le total de son propre axe dans sa propre tranche,
   et un croisement hors de la période observée n'est pas un croisement (rien
   n'est extrapolé).

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
  'jourLocal', 'segmentsJournee', 'cleAgregation', 'etiquetteAgregation',
  'tendanceLineaire', 'segmentsSuivi', 'chronologieSuivi', 'croisementTendances',
];
const code = [
  `const cleSerieSuivi = ${extraireLigne('cleSerieSuivi')};`,
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, cleSerieSuivi };`,
].join('\n');
// eslint-disable-next-line no-new-func
const {
  segmentsSuivi, chronologieSuivi, croisementTendances, tendanceLineaire, cleSerieSuivi,
} = new Function(code)();

/* Relevés tels que les rend `suiviDePersonne` : l'axe et le critère sont déjà
   résolus, la fonction n'a plus à les chercher. */
const calme = { k: 'calme', l: 'Calme', color: '#0F8B6C' };
const agite = { k: 'agite', l: 'Agité', color: '#A8402F' };
const travail = { k: 'travail', l: 'Travail', color: '#3B5BDB' };
const pause = { k: 'pause', l: 'Pause', color: '#FF8A3D' };

const rel = (nomAxe, meta, ts, fin) => ({ nomAxe, meta, cle: meta.k, timestamp: ts, fin: !!fin });
const HUMEUR = 'Humeur';
const ACTIVITE = 'Activité';

/* ==================== segmentsSuivi ==================== */

/* Deux axes cotés en parallèle le même jour. Sans regroupement par axe, le
   relevé d'activité de 09:30 bornerait celui d'humeur de 09:00 : une durée de
   trente minutes là où la personne est restée calme une heure. */
const memeJour = [
  rel(HUMEUR, calme, '2026-05-04T09:00:00'),
  rel(ACTIVITE, travail, '2026-05-04T09:30:00'),
  rel(HUMEUR, agite, '2026-05-04T10:00:00'),
  rel(HUMEUR, calme, '2026-05-04T10:30:00', true),
  rel(ACTIVITE, pause, '2026-05-04T11:00:00'),
];
const segs = segmentsSuivi(memeJour);
t('un segment par relevé non-clôture', segs.length, 4);
t('chaque segment porte son axe',
  segs.map((s) => [s.nomAxe, s.cle]),
  [[HUMEUR, 'calme'], [ACTIVITE, 'travail'], [HUMEUR, 'agite'], [ACTIVITE, 'pause']]);
t('un axe ne borne pas les segments de l autre',
  segs.filter((s) => s.nomAxe === HUMEUR).map((s) => s.ms), [60 * 60000, 30 * 60000]);
t('la clôture borne son axe sans en démarrer un',
  segs.filter((s) => s.nomAxe === ACTIVITE).map((s) => s.ms), [90 * 60000, null]);
t('les segments ressortent triés par début',
  segs.map((s) => s.debut).every((d, i, a) => i === 0 || a[i - 1] <= d), true);

/* Une journée ne se prolonge pas dans la suivante : le dernier relevé du lundi
   reste de durée inconnue, il ne dure pas jusqu'au premier du mardi. */
const deuxJours = segmentsSuivi([
  rel(HUMEUR, calme, '2026-05-04T17:00:00'),
  rel(HUMEUR, agite, '2026-05-05T09:00:00'),
]);
t('deux journées ne se chaînent pas', deuxJours.map((s) => s.ms), [null, null]);

t('aucun relevé : aucun segment', segmentsSuivi([]), []);
t('un horodatage illisible est écarté', segmentsSuivi([rel(HUMEUR, calme, 'pas une date')]), []);

/* ==================== chronologieSuivi ==================== */

const parJour = chronologieSuivi(segs, 'jour', 'duree');
t('une seule tranche pour une seule journée', parJour.length, 1);
t('la durée est rendue en minutes',
  [parJour[0].series[cleSerieSuivi(HUMEUR, 'calme')].valeur,
    parJour[0].series[cleSerieSuivi(HUMEUR, 'agite')].valeur], [60, 30]);
/* LE POINT CLÉ : chaque part se rapporte au total de son axe, pas au total
   général. Les deux critères d'humeur se partagent 100 %, l'unique critère
   d'activité borné en fait autant de son côté. */
t('les parts se rapportent à leur propre axe',
  [parJour[0].series[cleSerieSuivi(HUMEUR, 'calme')].part,
    parJour[0].series[cleSerieSuivi(HUMEUR, 'agite')].part,
    parJour[0].series[cleSerieSuivi(ACTIVITE, 'travail')].part], [67, 33, 100]);
t('un segment non borné n entre dans aucune part',
  parJour[0].series[cleSerieSuivi(ACTIVITE, 'pause')], undefined);

const parJourOcc = chronologieSuivi(segs, 'jour', 'occurrences');
t('en occurrences, chaque segment pèse 1 quelle que soit sa durée',
  [parJourOcc[0].series[cleSerieSuivi(HUMEUR, 'calme')].valeur,
    parJourOcc[0].series[cleSerieSuivi(HUMEUR, 'agite')].valeur], [1, 1]);
t('la part des occurrences suit le même dénominateur par axe',
  [parJourOcc[0].series[cleSerieSuivi(HUMEUR, 'calme')].part,
    parJourOcc[0].series[cleSerieSuivi(ACTIVITE, 'travail')].part], [50, 100]);

/* Trois journées de la même semaine, plus une de la semaine suivante. */
const troisJours = segmentsSuivi([
  rel(HUMEUR, calme, '2026-05-04T09:00:00'),
  rel(HUMEUR, calme, '2026-05-04T10:00:00', true),
  rel(HUMEUR, agite, '2026-05-05T09:00:00'),
  rel(HUMEUR, agite, '2026-05-05T09:30:00', true),
  rel(HUMEUR, calme, '2026-05-11T09:00:00'),
  rel(HUMEUR, calme, '2026-05-11T11:00:00', true),
]);
t('par jour : une tranche par journée', chronologieSuivi(troisJours, 'jour', 'duree').length, 3);
const parSemaine = chronologieSuivi(troisJours, 'semaine', 'duree');
t('par semaine : lundi et mardi se regroupent, la semaine suivante non', parSemaine.length, 2);
t('la semaine cumule les journées qu elle contient',
  [parSemaine[0].series[cleSerieSuivi(HUMEUR, 'calme')].valeur,
    parSemaine[0].series[cleSerieSuivi(HUMEUR, 'agite')].valeur], [60, 30]);
t('les tranches sortent dans l ordre du calendrier',
  parSemaine.map((x) => x.cle).every((c, i, a) => i === 0 || a[i - 1] < c), true);

/* Une journée entièrement non bornée ne fabrique pas une tranche à zéro : rien
   n'y a été mesuré, ce n'est pas la même chose qu'un zéro observé. */
const avecJourneeVide = segmentsSuivi([
  rel(HUMEUR, calme, '2026-05-04T09:00:00'),
  rel(HUMEUR, calme, '2026-05-04T10:00:00', true),
  rel(HUMEUR, agite, '2026-05-06T09:00:00'),
]);
t('une tranche sans durée connue n est pas créée',
  chronologieSuivi(avecJourneeVide, 'jour', 'duree').length, 1);
t('aucun segment : aucune tranche', chronologieSuivi([], 'jour', 'duree'), []);

/* Les minutes se cumulent avant d'être arrondies : deux segments de vingt
   secondes font quarante secondes, pas deux fois zéro minute. */
const courts = segmentsSuivi([
  rel(HUMEUR, calme, '2026-05-04T09:00:00'),
  rel(HUMEUR, calme, '2026-05-04T09:00:40', true),
  rel(HUMEUR, calme, '2026-05-04T10:00:00'),
  rel(HUMEUR, calme, '2026-05-04T10:00:40', true),
]);
t('l arrondi en minutes se fait sur le cumul, pas segment par segment',
  chronologieSuivi(courts, 'jour', 'duree')[0].series[cleSerieSuivi(HUMEUR, 'calme')].valeur, 1);

/* ==================== croisementTendances ==================== */

t('deux droites qui se croisent au milieu',
  croisementTendances([0, 1, 2, 3, 4], [4, 3, 2, 1, 0]), { index: 2, valeur: 2 });
t('un croisement peut tomber entre deux tranches',
  croisementTendances([0, 1, 2, 3], [2, 1.5, 1, 0.5]), { index: 1.33, valeur: 1.33 });
t('deux droites parallèles ne se croisent pas',
  croisementTendances([0, 1, 2], [1, 2, 3]), null);
t('deux droites confondues non plus (aucun point de croisement à désigner)',
  croisementTendances([0, 1, 2], [0, 1, 2]), null);
/* LE POINT CLÉ : rien n'est extrapolé. Un croisement au-delà du dernier point
   observé, ou avant le premier, n'est pas une date à annoncer. */
t('un croisement après la dernière tranche ne compte pas',
  croisementTendances([0, 1, 2], [5, 5.5, 6]), null);
t('un croisement avant la première tranche non plus',
  croisementTendances([3, 4, 5], [0, 0.5, 1]), null);
t('un croisement pile sur la dernière tranche compte',
  croisementTendances([0, 1, 2], [4, 3, 2]), { index: 2, valeur: 2 });
t('série trop courte pour une tendance', croisementTendances([0, 1], [1, 0]), null);
t('deux séries de longueurs différentes', croisementTendances([0, 1, 2], [1, 0]), null);
t('tendance absente d un côté', croisementTendances(null, [1, 2, 3]), null);

/* Enchaînement réel : les valeurs passent par tendanceLineaire avant d'arriver
   ici — c'est ce couple-là qui est affiché, pas des droites idéales. */
const fitA = tendanceLineaire([0, 3, 2, 7, 8]);
const fitB = tendanceLineaire([9, 6, 7, 2, 1]);
const croise = croisementTendances(fitA, fitB);
t('une série bruitée se croise à l intérieur de la période observée',
  croise && croise.index > 0 && croise.index < 4, true);
t('le croisement est lu sur les droites ajustées, pas sur les points bruts',
  croise && croise.index, 2.25);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
