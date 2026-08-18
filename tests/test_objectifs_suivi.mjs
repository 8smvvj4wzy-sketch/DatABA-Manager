/* Suivi continu et compteurs d'occurrence promus en objectif.

   DatABA ne sait pas dire qu'un axe de suivi ou un compteur cote un objectif
   réel (l'estompage de l'éducateur, les demandes spontanées) : le choix se
   fait dans Manager, par `donnees.objectifsSuivi`, et `lignesSuiviContinu`
   fabrique alors une ligne de la même forme que celles issues des séances.

   Trois règles à ne pas perdre — une valeur par JOURNÉE et non par relevé, une
   part de temps rejoint `points` (pourcentage) quand les autres unités
   rejoignent `mesures`, et l'identité (`objectif`, un nom) ne doit jamais
   entrer en collision avec un objectif déjà coté en séance chez la même
   personne. `etatDeSerie`, extraite de la cascade d'`analyserObjectif`, doit
   rendre exactement les mêmes états qu'avant l'extraction — c'est
   `tests/test_acquisition.mjs`, laissé inchangé, qui verrouille ce point.

   Fonctions extraites de src/App.jsx, pas recopiées. */

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
  'etatDeSerie', 'dateAcquisition', 'suiteAuSeuil', 'serieCritere', 'tientLeSeuil', 'ecartAuSeuil',
  'pointsParJour',
  'jourLocal', 'segmentsJournee', 'segmentsSuivi',
  'axeDe', 'metaCritereSuivi', 'axeEtCritereDuReleve', 'suiviDePersonne', 'compteursDePersonne',
  'valeurJourSuivi', 'lignesSuiviContinu',
  'bornesDe', 'dansPeriode', 'filtrerLignePeriode',
  'construireFaits',
];
const code = [
  `const ACQUIS = '#0F8B6C'; const EN_COURS = '#D69A2D'; const NON_ACQUIS = '#A8402F'; const INK_SOFT = '#6B7280'; const CAT_INDIGO = '#3B5BDB';`,
  `const DORMANT_JOURS = ${extraireLigne('DORMANT_JOURS')};`,
  `const PLATEAU_MIN_POINTS = ${extraireLigne('PLATEAU_MIN_POINTS')};`,
  `const PLATEAU_ECART_MAX = ${extraireLigne('PLATEAU_ECART_MAX')};`,
  `const CRITERE_INCONNU_SUIVI = ${extraireLigne('CRITERE_INCONNU_SUIVI')};`,
  `const cleSerieSuivi = ${extraireLigne('cleSerieSuivi')};`,
  `const cleObjectifSuivi = ${extraireLigne('cleObjectifSuivi')};`,
  `const estReleveCompteur = ${extraireLigne('estReleveCompteur')};`,
  `const nomCompteurDe = ${extraireLigne('nomCompteurDe')};`,
  `const nomAtelier = ${extraireLigne('nomAtelier')};`,
  /* `construireFaits` résout désormais la classe, la tablette et la tranche
     horaire de chaque fait : ses deux nouveaux auxiliaires suivent. */
  extraire('nomClasseDe'),
  extraire('heureDe'),
  extraire('libelleTrancheHoraire'),
  `const TRANCHE_HORAIRE_PAS = ${extraireLigne('TRANCHE_HORAIRE_PAS')};`,
  extraire('CRITERES_STABILITE_V3'),
  extraire('UNITES_OBJECTIF_SUIVI'),
  extraire('TYPES_COTATION'),
  extraire('ETAT_RAPPORT'),
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, cleObjectifSuivi };`,
].join('\n');
// eslint-disable-next-line no-new-func
const {
  etatDeSerie, lignesSuiviContinu, cleObjectifSuivi, filtrerLignePeriode, construireFaits,
} = new Function(code)();

/* ==================== etatDeSerie ==================== */

const jourRecent = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

t('sans donnée : non acquis', etatDeSerie([], [], null), { etat: 'non_acquis', streak: 0 });
t('mesure brute sans critère : Suivi en mesure',
  etatDeSerie([], [{ date: jourRecent(1), value: 3 }], null), { etat: 'mesure', streak: 0 });
const critPourcent = { threshold: 80, needed: 3, unit: 'sessions', sens: 'min', pourcent: true, explicite: true };
t('trois points au-dessus du seuil : acquis',
  etatDeSerie([{ date: jourRecent(3), value: 85 }, { date: jourRecent(2), value: 90 }, { date: jourRecent(1), value: 82 }], [], critPourcent),
  { etat: 'acquis', streak: 3 });
const critMax = { threshold: 2, needed: 2, unit: 'sessions', sens: 'max', pourcent: false, explicite: true };
t('sens max : une valeur basse tient le seuil',
  etatDeSerie([], [{ date: jourRecent(2), value: 1 }, { date: jourRecent(1), value: 0 }], critMax),
  { etat: 'acquis', streak: 2 });
t('sens max : une valeur haute ne le tient pas',
  etatDeSerie([], [{ date: jourRecent(1), value: 5 }], critMax),
  { etat: 'en_cours', streak: 0 });

/* ==================== lignesSuiviContinu ==================== */

const calme = { k: 'calme', l: 'Calme', color: '#0F8B6C' };
const agite = { k: 'agite', l: 'Agité', color: '#A8402F' };
const axesSuivi = [{ id: 'ax', nom: 'Humeur', criteres: [calme, agite] }];

/* Deux journées récentes plutôt que des dates fixes : l'état « mesure » exige
   une cotation récente (moins de DORMANT_JOURS), et une date d'un exercice
   précédent basculerait ces lignes en « dormant » sans que ce soit le sujet
   du test. */
const jourA = jourRecent(2);
const jourB = jourRecent(1);

const donneesBase = {
  personnes: [{ id: 'a1', initials: 'L.M.' }],
  _idVersInitiales: { tabA: { a1: 'L.M.' } },
  _axesSuivi: { tabA: axesSuivi },
  _compteurs: { tabA: { c1: 'Demandes' } },
  suivi: [
    { id: 'r1', studentId: 'a1', timestamp: `${jourA}T09:00:00`, suiviId: 'ax', critere: 'calme', source: 'tabA' },
    { id: 'r2', studentId: 'a1', timestamp: `${jourA}T10:00:00`, suiviId: 'ax', critere: 'agite', source: 'tabA' },
    { id: 'r3', studentId: 'a1', timestamp: `${jourA}T11:00:00`, suiviId: 'ax', critere: 'calme', source: 'tabA', fin: true },
    { id: 'k1', studentId: 'a1', timestamp: `${jourA}T09:10:00`, compteurId: 'c1', kind: 'compteur', source: 'tabA' },
    { id: 'k2', studentId: 'a1', timestamp: `${jourA}T09:20:00`, compteurId: 'c1', kind: 'compteur', source: 'tabA' },
    { id: 'k3', studentId: 'a1', timestamp: `${jourB}T09:00:00`, compteurId: 'c1', kind: 'compteur', source: 'tabA' },
  ],
  stabilite: [],
  objectifsSuivi: {},
};

t('aucun réglage actif : aucune ligne', lignesSuiviContinu(donneesBase, []), []);

const cleCalme = cleObjectifSuivi('L.M.', 'critere:Humeur||calme');
const cleCompteur = cleObjectifSuivi('L.M.', 'compteur:c1');

/* --- Une valeur par journée, jamais par relevé --- */
const avecCritere = { ...donneesBase, objectifsSuivi: { [cleCalme]: { actif: true, unite: 'part', seuil: null } } };
const lignesCritere = lignesSuiviContinu(avecCritere, []);
t('une ligne pour le critère actif', lignesCritere.length, 1);
t('le nom reprend le libellé du critère', lignesCritere[0].objectif, 'Calme');
t('sans seuil : Suivi en mesure', lignesCritere[0].etat, 'mesure');
t('une seule valeur pour la seule journée cotée', lignesCritere[0].points.length, 1);
/* Segment calme : 09:00-10:00 (1h), segment agité : 10:00-11:00 (1h, borné par
   la clôture). Calme pèse donc 50 % du temps borné de l'axe ce jour-là. */
t('part du temps borné calculée sur le jour', lignesCritere[0].points[0].value, 50);

/* --- unite: 'part' alimente points, les autres mesures --- */
const avecMinutes = { ...donneesBase, objectifsSuivi: { [cleCalme]: { actif: true, unite: 'minutes', seuil: null } } };
const lignesMinutes = lignesSuiviContinu(avecMinutes, []);
t('unité minutes : la valeur part dans mesures', [lignesMinutes[0].points.length, lignesMinutes[0].mesures.length], [0, 1]);
t('60 minutes de calme ce jour-là', lignesMinutes[0].mesures[0].value, 60);
t('unite renseignée hors pourcentage', lignesMinutes[0].unite, 'min');

const avecEpisodes = { ...donneesBase, objectifsSuivi: { [cleCalme]: { actif: true, unite: 'episodes', seuil: null } } };
t('unité épisodes : un seul segment calme ce jour-là', lignesSuiviContinu(avecEpisodes, [])[0].mesures[0].value, 1);

/* --- Un compteur compte ses appuis du jour --- */
const avecCompteur = { ...donneesBase, objectifsSuivi: { [cleCompteur]: { actif: true, unite: 'part', seuil: null } } };
const lignesCompteur = lignesSuiviContinu(avecCompteur, []);
t('un compteur produit une ligne', lignesCompteur.length, 1);
t('toujours en occurrences, quelle que soit l unité réglée', lignesCompteur[0].unite, 'occurrences');
t('deux journées d appuis : deux mesures', lignesCompteur[0].mesures.length, 2);
t('deux appuis le premier jour', lignesCompteur[0].mesures.find((m) => m.date.startsWith(jourA)).value, 2);
t('un appui le second jour', lignesCompteur[0].mesures.find((m) => m.date.startsWith(jourB)).value, 1);

/* --- Seuil et jours consécutifs --- */
const avecSeuil = {
  ...donneesBase,
  objectifsSuivi: { [cleCompteur]: { actif: true, unite: 'occurrences', seuil: 1, jours: 2, sens: 'min' } },
};
t('seuil tenu deux jours de suite : acquis', lignesSuiviContinu(avecSeuil, [])[0].etat, 'acquis');
const avecSeuilTropExigeant = {
  ...donneesBase,
  objectifsSuivi: { [cleCompteur]: { actif: true, unite: 'occurrences', seuil: 1, jours: 5, sens: 'min' } },
};
t('seuil non tenu sur cinq jours : pas acquis',
  lignesSuiviContinu(avecSeuilTropExigeant, [])[0].etat !== 'acquis', true);

/* --- Identité : collision avec un objectif déjà coté --- */
const dejaCotes = [{ initials: 'L.M.', objectif: 'Calme' }];
const lignesAvecCollision = lignesSuiviContinu(avecCritere, dejaCotes);
t('un nom déjà pris chez la même personne est suffixé', lignesAvecCollision[0].objectif, 'Calme (suivi continu)');
const lignesAutrePersonne = lignesSuiviContinu(avecCritere, [{ initials: 'X.X.', objectif: 'Calme' }]);
t('la collision ne joue que pour la même personne', lignesAutrePersonne[0].objectif, 'Calme');

/* --- Réglage inactif ou personne différente --- */
const reglageInactif = { ...donneesBase, objectifsSuivi: { [cleCalme]: { actif: false, unite: 'part', seuil: null } } };
t('un réglage désactivé ne produit rien', lignesSuiviContinu(reglageInactif, []), []);
const cleAutrePersonne = cleObjectifSuivi('X.X.', 'critere:Humeur||calme');
const reglageAutrePersonne = { ...donneesBase, objectifsSuivi: { [cleAutrePersonne]: { actif: true, unite: 'part', seuil: null } } };
t('un réglage sans la personne correspondante ne produit rien', lignesSuiviContinu(reglageAutrePersonne, []), []);

/* --- Marque de provenance --- */
t('la ligne porte son type d origine', lignesCritere[0].origineSuivi, 'suivi');
t('et la clé du réglage qui l a produite', lignesCritere[0].cleSuivi, cleCalme);
t('un compteur porte le type compteur', lignesCompteur[0].origineSuivi, 'compteur');

/* ==================== filtrerLignePeriode ====================
   `mesures` n'était filtré nulle part avant ce chantier : une carte en mode
   mesure affichait tout son historique quelle que soit la période choisie,
   pendant que `points` la respectait déjà. Une seule fonction pour le Tableau
   de bord, la fiche personne et le rapport, pour qu'ils lisent la période de
   la même façon. */
const periodeJuillet = { mode: 'dates', debut: '2026-07-01', fin: '2026-07-31' };
const lignePourPeriode = {
  points: [{ date: '2026-06-15', value: 50 }, { date: '2026-07-10', value: 80 }],
  mesures: [{ date: '2026-06-20', value: 3 }, { date: '2026-07-15', value: 5 }],
};
const filtree = filtrerLignePeriode(lignePourPeriode, periodeJuillet);
t('points filtrés par la période', filtree.points.length, 1);
t('LE POINT CLÉ : mesures filtrées elle aussi', filtree.mesures.length, 1);
t('les deux gardent bien la valeur de juillet', [filtree.points[0].value, filtree.mesures[0].value], [80, 5]);
t('une ligne sans rien sur la période ressort vide des deux côtés',
  filtrerLignePeriode({ points: [{ date: '2026-01-01', value: 1 }], mesures: [] }, periodeJuillet),
  { points: [], mesures: [] });

/* ==================== construireFaits : table objectifs ====================
   Une ligne en mesure brute (occurrences, minutes, suivi continu promu en
   objectif) n'a pas de `points` : avant ce chantier, `objectifs.filter(l =>
   l.points.length)` l'excluait purement et simplement de l'Explorer. */
const donneesFaits = { personnes: [], seances: [], crises: [], suivi: [], stabilite: [], _idVersInitiales: {} };
const lignePourcent = {
  initials: 'L.M.', objectif: 'Couleurs', type: 'trials',
  points: [{ date: '2026-07-01', value: 60 }, { date: '2026-07-05', value: 80 }],
  mesures: [], etat: 'en_cours',
};
const ligneMesureSeule = {
  initials: 'L.M.', objectif: 'Estompage', type: 'suivi',
  points: [],
  mesures: [{ date: '2026-07-01', value: 40 }, { date: '2026-07-05', value: 55 }],
  etat: 'mesure',
};
const faits = construireFaits(donneesFaits, [lignePourcent, ligneMesureSeule]);
t('deux lignes, une par objectif — celle en mesure n est plus jetée',
  faits.objectifs.map((o) => o.objectif).sort(), ['Couleurs', 'Estompage']);
const factEstompage = faits.objectifs.find((o) => o.objectif === 'Estompage');
t('la ligne en mesure est datée de son dernier relevé', factEstompage.date, '2026-07-05');
t('LE POINT CLÉ : évolution réservée au pourcentage, jamais un delta de mesure brute',
  factEstompage.evolution, null);
const factCouleurs = faits.objectifs.find((o) => o.objectif === 'Couleurs');
t('une ligne en pourcentage garde son évolution', factCouleurs.evolution, 20);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
