/* Compteurs d'occurrence du suivi continu.

   Un appui de compteur voyage dans `suivi`, au milieu des relevés d'état, mais
   il est ponctuel : il n'a ni axe, ni critère, ni durée jusqu'au suivant. Le
   laisser passer dans segmentsJournee lui inventait un état qui dure jusqu'à
   l'appui d'après — huit appuis sur « demandes » sortaient en sept segments
   d'une durée jamais observée. C'est la régression que verrouille ce fichier.

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
  'fusionnerParId', 'fusionnerClasses', 'fusionnerImport',
  'axeDe', 'metaCritereSuivi', 'axeEtCritereDuReleve',
  'suiviDePersonne', 'compteursDePersonne',
  'jourLocal', 'segmentsJournee', 'segmentsSuivi', 'joursObserves',
  'cleAgregation', 'etiquetteAgregation', 'chronologieCompteurs',
];
const code = [
  `const ACQUIS = '#0F8B6C'; const EN_COURS = '#D69A2D'; const NON_ACQUIS = '#A8402F'; const INK_SOFT = '#6B7280'; const CAT_INDIGO = '#3B5BDB';`,
  `const CRITERE_INCONNU_SUIVI = ${extraireLigne('CRITERE_INCONNU_SUIVI')};`,
  `const estReleveCompteur = ${extraireLigne('estReleveCompteur')};`,
  `const nomCompteurDe = ${extraireLigne('nomCompteurDe')};`,
  `const cleSerieCompteur = ${extraireLigne('cleSerieCompteur')};`,
  extraire('VIDE'),
  extraire('CRITERES_STABILITE_V3'),
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, VIDE, cleSerieCompteur, nomCompteurDe };`,
].join('\n');
// eslint-disable-next-line no-new-func
const {
  fusionnerImport, suiviDePersonne, compteursDePersonne, segmentsSuivi,
  joursObserves, chronologieCompteurs, cleSerieCompteur, nomCompteurDe, VIDE,
} = new Function(code)();

/* ==================== Capture des compteurs à l'import ==================== */

/* Côté DatABA le compteur est défini sur la personne et ses appuis partent
   dans `suivi`, mêlés aux relevés d'état. Sans capture de `students[].compteurs`
   à l'import, Manager avait les appuis mais pas les noms. */
const backupDatABA = {
  students: [{
    id: 'a1',
    initials: 'L.M.',
    compteurs: [{ id: 'c1', nom: 'Demandes' }, { id: 'c2', nom: '  ' }],
  }],
  axesSuivi: [{ id: 'ax', nom: 'Humeur', criteres: [{ k: 'calme', l: 'Calme', color: '#0F8B6C' }] }],
  suivi: [
    { id: 'r1', studentId: 'a1', timestamp: '2026-05-04T09:00:00', suiviId: 'ax', critere: 'calme' },
    { id: 'k1', studentId: 'a1', timestamp: '2026-05-04T09:10:00', compteurId: 'c1', kind: 'compteur' },
    { id: 'k2', studentId: 'a1', timestamp: '2026-05-04T09:20:00', compteurId: 'c1', kind: 'compteur' },
  ],
  sessions: [], crises: [],
};
const base = fusionnerImport(VIDE, backupDatABA, 'tabA');
t('les compteurs de la personne sont captés par source',
  base._compteurs.tabA.c1, 'Demandes');
t('un compteur sans nom prend le repli de DatABA',
  base._compteurs.tabA.c2, 'Compteur sans nom');
t('un identifiant absent de la table se lit « retiré »',
  nomCompteurDe(base, 'tabA', 'jamais-vu'), 'Compteur retiré');
t('un appui sans compteurId ne peut rien nommer',
  nomCompteurDe(base, 'tabA', null), 'Compteur retiré');

/* Chemin Manager → Manager : la table est reconstruite en tableau plat, la
   forme `students[].compteurs` n'existe plus à ce stade. */
const viaManager = fusionnerImport(VIDE, {
  students: [{ id: 'a1', initials: 'L.M.' }],
  compteurs: [{ id: 'c1', nom: 'Demandes' }],
  suivi: [], sessions: [], crises: [],
}, 'tabA');
t('le tableau plat alimente la même table', viaManager._compteurs.tabA.c1, 'Demandes');

/* Une table de nomenclature se complète, elle ne s'écrase pas : un fichier
   partiel ne doit pas faire disparaître les noms déjà connus. */
