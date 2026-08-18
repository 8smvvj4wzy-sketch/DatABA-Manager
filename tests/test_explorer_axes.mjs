/* Les axes qui manquaient à Explorer : tranche horaire, et le temps
   d'accompagnement.

   PRODUCT.md nomme l'heure de la journée comme l'exemple même du facteur qui
   trompe une comparaison d'ateliers — « un écart sur un atelier peut venir de
   l'heure à laquelle il est programmé » — et l'horodatage était là depuis le
   début sans que rien ne sache le lire.

   Deux pièges, tous deux verrouillés ici :
   1. une date SANS heure (« 2026-06-02 ») est lue par le navigateur comme
      minuit UTC ; la convertir en heure locale fabriquerait une tranche de
      deux heures du matin que personne n'a observée ;
   2. la durée d'une séance voyage sur chacune de ses cotations — la sommer
      telle quelle multiplierait 45 minutes par le nombre d'objectifs cotés.

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
function extraireLigne(nom) {
  const re = new RegExp(`^const ${nom} = (.+);$`, 'm');
  const m = source.match(re);
  if (!m) throw new Error(`Constante introuvable (ligne unique) dans src/App.jsx : ${nom}`);
  return m[1];
}

const NOMS = ['heureDe', 'libelleTrancheHoraire', 'agreger'];
const code = [
  `const TRANCHE_HORAIRE_PAS = ${extraireLigne('TRANCHE_HORAIRE_PAS')};`,
  NOMS.map(extraire).join('\n'),
  `return { ${NOMS.join(', ')}, TRANCHE_HORAIRE_PAS };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { heureDe, libelleTrancheHoraire, agreger, TRANCHE_HORAIRE_PAS } = new Function(code)();

/* ==================== heureDe ==================== */
/* LE POINT CLÉ : une date sans heure ne doit rien produire. Sous UTC+2,
   `new Date('2026-06-02').getHours()` vaut 2 — une tranche « 02 h – 04 h »
   qui n'a jamais existé, sur toutes les séances non horodatées de la base. */
t('une date sans heure ne rend aucune heure', heureDe('2026-06-02'), null);
t('un horodatage ISO rend son heure locale',
  heureDe('2026-06-02T14:30:00'), new Date('2026-06-02T14:30:00').getHours());
t('un horodatage numérique (startedAt) aussi',
  heureDe(new Date('2026-06-02T09:15:00').getTime()), new Date('2026-06-02T09:15:00').getHours());
t('minuit est bien zéro et non une absence',
  heureDe('2026-06-02T00:10:00'), new Date('2026-06-02T00:10:00').getHours());
t('rien du tout ne rend rien', heureDe(null), null);
t('une valeur illisible ne rend pas NaN', heureDe('pas-une-date'), null);

/* ==================== libelleTrancheHoraire ==================== */
t('le pas est de deux heures', TRANCHE_HORAIRE_PAS, 2);
t('9 h tombe dans la tranche de 8 h', libelleTrancheHoraire(9), '08 h – 10 h');
t('8 h ouvre sa propre tranche', libelleTrancheHoraire(8), '08 h – 10 h');
t('la première tranche est zéro-remplie', libelleTrancheHoraire(0), '00 h – 02 h');
t('la dernière va jusqu’à 24 h', libelleTrancheHoraire(23), '22 h – 24 h');
t('sans heure, la tranche le dit', libelleTrancheHoraire(null), 'Heure inconnue');

/* Explorer trie ses en-têtes par localeCompare : le zéro-remplissage doit
   suffire à ce que l'ordre alphabétique soit l'ordre du calendrier, et
   « Heure inconnue » doit se ranger après les chiffres plutôt qu'au milieu. */
const tranches = [23, 8, 0, 14, null].map(libelleTrancheHoraire)
  .sort((a, b) => String(a).localeCompare(String(b), 'fr'));
t('les tranches se trient dans l’ordre de la journée',
  tranches, ['00 h – 02 h', '08 h – 10 h', '14 h – 16 h', '22 h – 24 h', 'Heure inconnue']);

/* ==================== agreger, mode sommeUnique ==================== */
const tempsSeance = { agg: 'sommeUnique', champ: 'minutesSeance', cle: 'seanceId' };
const cot = (seanceId, minutesSeance) => ({ seanceId, minutesSeance });

/* Une séance de 45 minutes portant trois cotations pèse 45, pas 135. */
t('la durée d’une séance ne compte qu’une fois',
  agreger([cot('s1', 45), cot('s1', 45), cot('s1', 45)], tempsSeance), 45);
t('deux séances s’additionnent',
  agreger([cot('s1', 45), cot('s1', 45), cot('s2', 30)], tempsSeance), 75);
t('une séance non bornée ne pèse rien, mais n’annule pas les autres',
  agreger([cot('s1', 45), cot('s2', null)], tempsSeance), 45);
t('aucune séance bornée : zéro, et non null — les séances existent',
  agreger([cot('s1', null), cot('s2', null)], tempsSeance), 0);
t('une case sans fait reste vide', agreger([], tempsSeance), null);
t('un fait sans clé de séance est ignoré',
  agreger([cot(null, 90), cot('s1', 45)], tempsSeance), 45);

/* Les autres modes d'agrégation ne doivent pas avoir bougé. */
t('le comptage reste le comptage', agreger([cot('s1', 45), cot('s2', 30)], { agg: 'compte' }), 2);
t('le distinct reste le distinct',
  agreger([cot('s1', 45), cot('s1', 45), cot('s2', 30)], { agg: 'distinct', champ: 'seanceId' }), 2);
t('la somme simple additionne bien tout',
  agreger([cot('s1', 45), cot('s1', 45)], { agg: 'somme', champ: 'minutesSeance' }), 90);

console.log(`\n${ok} réussis, ${ko} échecs`);
process.exit(ko ? 1 : 0);
