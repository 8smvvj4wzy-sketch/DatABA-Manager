let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

/* Fusion : nouvelles séances ajoutées, existantes mises à jour, aucun doublon */
function fusionner(actuel, backup, nomSource) {
  const personnes = actuel.personnes.slice();
  const parInitiales = new Map(personnes.map(p => [p.initials, p]));
  (backup.students || []).forEach(s => {
    if (!parInitiales.has(s.initials)) { const p = { id: s.id, initials: s.initials }; personnes.push(p); parInitiales.set(s.initials, p); }
  });
  const idVersInitiales = new Map((backup.students || []).map(s => [s.id, s.initials]));
  const seancesExistantes = new Set(actuel.seances.map(s => s.id));
  const nouvellesSeances = (backup.sessions || []).filter(s => !seancesExistantes.has(s.id));
  const seancesMaj = actuel.seances.filter(s => !nouvellesSeances.some(n => n.id === s.id));
  const seances = [...seancesMaj, ...nouvellesSeances].map(s => ({ ...s, source: s.source || nomSource }));
  const sources = actuel.sources.includes(nomSource) ? actuel.sources : [...actuel.sources, nomSource];
  return { personnes, seances, sources, _idVersInitiales: { ...(actuel._idVersInitiales||{}), [nomSource]: Object.fromEntries(idVersInitiales) },
    nbNouvellesSeances: nouvellesSeances.length };
}

const vide = { personnes: [], seances: [], sources: [] };

// Premier import
const backupA = { students: [{id:'sA1',initials:'L.M.'},{id:'sA2',initials:'T.B.'}],
  sessions: [{id:'sessA1',date:'2026-07-01'},{id:'sessA2',date:'2026-07-05'}] };
const r1 = fusionner(vide, backupA, 'tablette-atelier1');
t('personnes créées au premier import', r1.personnes.map(p=>p.initials), ['L.M.','T.B.']);
t('deux séances importées', r1.seances.length, 2);
t('nouvelles séances comptées', r1.nbNouvellesSeances, 2);
t('source enregistrée', r1.sources, ['tablette-atelier1']);

// Réimport du même fichier : aucun doublon
const r2 = fusionner(r1, backupA, 'tablette-atelier1');
t('réimport identique : aucun doublon', r2.seances.length, 2);
t('aucune nouvelle séance comptée', r2.nbNouvellesSeances, 0);
t('aucune personne dupliquée', r2.personnes.length, 2);

// Nouvel export de la même tablette, avec une séance en plus
const backupA2 = { students: backupA.students,
  sessions: [...backupA.sessions, {id:'sessA3',date:'2026-07-10'}] };
const r3 = fusionner(r2, backupA2, 'tablette-atelier1');
t('seule la nouvelle séance s ajoute', r3.seances.length, 3);
t('une seule nouvelle comptée', r3.nbNouvellesSeances, 1);

// Une DEUXIÈME tablette, avec une personne différente et une homonyme partielle
const backupB = { students: [{id:'sB1',initials:'J.D.'}],
  sessions: [{id:'sessB1',date:'2026-07-03'}] };
const r4 = fusionner(r3, backupB, 'tablette-atelier2');
t('deux sources désormais connues', r4.sources, ['tablette-atelier1','tablette-atelier2']);
t('trois personnes au total', r4.personnes.map(p=>p.initials), ['L.M.','T.B.','J.D.']);
t('les séances des deux tablettes cohabitent', r4.seances.length, 4);

// Le même identifiant interne réutilisé sur une AUTRE tablette n'écrase pas la table de la première
t('table de correspondance distincte par source',
  Object.keys(r4._idVersInitiales), ['tablette-atelier1','tablette-atelier2']);
t('la table de la première tablette reste intacte',
  r4._idVersInitiales['tablette-atelier1']['sA1'], 'L.M.');

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
t('en cours, sous le seuil', classer([{value:50},{value:60}], crit), 'en_cours');
t('acquis : 3 d affilée au seuil', classer([{value:85},{value:90},{value:82}], crit), 'acquis');
t('une rupture de série repart de zéro', classer([{value:90},{value:90},{value:60},{value:85}], crit), 'en_cours');
t('sans critère défini : en cours par défaut', classer([{value:90}], null), 'en_cours');

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