const partiel = fusionnerImport(base, {
  students: [{ id: 'a1', initials: 'L.M.' }],
  suivi: [], sessions: [], crises: [],
}, 'tabA');
t('un fichier sans compteurs n efface pas la table', partiel._compteurs.tabA.c1, 'Demandes');

/* ==================== Séparation des deux flux ==================== */

const donnees = { ...base, personnes: [{ id: 'a1', initials: 'L.M.' }] };

const historique = suiviDePersonne(donnees, 'L.M.');
t('LE POINT CLÉ : un appui de compteur ne figure pas dans le suivi continu',
  historique.map((r) => r.id), ['r1']);
t('et ne produit donc aucun segment',
  segmentsSuivi(historique).length, 1);
t('le seul segment est celui du relevé d état',
  segmentsSuivi(historique)[0].nomAxe, 'Humeur');

const appuis = compteursDePersonne(donnees, 'L.M.');
t('les appuis se lisent par leur propre chemin', appuis.map((r) => r.id), ['k2', 'k1']);
t('triés du plus récent au plus ancien',
  appuis.map((r) => r.timestamp), ['2026-05-04T09:20:00', '2026-05-04T09:10:00']);
t('chaque appui porte le nom de son compteur', appuis[0].nomCompteur, 'Demandes');
t('une personne sans appui n en a pas', compteursDePersonne(donnees, 'X.X.'), []);

/* Une journée où seul un compteur a servi reste une journée observée : sans
   ajout explicite dans joursObserves, elle disparaissait des jours cotés
   maintenant que suiviDePersonne écarte les appuis. */
const donneesCompteurSeul = {
  ...VIDE,
  personnes: [{ id: 'a1', initials: 'L.M.' }],
  _idVersInitiales: { tabA: { a1: 'L.M.' } },
  _compteurs: { tabA: { c1: 'Demandes' } },
  suivi: [{ id: 'k9', studentId: 'a1', timestamp: '2026-06-02T10:00:00', compteurId: 'c1', kind: 'compteur', source: 'tabA' }],
};
t('une journée de compteur seul reste observée',
  Array.from(joursObserves(donneesCompteurSeul, 'L.M.')), ['2026-06-02']);

/* ==================== chronologieCompteurs ==================== */

const app = (id, compteurId, ts) => ({
  id, compteurId, timestamp: ts, nomCompteur: compteurId === 'c1' ? 'Demandes' : 'Refus',
});
const serie = [
  app('a', 'c1', '2026-05-04T09:00:00'),
  app('b', 'c1', '2026-05-04T11:00:00'),
  app('c', 'c2', '2026-05-04T14:00:00'),
  app('d', 'c1', '2026-05-05T09:00:00'),
  app('e', 'c1', '2026-05-11T09:00:00'),
];

const parJour = chronologieCompteurs(serie, 'jour');
t('une tranche par journée où un compteur a servi', parJour.length, 3);
t('les appuis du jour se comptent',
  parJour[0].series[cleSerieCompteur('c1')].valeur, 2);
t('deux compteurs du même jour ne se mélangent pas',
  parJour[0].series[cleSerieCompteur('c2')].valeur, 1);
t('le nom du compteur voyage avec la série',
  parJour[0].series[cleSerieCompteur('c1')].nomCompteur, 'Demandes');
/* Un compteur n'a pas de dénominateur qui veuille dire quelque chose : pas de
   part, et surtout pas une part inventée sur le total des compteurs. */
t('aucune part n est calculée', parJour[0].series[cleSerieCompteur('c1')].part, null);

const parSemaine = chronologieCompteurs(serie, 'semaine');
t('par semaine : lundi et mardi ensemble, la semaine suivante à part', parSemaine.length, 2);
t('la semaine cumule ses journées',
  parSemaine[0].series[cleSerieCompteur('c1')].valeur, 3);
t('les tranches sortent dans l ordre du calendrier',
  parSemaine.map((x) => x.cle).every((c, i, a) => i === 0 || a[i - 1] < c), true);
t('par mois : tout se regroupe', chronologieCompteurs(serie, 'mois').length, 1);

t('aucun appui : aucune tranche', chronologieCompteurs([], 'jour'), []);
t('un horodatage illisible est écarté',
  chronologieCompteurs([app('z', 'c1', 'pas une date')], 'jour'), []);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
