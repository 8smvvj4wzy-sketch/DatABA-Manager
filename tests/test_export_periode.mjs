/* Export de détail borné à une période (construirePaquetExport, src/App.jsx) :
   même exigence d'exhaustivité que les purges — une suppression par date qui
   oublierait un tableau laisse des données d'usager derrière une opération
   qu'on croit complète (CLAUDE.md), et un export qui en oublierait un en
   laisserait sortir qu'on croit exclues. tests/test_purge.mjs couvre le
   même risque côté suppression ; celui-ci le couvre côté export, sur les
   quatre tableaux datés : séances, crises, suivi ET stabilite. */

let ok = 0, ko = 0;
const t = (n, a, e) => {
  const p = JSON.stringify(a) === JSON.stringify(e);
  console.log(`${p ? 'OK  ' : 'ECHEC'} ${n}` + (p ? '' : ` → ${JSON.stringify(a)} au lieu de ${JSON.stringify(e)}`));
  p ? ok++ : ko++;
};

/* Même filtre que construirePaquetExport : personnes retenues ET période,
   appliqué identiquement aux quatre tableaux. */
function dansPeriodeSimple(date, debut, fin) {
  const ms = new Date(date).getTime();
  return (!debut || ms >= new Date(debut).getTime()) && (!fin || ms <= new Date(fin).getTime());
}
function construirePaquetExport(donnees, initialesRetenues, periode) {
  const garder = (initialesRetenues || []).length ? new Set(initialesRetenues) : null;
  const ini = (source, sid) => ((donnees._idVersInitiales || {})[source] || {})[sid];
  const dansLaPeriode = (date) => !periode || dansPeriodeSimple(date, periode.debut, periode.fin);
  const personnes = donnees.personnes.filter((p) => !garder || garder.has(p.initials));
  const seances = donnees.seances.filter((s) => (!garder || (s.studentIds || []).some((sid) => garder.has(ini(s.source, sid)))) && dansLaPeriode(s.date));
  const crises = donnees.crises.filter((c) => (!garder || garder.has(ini(c.source, c.studentId))) && dansLaPeriode(c.date));
  const stabilite = (donnees.stabilite || []).filter((r) => (!garder || garder.has(ini(r.source, r.studentId))) && dansLaPeriode(r.timestamp));
  const suivi = (donnees.suivi || []).filter((r) => (!garder || garder.has(ini(r.source, r.studentId))) && dansLaPeriode(r.timestamp));
  return { personnes, seances, crises, stabilite, suivi };
}

const base = {
  personnes: [{ initials: 'L.M.' }, { initials: 'T.B.' }],
  _idVersInitiales: { tabA: { a1: 'L.M.', a2: 'T.B.' } },
  seances: [
    { id: 's1', date: '2026-05-10', source: 'tabA', studentIds: ['a1'] },
    { id: 's2', date: '2026-07-10', source: 'tabA', studentIds: ['a1'] },
    { id: 's3', date: '2026-07-20', source: 'tabA', studentIds: ['a2'] },
  ],
  crises: [
    { id: 'c1', date: '2026-05-11', source: 'tabA', studentId: 'a1' },
    { id: 'c2', date: '2026-07-11', source: 'tabA', studentId: 'a1' },
  ],
  suivi: [
    { id: 'v1', timestamp: '2026-05-12', source: 'tabA', studentId: 'a1' },
    { id: 'v2', timestamp: '2026-07-12', source: 'tabA', studentId: 'a1' },
  ],
  stabilite: [
    { id: 'w1', timestamp: '2026-05-13', source: 'tabA', studentId: 'a1' },
    { id: 'w2', timestamp: '2026-07-13', source: 'tabA', studentId: 'a1' },
  ],
};

/* Sans période : comportement d'avant, tout l'historique de la personne. */
const sansPeriode = construirePaquetExport(base, ['L.M.'], null);
t('sans période : les deux séances de L.M.', sansPeriode.seances.map((s) => s.id), ['s1', 's2']);
t('sans période : les deux crises', sansPeriode.crises.map((c) => c.id), ['c1', 'c2']);
t('sans période : les deux relevés de suivi', sansPeriode.suivi.map((v) => v.id), ['v1', 'v2']);
t('sans période : les deux relevés de stabilite', sansPeriode.stabilite.map((w) => w.id), ['w1', 'w2']);

/* Avec une période resserrée sur juillet : POINT CLÉ, les quatre tableaux
   doivent être filtrés — un seul oublié laisserait fuiter une donnée de mai
   qu'on croit exclue de l'export. */
const periode = { debut: '2026-07-01T00:00:00', fin: '2026-07-31T23:59:59' };
const avecPeriode = construirePaquetExport(base, ['L.M.'], periode);
t('POINT CLÉ : séances filtrées par période', avecPeriode.seances.map((s) => s.id), ['s2']);
t('POINT CLÉ : crises filtrées par période', avecPeriode.crises.map((c) => c.id), ['c2']);
t('POINT CLÉ : suivi filtré par période', avecPeriode.suivi.map((v) => v.id), ['v2']);
t('POINT CLÉ : stabilite filtrée par période', avecPeriode.stabilite.map((w) => w.id), ['w2']);

/* Le filtre par personne reste actif en même temps que celui par période :
   la séance de T.B. en juillet ne doit pas apparaître dans un export borné
   à L.M., période ou pas. */
t('le filtre par personne reste actif avec une période', avecPeriode.seances.some((s) => s.id === 's3'), false);

/* Personne non filtrée (tout le monde), période resserrée : les deux
   tableaux doivent se combiner, pas s'exclure l'un l'autre. */
const toutLeMonde = construirePaquetExport(base, [], periode);
t('sans filtre de personne, la période seule s\'applique', toutLeMonde.seances.map((s) => s.id), ['s2', 's3']);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
