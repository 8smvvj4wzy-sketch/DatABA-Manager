/* Jeu de guidances de l'établissement, et repli du calcul de score.

   DatABA exporte sa liste globale (`backup.guidances`) et s'en sert de repli
   quand un objectif ne porte pas son propre `config.guidanceSet` — c'est elle
   qui dit quel code vaut « indépendant ». Manager la jetait à l'import et
   retombait en dur sur le code 'I' : sur une tablette dont l'établissement
   avait renommé ce code, ou en avait marqué un second, le bilan contredisait
   silencieusement la tablette qui l'avait produit. Le jeu de démonstration de
   DatABA rend le cas systématique : ses 1 852 snapshots ont tous un
   `guidanceSet` vide.

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
const lignes = source.split('\n');

function extraire(nom) {
  const debut = lignes.findIndex((l) => l.startsWith(`function ${nom}(`) || l.startsWith(`const ${nom} =`));
  if (debut < 0) throw new Error(`Déclaration introuvable dans src/App.jsx : ${nom}`);
  if (/;\s*$/.test(lignes[debut])) return lignes[debut];
  for (let i = debut; i < lignes.length; i++) {
    if (i > debut && /^(\}|\];|\);)/.test(lignes[i])) return lignes.slice(debut, i + 1).join('\n');
  }
  throw new Error(`Fin de déclaration introuvable : ${nom}`);
}

const NOMS = ['VIDE', 'normaliser', 'fusionnerClasses', 'fusionnerParId', 'fusionnerImport',
  'objectiveScoreValue', 'UNITES_BRUTES', 'parseHM', 'partNiveauCible', 'valeurCotation', 'guidancesDe'];
const ordre = (n) => {
  const i = lignes.findIndex((l) => l.startsWith(`function ${n}(`) || l.startsWith(`const ${n} =`));
  return i < 0 ? Infinity : i;
};
NOMS.sort((a, b) => ordre(a) - ordre(b));
// eslint-disable-next-line no-new-func
const M = new Function(`${NOMS.map(extraire).join('\n')}\nreturn { ${NOMS.join(', ')} };`)();

const PAR_DEFAUT = [
  { code: 'I', label: 'Indépendant', independent: true },
  { code: 'GP', label: 'Guidance partielle', independent: false },
  { code: 'GT', label: 'Guidance totale', independent: false },
];
/* Un établissement qui a renommé son code d'indépendance : 'I' y désigne une
   invite, et c'est 'IV' qui vaut indépendant. */
const RENOMME = [
  { code: 'IV', label: 'Indépendant verbal', independent: true },
  { code: 'I', label: 'Invite', independent: false },
  { code: 'GP', label: 'Guidance partielle', independent: false },
];

/* ==================== Import ==================== */
const importe = (backup, actuel) => M.normaliser(M.fusionnerImport(actuel || M.VIDE, backup, 'T1'));

t('les guidances du fichier entrent dans _guidances, par source',
  M.guidancesDe(importe({ guidances: PAR_DEFAUT }), 'T1').map((g) => g.code), ['I', 'GP', 'GT']);
t('le drapeau independent est conservé',
  M.guidancesDe(importe({ guidances: PAR_DEFAUT }), 'T1').find((g) => g.code === 'I').independent, true);
t('une sauvegarde sans guidances laisse la table vide',
  M.guidancesDe(importe({}), 'T1'), []);
t('une guidance sans code est ignorée',
  M.guidancesDe(importe({ guidances: [{ label: 'anonyme' }, { code: 'I', independent: true }] }), 'T1').length, 1);
t('un libellé absent retombe sur le code',
  M.guidancesDe(importe({ guidances: [{ code: 'GP' }] }), 'T1')[0].label, 'GP');

/* Fusion par code, pas remplacement : c'est ce qui distingue `_guidances` de
   `_axesSuivi`, dont le remplacement fait basculer les relevés passés en
   « Suivi retiré » dès qu'un export perd un axe. */
const apresDeux = importe({ guidances: [{ code: 'I', label: 'Indépendant', independent: false }] },
  importe({ guidances: PAR_DEFAUT }));
t('un code absent du second fichier survit',
  M.guidancesDe(apresDeux, 'T1').map((g) => g.code), ['I', 'GP', 'GT']);
