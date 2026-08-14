/* Frise de suivi continu : découpage d'une journée en segments et répartition
   du temps par critère. Deux règles à ne pas perdre : un segment non borné
   (aucune clôture, aucun relevé suivant) reste `ms: null` plutôt que d'être
   étiré jusqu'à minuit — ce serait inventer une donnée jamais saisie ; et un
   tel segment est exclu du dénominateur des pourcentages, pas compté comme
   zéro. Fonctions extraites de src/App.jsx, pas recopiées — voir
   test_suivi.mjs pour la raison. */

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

const NOMS = ['jourLocal', 'segmentsJournee', 'repartitionCriteres'];
const code = [NOMS.map(extraire).join('\n'), `return { ${NOMS.join(', ')} };`].join('\n');
// eslint-disable-next-line no-new-func
const { jourLocal, segmentsJournee, repartitionCriteres } = new Function(code)();

/* ==================== jourLocal ==================== */
t('jour local, pas UTC', jourLocal('2026-06-01T23:30:00'), '2026-06-01');
t('horodatage invalide', jourLocal('n’importe quoi'), null);

/* ==================== segmentsJournee ==================== */
const stable = { l: 'Stable', color: '#0F8B6C' };
const crise = { l: 'Crise', color: '#A8402F' };

const relevesJour = [
  { timestamp: '2026-06-01T09:00:00', meta: stable, cle: 'stable' },
  { timestamp: '2026-06-01T10:30:00', meta: crise, cle: 'crise' },
  { timestamp: '2026-06-01T11:00:00', fin: true },
];
const segs = segmentsJournee(relevesJour);
t('une clôture ne démarre pas de segment', segs.length, 2);
t('le premier segment est borné par le second relevé', segs[0].ms, 90 * 60000);
t('le second segment est borné par la clôture', segs[1].ms, 30 * 60000);
t('la clé du segment est celle du relevé qui l’a ouvert', segs.map((s) => s.cle), ['stable', 'crise']);

const sansCloture = [
  { timestamp: '2026-06-01T09:00:00', meta: stable, cle: 'stable' },
];
const segSeul = segmentsJournee(sansCloture);
t('dernier segment sans successeur ni clôture : durée inconnue', segSeul[0].ms, null);
t('mais ses bornes de début restent connues', segSeul[0].debut, new Date('2026-06-01T09:00:00').getTime());

/* ==================== repartitionCriteres ==================== */
const segments = [
  { debut: 0, fin: 60 * 60000, meta: stable, cle: 'stable', ms: 60 * 60000 },
  { debut: 60 * 60000, fin: 90 * 60000, meta: crise, cle: 'crise', ms: 30 * 60000 },
  { debut: 90 * 60000, fin: 120 * 60000, meta: stable, cle: 'stable', ms: 30 * 60000 },
  { debut: 120 * 60000, fin: null, meta: crise, cle: 'crise', ms: null },
];
const repar = repartitionCriteres(segments);
t('un segment non borné est écarté du calcul', repar.nonBornes, 1);
t('la durée cumulée porte uniquement sur les segments bornés', repar.totalMs, 120 * 60000);
t('deux critères ressortent', repar.lignes.map((l) => l.cle).sort(), ['crise', 'stable']);
const parts = repar.lignes.reduce((a, l) => a + l.part, 0);
t('les parts des segments bornés totalisent 100 %', parts, 100);
const ligneStable = repar.lignes.find((l) => l.cle === 'stable');
t('stable cumule ses deux segments', ligneStable.ms, 90 * 60000);
t('stable compte deux relevés', ligneStable.n, 2);

/* Occurrences : le même ensemble de faits que les durées, lu autrement. Un
   critère peut peser peu de temps en revenant souvent — d'où une part propre,
   sur le nombre de segments bornés et non sur leur durée. Le segment non borné
   est écarté des deux lectures, sans quoi elles ne parleraient pas des mêmes
   relevés. */
t('le dénominateur des occurrences ne compte que les segments bornés', repar.totalN, 3);
const ligneCrise = repar.lignes.find((l) => l.cle === 'crise');
t('crise : une occurrence bornée sur trois', [ligneCrise.n, ligneCrise.partN], [1, 33]);
t('stable : deux occurrences sur trois', ligneStable.partN, 67);
t('les parts d occurrences ne suivent pas celles des durées',
  [ligneStable.part, ligneStable.partN], [75, 67]);

t('aucun segment : rien à répartir', repartitionCriteres([]).lignes, []);
t('aucun segment : aucun dénominateur d occurrences', repartitionCriteres([]).totalN, 0);
t('tous les segments non bornés : aucune part calculable', repartitionCriteres([
  { debut: 0, fin: null, meta: stable, cle: 'stable', ms: null },
]).lignes, []);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
