/* Critère d'acquisition : seuil, unité (séances ou jours) et sens
   (au moins / au plus). Manager et DatABA doivent rendre le même verdict sur
   les mêmes données — la référence est `masteryDe` / `masteryStatus` de
   DatABA (src/App.jsx), portée ici sous les noms `critereDe`, `tientLeSeuil`,
   `pointsParJour` et `suiteAuSeuil`.

   Les fonctions ne sont pas recopiées : elles sont extraites de src/App.jsx et
   évaluées telles quelles. Une copie finirait par diverger du code livré et
   validerait alors une implémentation qui n'existe plus. */

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

/* Découpe une déclaration de premier niveau : de « function X( » ou
   « const X = » jusqu'à sa fermeture en colonne zéro. */
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

/* Une constante tenant sur une seule ligne n'a pas de fermeture propre en
   colonne zéro : extraire chercherait bien plus loin dans le fichier. */
function extraireLigne(nom) {
  const re = new RegExp(`^const ${nom} = (.+);$`, 'm');
  const m = source.match(re);
  if (!m) throw new Error(`Constante introuvable (ligne unique) dans src/App.jsx : ${nom}`);
  return m[1];
}

const NOMS = ['critereDe', 'tientLeSeuil', 'ecartAuSeuil', 'pointsParJour', 'serieCritere', 'suiteAuSeuil'];
const code = [
  `const TYPES_POURCENT = ${extraireLigne('TYPES_POURCENT')};`,
  `const TYPES_CRITERE = ${extraireLigne('TYPES_CRITERE')};`,
  `const CRITERE_DEFAUT = ${extraireLigne('CRITERE_DEFAUT')};`,
  `const CRITERE_DEFAUT_PROBE = ${extraireLigne('CRITERE_DEFAUT_PROBE')};`,
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, TYPES_POURCENT, TYPES_CRITERE, CRITERE_DEFAUT, CRITERE_DEFAUT_PROBE };`,
].join('\n');
// eslint-disable-next-line no-new-func
const {
  critereDe, tientLeSeuil, ecartAuSeuil, pointsParJour, serieCritere, suiteAuSeuil,
  TYPES_POURCENT, TYPES_CRITERE, CRITERE_DEFAUT_PROBE,
} = new Function(code)();

/* ==================== Lecture du critère ==================== */

const objTrials = (mastery) => ({ type: 'trials', config: mastery ? { mastery } : {} });

t('défaut : 80 % sur 3 séances, sens min',
  critereDe(objTrials(null)), { threshold: 80, needed: 3, unit: 'sessions', sens: 'min', pourcent: true, explicite: false });
t('les réglages personnalisés priment',
  critereDe(objTrials({ threshold: 90, sessions: 5 })),
  { threshold: 90, needed: 5, unit: 'sessions', sens: 'min', pourcent: true, explicite: true });
t('unit days est lu', critereDe(objTrials({ unit: 'days' })).unit, 'days');
t('unit inconnu retombe sur le défaut du type', critereDe(objTrials({ unit: 'lunes' })).unit, 'sessions');
t('sens max est lu', critereDe(objTrials({ sens: 'max' })).sens, 'max');
t('sens inconnu retombe sur min', critereDe(objTrials({ sens: 'travers' })).sens, 'min');

/* Le seuil zéro : légitime en sens max (zéro occurrence visée). L'ancien
   repli `m.threshold || 80` le remplaçait silencieusement par 80, ce qui
   déclarait acquis un objectif qui ne l'était pas. */
t('un seuil à zéro est conservé',
  critereDe({ type: 'occurrence', config: { mastery: { threshold: 0, sens: 'max' } } }).threshold, 0);
t('un nombre de séances à zéro est conservé',
  critereDe(objTrials({ sessions: 0 })).needed, 0);

/* Repli par TYPE : un Probe sans mastery explicite se valide à 100 % sur
   3 jours, pas à 80 % sur 3 séances. */
t('Probe sans réglage : 100 % sur 3 jours',
  critereDe({ type: 'probe', config: {} }),
  { threshold: 100, needed: 3, unit: 'days', sens: 'min', pourcent: true, explicite: false });
t('le repli Probe est bien celui de DatABA',
  [CRITERE_DEFAUT_PROBE.threshold, CRITERE_DEFAUT_PROBE.sessions, CRITERE_DEFAUT_PROBE.unit, CRITERE_DEFAUT_PROBE.sens],
  [100, 3, 'days', 'min']);
t('Probe sans réglage : seuil', critereDe({ type: 'probe', config: {} }).threshold, 100);
t('Probe sans réglage : unité', critereDe({ type: 'probe', config: {} }).unit, 'days');
t('Probe : un réglage explicite reste prioritaire',
  critereDe({ type: 'probe', config: { mastery: { threshold: 80, unit: 'sessions' } } }).unit, 'sessions');

t('occurrence admet un critère', critereDe({ type: 'occurrence', config: {} }) !== null, true);
t('les modes retirés n en admettent pas', critereDe({ type: 'timer', config: {} }), null);
t('latency non plus', critereDe({ type: 'latency', config: {} }), null);
t('occurrence n est pas un pourcentage', critereDe({ type: 'occurrence', config: {} }).pourcent, false);
t('interval en est un', critereDe({ type: 'interval', config: {} }).pourcent, true);
t('les types à pourcentage sont ceux de DatABA',
  TYPES_POURCENT, ['trials', 'interval', 'chaining', 'balance', 'probe']);
t('occurrence complète la liste des types à critère',
  TYPES_CRITERE.filter((x) => !TYPES_POURCENT.includes(x)), ['occurrence']);

/* ==================== Sens ==================== */

const critMin = critereDe(objTrials({ threshold: 80, sessions: 3 }));
const critMax = critereDe({ type: 'occurrence', config: { mastery: { threshold: 2, sessions: 3, sens: 'max' } } });

t('sens min : au seuil, le seuil est tenu', tientLeSeuil(80, critMin), true);
t('sens min : au-dessus, tenu', tientLeSeuil(95, critMin), true);
t('sens min : en dessous, non tenu', tientLeSeuil(79, critMin), false);
t('sens max : au seuil, tenu', tientLeSeuil(2, critMax), true);
t('sens max : en dessous, tenu', tientLeSeuil(0, critMax), true);
t('sens max : au-dessus, non tenu', tientLeSeuil(3, critMax), false);
t('sans valeur, rien n est tenu', tientLeSeuil(null, critMin), false);
t('sans critère, rien n est tenu', tientLeSeuil(100, null), false);

/* L'écart est positif quand le seuil n'est pas tenu, dans les deux sens.
   C'est la valeur affichée à l'écran : le calculer dans le mauvais sens
   annonçait « il manque 18 points » à un objectif qui en avait 18 de trop. */
t('écart en sens min : il manque des points', ecartAuSeuil(62, critMin), 18);
t('écart en sens min : négatif quand le seuil est dépassé', ecartAuSeuil(95, critMin), -15);
t('écart en sens max : il y en a de trop', ecartAuSeuil(5, critMax), 3);
t('écart en sens max : négatif quand le seuil est tenu', ecartAuSeuil(1, critMax), -1);

/* Le cas qui motive tout : un comportement problème coté à l'occurrence,
   trois séances de suite sous le seuil. Avec la seule comparaison `>=`, il
   était classé non acquis alors que l'objectif était atteint. */
const pbs = [{ date: '2026-05-01', value: 1 }, { date: '2026-05-02', value: 2 }, { date: '2026-05-03', value: 0 }];
t('comportement problème : trois séances sous le seuil valent acquis',
  suiteAuSeuil(pbs, critMax) >= critMax.needed, true);
t('la même série lue en sens min ne vaut rien',
  suiteAuSeuil(pbs, critMin), 0);

/* ==================== Unité : séances ou jours ==================== */

const troisLeMemeJour = [
  { date: '2026-05-04T08:00:00.000Z', value: 100 },
  { date: '2026-05-04T11:00:00.000Z', value: 100 },
  { date: '2026-05-04T15:00:00.000Z', value: 100 },
];

t('trois probes le même jour ne font qu un point', pointsParJour(troisLeMemeJour).length, 1);
t('la valeur du jour est la moyenne des cotations',
  pointsParJour([
    { date: '2026-05-04T08:00:00.000Z', value: 100 },
    { date: '2026-05-04T15:00:00.000Z', value: 0 },
  ])[0].value, 50);
t('un point sans date est écarté', pointsParJour([{ value: 100 }]).length, 0);
t('les journées ressortent dans l ordre',
  pointsParJour([
    { date: '2026-05-06T09:00:00.000Z', value: 40 },
    { date: '2026-05-04T09:00:00.000Z', value: 10 },
    { date: '2026-05-05T09:00:00.000Z', value: 20 },
  ]).map((p) => p.value), [10, 20, 40]);

const critProbe = critereDe({ type: 'probe', config: {} });
t('critère en jours : trois probes du même jour ne valident pas',
  suiteAuSeuil(troisLeMemeJour, critProbe), 1);
t('critère en séances : les mêmes trois probes valideraient',
  suiteAuSeuil(troisLeMemeJour, critereDe({ type: 'probe', config: { mastery: { unit: 'sessions' } } })), 3);
t('critère en jours : trois journées consécutives valident',
  suiteAuSeuil([
    { date: '2026-05-04T09:00:00.000Z', value: 100 },
    { date: '2026-05-05T09:00:00.000Z', value: 100 },
    { date: '2026-05-06T09:00:00.000Z', value: 100 },
  ], critProbe), 3);
/* Un second probe raté le même jour fait basculer la journée entière : la
   moyenne du jour passe sous le seuil, et comme c'est la dernière journée de
   la série, la suite repart de zéro. Deux journées pleines déjà acquises ne
   la sauvent pas — c'est le comportement de DatABA, la suite se compte
   toujours depuis la fin. */
t('un raté dans la dernière journée casse la suite entière',
  suiteAuSeuil([
    { date: '2026-05-04T09:00:00.000Z', value: 100 },
    { date: '2026-05-05T09:00:00.000Z', value: 100 },
    { date: '2026-05-06T09:00:00.000Z', value: 100 },
    { date: '2026-05-06T15:00:00.000Z', value: 0 },
  ], critProbe), 0);
/* Le même raté une journée plus tôt ne coûte que cette journée-là. */
t('un raté dans une journée intermédiaire ne coûte que celle-là',
  suiteAuSeuil([
    { date: '2026-05-04T09:00:00.000Z', value: 100 },
    { date: '2026-05-05T09:00:00.000Z', value: 100 },
    { date: '2026-05-05T15:00:00.000Z', value: 0 },
    { date: '2026-05-06T09:00:00.000Z', value: 100 },
  ], critProbe), 1);

t('serieCritere ne regroupe rien en unité séances',
  serieCritere(troisLeMemeJour, critMin).length, 3);
t('serieCritere regroupe en unité jours',
  serieCritere(troisLeMemeJour, critProbe).length, 1);

/* La suite se compte depuis la fin : un échec ancien ne l'empêche pas. */
t('la suite se compte depuis la fin',
  suiteAuSeuil([
    { date: '2026-05-01', value: 10 },
    { date: '2026-05-02', value: 90 },
    { date: '2026-05-03', value: 85 },
  ], critMin), 2);
t('un échec en dernier remet la suite à zéro',
  suiteAuSeuil([
    { date: '2026-05-01', value: 90 },
    { date: '2026-05-02', value: 10 },
  ], critMin), 0);
t('série vide : aucune suite', suiteAuSeuil([], critMin), 0);
t('sans critère : aucune suite', suiteAuSeuil(pbs, null), 0);

/* ==================== Classification d'un objectif ====================
   `analyserObjectif` est le point où le critère rencontre les cotations.
   Extrait avec ses dépendances plutôt que reconstitué : c'est cette fonction
   qui rend le verdict affiché dans les bilans. */

const NOMS2 = [
  'objectiveScoreValue', 'parseHM', 'partNiveauCible', 'valeurCotation',
  'libelleSeuil', 'libelleCritere', 'etatDeSerie', 'analyserObjectif', 'libelleCreneauProbe',
];
const code2 = [
  `const TYPES_POURCENT = ${extraireLigne('TYPES_POURCENT')};`,
  `const TYPES_CRITERE = ${extraireLigne('TYPES_CRITERE')};`,
  `const CRITERE_DEFAUT = ${extraireLigne('CRITERE_DEFAUT')};`,
  `const CRITERE_DEFAUT_PROBE = ${extraireLigne('CRITERE_DEFAUT_PROBE')};`,
  `const PLATEAU_MIN_POINTS = ${extraireLigne('PLATEAU_MIN_POINTS')};`,
  `const PLATEAU_ECART_MAX = ${extraireLigne('PLATEAU_ECART_MAX')};`,
  `const DORMANT_JOURS = ${extraireLigne('DORMANT_JOURS')};`,
  `const PROBE_CRENEAUX = ${extraireLigne('PROBE_CRENEAUX')};`,
  extraire('UNITES_BRUTES'),
  NOMS.map(extraire).join('\n'),
  NOMS2.map(extraire).join('\n'),
  `return { ${NOMS2.join(', ')}, DORMANT_JOURS };`,
].join('\n');
// eslint-disable-next-line no-new-func
const {
  valeurCotation, libelleSeuil, libelleCritere, analyserObjectif, libelleCreneauProbe, DORMANT_JOURS,
} = new Function(code2)();

const jour = (n) => new Date(Date.now() - n * 86400000).toISOString();
const GUIDANCES = [{ code: 'I', independent: true }, { code: 'P', independent: false }];

/* Construit une suite de séances cotant un seul objectif. `cotations` est un
   tableau de { j, entry } : j jours avant aujourd'hui. */
function analyser(obj, cotations) {
  const seances = cotations.map((c, i) => ({
    id: `s${i}`,
    date: typeof c.j === 'string' ? c.j : jour(c.j),
    source: 'T1',
    objectiveSnapshot: { o1: obj },
    selectedObjectives: { p1: ['o1'] },
    data: { p1: { o1: c.entry } },
  }));
  return analyserObjectif(seances, { T1: 'p1' }, obj);
}

const essais = (n, codes) => ({ j: n, entry: { trials: codes } });
const objTrialsStd = {
  name: 'Désigner les couleurs', type: 'trials',
  config: { guidanceSet: GUIDANCES, mastery: { threshold: 80, sessions: 3 } },
};

t('trois séances au seuil : acquis',
  analyser(objTrialsStd, [essais(5, ['I', 'I']), essais(4, ['I', 'I']), essais(3, ['I', 'I'])]).etat, 'acquis');
t('deux séances sur trois : bientôt',
  analyser(objTrialsStd, [essais(5, ['P', 'P']), essais(4, ['I', 'I']), essais(3, ['I', 'I'])]).etat, 'bientot');
t('aucune cotation : non acquis', analyser(objTrialsStd, []).etat, 'non_acquis');
t('dernière cotation trop ancienne : dormant',
  analyser(objTrialsStd, [essais(DORMANT_JOURS + 5, ['I', 'I'])]).etat, 'dormant');

/* Le cas du dossier : un comportement problème compté à l'occurrence, avec un
   seuil à ne pas dépasser. Avant correction, Manager le classait « suivi en
   mesure » et n'appliquait jamais le critère — l'objectif atteint n'était
   jamais reconnu. */
const objOccMax = {
  name: 'Cris pendant l atelier', type: 'occurrence',
  config: { mastery: { threshold: 2, sessions: 3, sens: 'max' } },
};
const compte = (n, count) => ({ j: n, entry: { count } });

t('comportement problème sous le seuil trois fois : acquis',
  analyser(objOccMax, [compte(5, 1), compte(4, 2), compte(3, 0)]).etat, 'acquis');
t('comportement problème au-dessus du seuil : en cours',
  analyser(objOccMax, [compte(5, 8), compte(4, 7), compte(3, 9)]).etat, 'en_cours');
t('une rechute en dernier suffit à défaire l acquisition',
  analyser(objOccMax, [compte(5, 1), compte(4, 1), compte(3, 9)]).etat, 'en_cours');
t('le seuil du comportement problème reste lisible',
  libelleSeuil(analyser(objOccMax, [compte(3, 1)])), 'au plus 2 occurrences');

/* Un comptage sans critère réglé sur la tablette reste un suivi en mesure :
   on n'invente pas un verdict à partir du repli « 80 sur 3 séances ». */
const objOccSansCritere = { name: 'Demandes spontanées', type: 'occurrence', config: {} };
t('comptage sans critère : suivi en mesure',
  analyser(objOccSansCritere, [compte(5, 3), compte(4, 4), compte(3, 5)]).etat, 'mesure');
t('comptage sans critère : aucun seuil affiché',
  libelleSeuil(analyser(objOccSansCritere, [compte(3, 5)])), null);

/* Unité en jours : trois probes réussis le même jour ne valident pas. */
const objProbe = { name: 'Reconnaît son prénom', type: 'probe', config: {} };
const probe = (dateIso, v) => ({ j: dateIso, entry: { value: v } });
const jourFixe = (n, h) => {
  const d = new Date(Date.now() - n * 86400000);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

t('trois probes réussis le même jour : pas encore acquis',
  analyser(objProbe, [probe(jourFixe(3, 9), 1), probe(jourFixe(3, 12), 1), probe(jourFixe(3, 16), 1)]).etat, 'en_cours');
t('trois journées consécutives : acquis',
  analyser(objProbe, [probe(jourFixe(5, 9), 1), probe(jourFixe(4, 9), 1), probe(jourFixe(3, 9), 1)]).etat, 'acquis');
t('le critère d un Probe se dit en jours',
  libelleCritere(analyser(objProbe, [probe(jourFixe(3, 9), 1)])), 'seuil 100 % sur 3 jours');

/* Le mode Intervalle produit bien un pourcentage, mais objectiveScoreValue ne
   sait pas le calculer : ses cotations n'entraient ni dans les points ni dans
   les mesures, et l'objectif restait « non acquis » quoi qu'il arrive. */
const objInterval = {
  name: 'Temps passé stable', type: 'interval',
  config: { intervalMinutes: 5, levels: [{ id: 'L1' }, { id: 'L2' }], targetLevelId: 'L1', mastery: { threshold: 80, sessions: 2 } },
};
const inter = (n, marks) => ({ j: n, entry: { marks } });
const analyseInterval = analyser(objInterval, [
  inter(4, { 1: 'L1', 2: 'L1', 3: 'L1', 4: 'L1' }),
  inter(3, { 1: 'L1', 2: 'L1', 3: 'L1', 4: 'L2' }),
]);
t('les cotations Intervalle entrent dans les points', analyseInterval.points.map((p) => p.value), [100, 75]);
t('une cotation Intervalle sous le seuil casse la suite', analyseInterval.etat, 'en_cours');
t('deux cotations Intervalle au seuil : acquis',
  analyser(objInterval, [
    inter(4, { 1: 'L1', 2: 'L1', 3: 'L1', 4: 'L1' }),
    inter(3, { 1: 'L1', 2: 'L1', 3: 'L1', 4: 'L1' }),
  ]).etat, 'acquis');

/* Plateau : réservé aux critères en pourcentage, et l'écart se calcule dans
   le sens du critère. */
const plateauPoints = [70, 65, 72, 68, 70, 66].map((v, i) => ({
  j: 10 - i, entry: { trials: Array(100).fill(0).map((_, k) => (k < v ? 'I' : 'P')) },
}));
t('six cotations juste sous le seuil : plateau', analyser(objTrialsStd, plateauPoints).etat, 'plateau');
t('un comptage n a pas de plateau',
  analyser(objOccMax, [compte(10, 5), compte(9, 6), compte(8, 5), compte(7, 6), compte(6, 5), compte(5, 6)]).etat, 'en_cours');

/* Un objectif coté hier en mesure brute n'est pas dormant parce que sa
   dernière valeur en pourcentage remonte à un mois. */
const objMixte = { name: 'Mixte', type: 'occurrence', config: {} };
t('la dormance se lit sur la cotation la plus récente, toutes séries confondues',
  analyser(objMixte, [compte(DORMANT_JOURS + 10, 3), compte(1, 4)]).etat, 'mesure');

/* Un mode retiré ne reçoit pas de critère : ses cotations restent des mesures. */
t('un chronomètre reste un suivi en mesure',
  analyser({ name: 'Durée', type: 'timer', config: {} }, [{ j: 3, entry: { elapsedMs: 300000 } }]).etat, 'mesure');
t('valeurCotation rend bien des minutes',
  valeurCotation({ type: 'timer' }, { elapsedMs: 300000 }).unite, 'min');

/* Créneau d'un Probe à deux prises par jour : porté jusqu'au point plutôt
   qu'ignoré, sinon un probe manqué sur le créneau prévu se lit comme un trou
   dans les données plutôt que comme l'information de suivi que c'est. */
t('matin', libelleCreneauProbe('matin'), 'Matin');
t('après-midi', libelleCreneauProbe('aprem'), 'Après-midi');
t('créneau inconnu', libelleCreneauProbe('soir'), null);
t('absence de créneau (une seule prise par jour)', libelleCreneauProbe(undefined), null);

const analyseCreneau = analyser(objProbe, [probe(jourFixe(3, 9), 1)]);
// probe() ne pose pas de creneau : on construit l'entrée à la main ici.
function analyserAvecCreneau(obj, cotations) {
  const seances = cotations.map((c, i) => ({
    id: `s${i}`, date: c.j, source: 'T1',
    objectiveSnapshot: { o1: obj }, selectedObjectives: { p1: ['o1'] },
    data: { p1: { o1: { value: c.v, creneau: c.creneau } } },
  }));
  return analyserObjectif(seances, { T1: 'p1' }, obj);
}
t('le créneau du relevé se retrouve sur le point',
  analyserAvecCreneau(objProbe, [{ j: jourFixe(3, 9), v: 1, creneau: 'matin' }]).points[0].creneau, 'matin');
t('sans créneau, le point n en porte pas', analyseCreneau.points[0].creneau, null);

console.log(`\n${ok} réussis, ${ko} en échec`);
process.exit(ko ? 1 : 0);