t('le fichier entrant gagne sur un code déjà connu',
  M.guidancesDe(apresDeux, 'T1').find((g) => g.code === 'I').independent, false);

/* Deux tablettes peuvent avoir des jeux différents : la table est par source. */
const deuxSources = M.normaliser(M.fusionnerImport(importe({ guidances: PAR_DEFAUT }), { guidances: RENOMME }, 'T2'));
t('la table reste propre à chaque source',
  [M.guidancesDe(deuxSources, 'T1').length, M.guidancesDe(deuxSources, 'T2').length], [3, 3]);
t('une source inconnue rend une liste vide, pas une erreur',
  M.guidancesDe(deuxSources, 'T3'), []);

/* ==================== Score ==================== */
const trials = { type: 'trials', config: {} };
const deuxSurQuatre = { trials: ['I', 'GP', 'I', 'GP'] };

t('sans table, le repli reste le code I', M.objectiveScoreValue(trials, deuxSurQuatre), 50);
t('la table par défaut donne le même verdict',
  M.objectiveScoreValue(trials, deuxSurQuatre, PAR_DEFAUT), 50);
t('un jeu où I n’est plus indépendant change le score',
  M.objectiveScoreValue(trials, deuxSurQuatre, RENOMME), 0);
t('et le code renommé compte bien comme indépendant',
  M.objectiveScoreValue(trials, { trials: ['IV', 'I', 'IV', 'GP'] }, RENOMME), 50);

/* Le jeu propre à l'objectif prime sur celui de l'établissement : c'est la
   règle d'`objectiveGuidances` côté DatABA, le drapeau y est décidé pour cette
   personne et cet objectif. */
const avecSet = { type: 'trials', config: { guidanceSet: [{ code: 'I', independent: true }, { code: 'GP', independent: false }] } };
t('le guidanceSet de l’objectif prime sur le jeu de l’établissement',
  M.objectiveScoreValue(avecSet, deuxSurQuatre, RENOMME), 50);
t('un guidanceSet vide n’écrase pas le jeu de l’établissement',
  M.objectiveScoreValue({ type: 'trials', config: { guidanceSet: [] } }, deuxSurQuatre, RENOMME), 0);

/* Le chaînage et le probe passent par le même drapeau. */
const chainage = { type: 'chaining', config: { steps: [{ id: 'a' }, { id: 'b' }] } };
t('chaînage : le jeu de l’établissement s’applique aussi',
  M.objectiveScoreValue(chainage, { steps: { a: 'I', b: 'GP' } }, RENOMME), 0);
t('probe par guidance : idem',
  M.objectiveScoreValue({ type: 'probe', config: {} }, { guidance: 'IV' }, RENOMME), 100);

/* valeurCotation relaie l'argument sans le perdre en route. */
t('valeurCotation relaie les guidances',
  M.valeurCotation(trials, deuxSurQuatre, RENOMME).valeur, 0);
t('et rend toujours un pourcentage',
  M.valeurCotation(trials, deuxSurQuatre, RENOMME).unite, '%');

/* ==================== Intervalle sans niveau cible ==================== */
/* `totaux[undefined] || 0` valait 0 : un snapshot amputé de ses niveaux se
   lisait « 0 % » puis « Non acquis », comme un échec, au lieu d'être écarté
   faute de quoi juger. */
t('intervalle sans niveaux : rien à mesurer, pas un zéro',
  M.partNiveauCible({ config: {} }, { marks: { 1: 'a', 2: 'b' } }), null);
t('intervalle avec niveaux : la part du niveau cible',
  M.partNiveauCible({ config: { levels: [{ id: 'a' }, { id: 'b' }], targetLevelId: 'a' } },
    { marks: { 1: 'a', 2: 'b', 3: 'a', 4: 'b' } }), 50);
t('sans targetLevelId, le premier niveau fait cible',
  M.partNiveauCible({ config: { levels: [{ id: 'a' }, { id: 'b' }] } },
    { marks: { 1: 'a', 2: 'b' } }), 50);
t('aucun relevé : rien, pas un zéro',
  M.partNiveauCible({ config: { levels: [{ id: 'a' }], targetLevelId: 'a' } }, { marks: {} }), null);

console.log(`\n${ok} réussi(s), ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
