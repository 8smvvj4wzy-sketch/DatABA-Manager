/* Détail des cotations d'une personne (detailCotationsPersonne, src/App.jsx) :
   une ligne par essai/étape/intervalle pour trials/chaining/balance/interval,
   une ligne par cotation pour probe/occurrence/timer/latency — ces quatre
   derniers n'ont rien de plus fin à décomposer, la donnée relevée y est déjà
   un scalaire (voir le commentaire de tête de la fonction dans src/App.jsx). */

let ok = 0, ko = 0;
const t = (n, a, e) => {
  const p = JSON.stringify(a) === JSON.stringify(e);
  console.log(`${p ? 'OK  ' : 'ECHEC'} ${n}` + (p ? '' : ` → ${JSON.stringify(a)} au lieu de ${JSON.stringify(e)}`));
  p ? ok++ : ko++;
};

function detailCotationsPersonne(donnees, personne, periode) {
  const dansPeriode = (date) => !periode || (
    (!periode.debut || new Date(date).getTime() >= new Date(periode.debut).getTime())
    && (!periode.fin || new Date(date).getTime() <= new Date(periode.fin).getTime())
  );
  const lignes = [];
  donnees.seances.forEach((sess) => {
    if (!dansPeriode(sess.date)) return;
    const table = (donnees._idVersInitiales || {})[sess.source] || {};
    const sid = Object.keys(table).find((k) => table[k] === personne);
    if (!sid || !(sess.studentIds || []).includes(sid)) return;

    ((sess.selectedObjectives || {})[sid] || []).forEach((oid) => {
      const obj = (sess.objectiveSnapshot || {})[oid];
      const entry = (sess.data || {})[sid] && sess.data[sid][oid];
      if (!obj || !entry) return;
      const base = { date: sess.date, objectif: obj.name, type: obj.type };

      if (obj.type === 'trials') {
        (entry.trials || []).forEach((el, i) => {
          const code = el && typeof el === 'object' ? el.code : el;
          if (!code) return;
          lignes.push({ ...base, unite: 'essai', repere: `essai ${i + 1}`, valeur: code });
        });
      } else if (obj.type === 'chaining') {
        const steps = (obj.config && obj.config.steps) || [];
        steps.forEach((st, i) => {
          const code = (entry.steps || {})[st.id];
          if (!code) return;
          lignes.push({ ...base, unite: 'étape', repere: st.name || `étape ${i + 1}`, valeur: code });
        });
      } else if (obj.type === 'balance') {
        const steps = (obj.config && obj.config.steps) || [];
        const essais = Array.isArray(entry.trials) ? entry.trials : [{ steps: entry.steps || {} }];
        essais.forEach((es, ie) => {
          steps.forEach((st, i) => {
            const e = (es.steps || {})[st.id];
            if (!e || !e.outcome) return;
            lignes.push({ ...base, unite: 'étape', repere: `essai ${ie + 1} · ${st.name || `étape ${i + 1}`}`, valeur: e.outcome });
          });
        });
      } else if (obj.type === 'interval') {
        Object.entries(entry.marks || {}).forEach(([cle, lid]) => {
          if (!lid) return;
          lignes.push({ ...base, unite: 'intervalle', repere: cle, valeur: lid });
        });
        (entry.segments || []).forEach((s) => {
          if (!s.levelId) return;
          lignes.push({ ...base, unite: 'segment saisi', repere: `${s.start || '?'}–${s.end || '?'}`, valeur: s.levelId });
        });
      } else if (obj.type === 'probe') {
        const v = entry.guidance != null ? entry.guidance : entry.value;
        if (v == null) return;
        lignes.push({ ...base, unite: 'probe', repere: 'probe', valeur: v });
      } else if (obj.type === 'occurrence') {
        if (typeof entry.count !== 'number') return;
        lignes.push({ ...base, unite: 'occurrences', repere: 'cotation', valeur: entry.count });
      }
    });
  });
  return lignes;
}

