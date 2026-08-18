/* La date d'acquisition d'un objectif.

   `etatDeSerie` ne rend que l'état du moment : un objectif atteint en janvier
   et un autre atteint la semaine dernière s'y lisent à l'identique. « Combien
   d'objectifs acquis ce trimestre ? » — la question même du bilan — était donc
   sans réponse, alors que les points datés et `suiteAuSeuil` contenaient déjà
   tout ce qu'il fallait.

   `dateAcquisition` est le pendant exact de `suiteAuSeuil` : celle-ci compte
   la suite en cours depuis la fin, celle-là balaie depuis le début et s'arrête
   à la première atteinte. Les deux doivent rester d'accord sur ce qu'est une
   suite (rupture qui remet à zéro, regroupement par journée, sens du seuil) —
   c'est ce que cette suite verrouille.

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

const NOMS = ['tientLeSeuil', 'pointsParJour', 'serieCritere', 'suiteAuSeuil', 'dateAcquisition'];
const code = [NOMS.map(extraire).join('\n'), `return { ${NOMS.join(', ')} };`].join('\n');
// eslint-disable-next-line no-new-func
const { suiteAuSeuil, dateAcquisition } = new Function(code)();

/* Critère par défaut d'un objectif en pourcentage : 80 % sur 3 séances. */
const seances80 = { threshold: 80, needed: 3, unit: 'sessions', sens: 'min', pourcent: true };
const pt = (date, value) => ({ date, value });

/* ==================== Le cas nominal ==================== */
const montee = [pt('2026-03-02', 70), pt('2026-03-05', 85), pt('2026-03-09', 90), pt('2026-03-12', 95)];
t('la date est celle de la cotation qui complète la suite',
  dateAcquisition(montee, [], seances80), '2026-03-12');
t('et non celle où le seuil a été franchi pour la première fois',
  dateAcquisition(montee, [], seances80) === '2026-03-05', false);

/* ==================== Ce qui casse une suite ==================== */
const rupture = [
  pt('2026-03-02', 85), pt('2026-03-05', 90), pt('2026-03-09', 60),
  pt('2026-03-12', 85), pt('2026-03-16', 90), pt('2026-03-19', 95),
];
t('une cotation sous le seuil remet la suite à zéro',
  dateAcquisition(rupture, [], seances80), '2026-03-19');

/* Le pendant de `suiteAuSeuil` : sur la même série, les deux doivent raconter
   la même chose. Trois d'affilée à la fin, et une acquisition datée. */
t('suiteAuSeuil confirme la suite en cours', suiteAuSeuil(rupture, seances80), 3);

/* ==================== Jamais atteint ==================== */
t('un seuil jamais tenu ne rend aucune date',
  dateAcquisition([pt('2026-03-02', 40), pt('2026-03-05', 55)], [], seances80), null);
t('deux cotations au seuil ne suffisent pas quand il en faut trois',
  dateAcquisition([pt('2026-03-02', 85), pt('2026-03-05', 90)], [], seances80), null);
t('une série vide ne rend aucune date', dateAcquisition([], [], seances80), null);

/* ==================== Sans critère applicable ==================== */
/* Un suivi en mesure brute que personne n'a demandé de juger : `critereDe`
   rend null et l'objectif porte l'état « Suivi en mesure ». Le dater serait
   inventer une acquisition que rien ne définit. */
t('sans critère, aucune date', dateAcquisition(montee, [], null), null);

/* ==================== Le seuil à une seule cotation ==================== */
t('avec needed à 1, la première cotation au seuil suffit',
  dateAcquisition(montee, [], { ...seances80, needed: 1 }), '2026-03-05');

/* ==================== Le sens du seuil ==================== */
/* Comportement problème coté en occurrences : acquis quand il passe SOUS le
   seuil. La série jugée est alors `mesures`, pas `points` — `pourcent` est
   faux — et c'est `tientLeSeuil` qui interprète `sens`. */
const comptage = { threshold: 2, needed: 3, unit: 'sessions', sens: 'max', pourcent: false, explicite: true };
const occurrences = [pt('2026-03-02', 7), pt('2026-03-05', 2), pt('2026-03-09', 1), pt('2026-03-12', 0)];
t('en sens max, la suite se compte sous le seuil',
  dateAcquisition([], occurrences, comptage), '2026-03-12');
t('et la série lue est bien `mesures`, pas `points`',
  dateAcquisition(occurrences, [], comptage), null);

/* ==================== Le critère exprimé en jours ==================== */
/* Deux probes le même jour ne font qu'une journée : la moyenne du jour est
   jugée, pas chaque prise. Ici le 2 mars vaut (100 + 0) / 2 = 50, sous le
   seuil — l'acquisition ne peut donc pas commencer là. */
const parJour = { threshold: 100, needed: 3, unit: 'days', sens: 'min', pourcent: true };
const probes = [
  pt('2026-03-02T09:00:00', 100), pt('2026-03-02T15:00:00', 0),
  pt('2026-03-03T09:00:00', 100), pt('2026-03-04T09:00:00', 100), pt('2026-03-05T09:00:00', 100),
];
t('trois journées entières au seuil, pas trois prises',
  dateAcquisition(probes, [], parJour), '2026-03-05T09:00:00');
t('la date rendue est celle d’une vraie cotation, pas un jour reconstruit',
  probes.some((p) => p.date === dateAcquisition(probes, [], parJour)), true);

/* ==================== La première atteinte fait foi ==================== */
/* Un objectif acquis, retombé, puis réacquis garde sa première date. C'est la
   limite assumée : le document dit quand le critère a été atteint la première
   fois, pas la dernière. */
const rechute = [
  pt('2026-01-05', 85), pt('2026-01-08', 90), pt('2026-01-12', 95),
  pt('2026-02-02', 40), pt('2026-02-05', 30),
  pt('2026-03-02', 85), pt('2026-03-05', 90), pt('2026-03-09', 95),
];
t('la première acquisition est celle qui est datée',
  dateAcquisition(rechute, [], seances80), '2026-01-12');
t('alors que l’état du moment se lit sur la fin de série',
  suiteAuSeuil(rechute, seances80), 3);

/* ==================== Robustesse ==================== */
t('une série absente ne fait pas tomber la fonction',
  dateAcquisition(undefined, undefined, seances80), null);
t('une valeur nulle ne tient pas le seuil',
  dateAcquisition([pt('2026-03-02', null), pt('2026-03-05', 85), pt('2026-03-09', 90), pt('2026-03-12', 95)], [], seances80),
  '2026-03-12');

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
