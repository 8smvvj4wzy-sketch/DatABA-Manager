/* Verrouillage automatique au retour d'absence : une perte de focus (bascule
   d'onglet) ne doit plus verrouiller immédiatement — seulement une absence
   d'au moins DELAI_VERROUILLAGE. Fonction extraite de src/App.jsx, pas
   recopiée : voir test_acquisition.mjs pour la raison. */

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

const code = [
  extraire('doitVerrouillerAuRetour'),
  `return { doitVerrouillerAuRetour, DELAI_VERROUILLAGE: ${extraireLigne('DELAI_VERROUILLAGE')} };`,
].join('\n');
// eslint-disable-next-line no-new-func
const { doitVerrouillerAuRetour, DELAI_VERROUILLAGE } = new Function(code)();

t('le délai vaut bien 15 minutes', DELAI_VERROUILLAGE, 15 * 60 * 1000);

const T0 = 1_700_000_000_000; // instant de référence arbitraire, fixe

t('absence courte (bascule d\'onglet, 2 s) : pas de verrouillage',
  doitVerrouillerAuRetour(T0, T0 + 2000, DELAI_VERROUILLAGE), false);
t('absence de 14 min 59 s : pas de verrouillage',
  doitVerrouillerAuRetour(T0, T0 + DELAI_VERROUILLAGE - 1000, DELAI_VERROUILLAGE), false);
t('absence de pile 15 min : verrouillage',
  doitVerrouillerAuRetour(T0, T0 + DELAI_VERROUILLAGE, DELAI_VERROUILLAGE), true);
t('absence de plus de 15 min : verrouillage',
  doitVerrouillerAuRetour(T0, T0 + DELAI_VERROUILLAGE + 60000, DELAI_VERROUILLAGE), true);
t('aucun départ enregistré (partiA null) : pas de verrouillage',
  doitVerrouillerAuRetour(null, T0, DELAI_VERROUILLAGE), false);

console.log(`\n${ok} réussis, ${ko} en échec`);
process.exit(ko ? 1 : 0);