const donneesTrials = {
  _idVersInitiales: { tabA: { a1: 'L.M.' } },
  seances: [{
    id: 's1', date: '2026-07-10T09:00:00', source: 'tabA', studentIds: ['a1'],
    selectedObjectives: { a1: ['o1'] },
    objectiveSnapshot: { o1: { name: 'Demandes', type: 'trials' } },
    data: { a1: { o1: { trials: ['I', { code: 'G' }, null, 'I'] } } },
  }],
};
const detTrials = detailCotationsPersonne(donneesTrials, 'L.M.', null);
t('trials : une ligne par essai coté, les essais vides sautés', detTrials.length, 3);
t('trials : le code d\'un essai en objet est extrait', detTrials[1].valeur, 'G');
t('trials : le repère numérote les essais dans l\'ordre', detTrials.map((l) => l.repere), ['essai 1', 'essai 2', 'essai 4']);

const donneesChaining = {
  _idVersInitiales: { tabA: { a1: 'L.M.' } },
  seances: [{
    id: 's1', date: '2026-07-10', source: 'tabA', studentIds: ['a1'],
    selectedObjectives: { a1: ['o1'] },
    objectiveSnapshot: { o1: { name: 'Chaîne', type: 'chaining', config: { steps: [{ id: 'p1', name: 'Ouvrir' }, { id: 'p2', name: 'Verser' }] } } },
    data: { a1: { o1: { steps: { p1: 'I', p2: null } } } },
  }],
};
const detChaining = detailCotationsPersonne(donneesChaining, 'L.M.', null);
t('chaining : une ligne par étape cotée, celle non cotée sautée', detChaining.length, 1);
t('chaining : le repère reprend le nom de l\'étape', detChaining[0].repere, 'Ouvrir');

const donneesInterval = {
  _idVersInitiales: { tabA: { a1: 'L.M.' } },
  seances: [{
    id: 's1', date: '2026-07-10', source: 'tabA', studentIds: ['a1'],
    selectedObjectives: { a1: ['o1'] },
    objectiveSnapshot: { o1: { name: 'Autonomie', type: 'interval' } },
    data: { a1: { o1: { marks: { 1: 'L1', 2: null, 3: 'L2' }, segments: [{ start: '10:00', end: '10:15', levelId: 'L1' }] } } },
  }],
};
const detInterval = detailCotationsPersonne(donneesInterval, 'L.M.', null);
t('interval : les relevés directs et les segments saisis se combinent', detInterval.length, 3);
t('interval : un intervalle non marqué ne produit pas de ligne', detInterval.some((l) => l.repere === '2'), false);
t('interval : le segment saisi porte ses horaires en repère', detInterval.find((l) => l.unite === 'segment saisi').repere, '10:00–10:15');

/* occurrence : pas de décomposition, une ligne par cotation — vérifié
   explicitement pour ne pas laisser croire à un oubli. */
const donneesOccurrence = {
  _idVersInitiales: { tabA: { a1: 'L.M.' } },
  seances: [{
    id: 's1', date: '2026-07-10', source: 'tabA', studentIds: ['a1'],
    selectedObjectives: { a1: ['o1'] },
    objectiveSnapshot: { o1: { name: 'Cris', type: 'occurrence' } },
    data: { a1: { o1: { count: 4 } } },
  }],
};
const detOcc = detailCotationsPersonne(donneesOccurrence, 'L.M.', null);
t('occurrence : une seule ligne, la valeur brute', detOcc, [{ date: '2026-07-10', objectif: 'Cris', type: 'occurrence', unite: 'occurrences', repere: 'cotation', valeur: 4 }]);

/* La période filtre sur la date de séance */
const detHorsPeriode = detailCotationsPersonne(donneesTrials, 'L.M.', { debut: '2026-08-01', fin: '2026-08-31' });
t('une séance hors période ne produit aucune ligne', detHorsPeriode, []);

/* Une autre personne sur la même séance ne doit rien renvoyer */
t('personne absente de la séance : aucune ligne', detailCotationsPersonne(donneesTrials, 'T.B.', null), []);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
