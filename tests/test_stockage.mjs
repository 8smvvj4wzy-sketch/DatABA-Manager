/* Persistance du bloc consolidé. Zone jusqu'ici sans aucun test, et c'est
   là qu'un import entier pouvait disparaître : `localStorage.setItem` lève
   QuotaExceededError passé ~5 Mo, l'ancien code avalait l'exception, la
   session continuait normalement et le poste rouvrait vide.

   Fonctions extraites de src/App.jsx, pas recopiées (voir
   test_acquisition.mjs). `ouvrirBase` est le seul point remplacé : les tests
   lui donnent une fausse base IndexedDB pour pouvoir provoquer un quota, une
   lecture en panne ou une écriture lente. Le chiffrement est court-circuité —
   il est le même que côté DatABA et n'est pas le sujet ici. */

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
  const debut = lignes.findIndex((l) => l.startsWith(`function ${nom}(`)
    || l.startsWith(`async function ${nom}(`) || l.startsWith(`const ${nom} =`));
  if (debut < 0) throw new Error(`Déclaration introuvable dans src/App.jsx : ${nom}`);
  for (let i = debut; i < lignes.length; i++) {
    if (i > debut && /^(\}|\];|\);)/.test(lignes[i])) {
      return lignes.slice(debut, i + 1).join('\n');
    }
  }
  throw new Error(`Fin de déclaration introuvable : ${nom}`);
}

const code = [
  'const { window, ouvrirBase } = ctx;',
  'let dataKey = null;',
  "const PREFIXE = 'aba-cadre:';",
  "const STORE_KEY = PREFIXE + 'data';",
  "const IDB_TABLE = 'bloc';",
  "const IDB_CLE = 'data';",
  extraire('VIDE'),
  extraire('normaliser'),
  extraire('lireIDB'),
  extraire('ecrireIDB'),
  extraire('effacerIDB'),
  extraire('estQuota'),
  extraire('chargerDonnees'),
  'let chaineEcriture = Promise.resolve();',
  extraire('sauverDonnees'),
  extraire('ecrireBloc'),
  extraire('effacerDonneesManager'),
  'return { chargerDonnees, sauverDonnees, effacerDonneesManager, estQuota };',
].join('\n');
// eslint-disable-next-line no-new-func
const fabrique = new Function('ctx', code);

/* --- Faux stockage local ---
   `quota` en nombre de caractères, `amnesique` pour la fenêtre de navigation
   privée qui accepte l'écriture et ne rend rien. */
function faireLocalStorage({ quota = Infinity, amnesique = false, initial = {} } = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get length() { return m.size; },
    key(i) { return Array.from(m.keys())[i] ?? null; },
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) {
      if (String(v).length > quota) {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
      if (!amnesique) m.set(k, String(v));
    },
    removeItem(k) { m.delete(k); },
    _contenu: m,
  };
}

/* --- Fausse base IndexedDB ---
   Reproduit le point qui compte : un dépassement de quota laisse la requête
   `put` réussir, puis avorte la transaction. Un code qui écouterait
   `req.onsuccess` au lieu de `tx.oncomplete` annoncerait donc une écriture
   qui n'a jamais eu lieu. */
function faireBase({ quota = Infinity, lectureCasse = false, delai = () => 0 } = {}) {
  const contenu = new Map();
  const db = {
    contenu,
    transaction() {
      const tx = { onerror: null, oncomplete: null, onabort: null, error: null };
      tx.objectStore = () => ({
        put(valeur, cle) {
          const req = { onsuccess: null, onerror: null };
          setTimeout(() => {
            if (req.onsuccess) req.onsuccess();
            if (String(valeur).length > quota) {
              tx.error = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
              if (tx.onabort) tx.onabort();
              return;
            }
            contenu.set(cle, String(valeur));
            if (tx.oncomplete) tx.oncomplete();
          }, delai(valeur));
          return req;
        },
        get(cle) {
          const req = { onsuccess: null, onerror: null };
          setTimeout(() => {
            if (lectureCasse) {
              req.error = new Error('lecture en panne');
              if (req.onerror) req.onerror();
              return;
            }
            req.result = contenu.has(cle) ? contenu.get(cle) : undefined;
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        },
        delete(cle) {
          const req = {};
          setTimeout(() => { contenu.delete(cle); if (tx.oncomplete) tx.oncomplete(); }, 0);
          return req;
        },
      });
      return tx;
    },
  };
  return db;
}

const monter = ({ base = faireBase(), ls = faireLocalStorage() } = {}) => ({
  api: fabrique({ window: { localStorage: ls }, ouvrirBase: async () => base }),
  base, ls,
});

const bloc = { personnes: [{ initials: 'A.B.' }], seances: [{ id: 's1' }] };

/* ---------- 1. Le cas nominal, et la fin de localStorage ---------- */
{
  const { api, base, ls } = monter({ ls: faireLocalStorage({ initial: { 'aba-cadre:data': 'ancien' } }) });
  const r = await api.sauverDonnees(bloc);
  t('une écriture réussie annonce IndexedDB', [r.ok, r.ou], [true, 'indexeddb']);
  t('le bloc est bien dans IndexedDB', JSON.parse(base.contenu.get('data')).seances.length, 1);
  t('le doublon localStorage est retiré', ls.getItem('aba-cadre:data'), null);
}

/* ---------- 2. Migration depuis l'ancien emplacement ---------- */
{
  const ls = faireLocalStorage({ initial: { 'aba-cadre:data': JSON.stringify(bloc) } });
  const { api, base } = monter({ ls });
  const lu = await api.chargerDonnees();
  t('un bloc resté en localStorage est lu', [lu.etat, lu.ou, lu.donnees.seances.length], ['ok', 'localstorage', 1]);
  await api.sauverDonnees(lu.donnees);
  t('la première écriture le déplace dans IndexedDB', base.contenu.has('data'), true);
  t('et libère la place en localStorage', ls.getItem('aba-cadre:data'), null);
}

/* ---------- 3. IndexedDB indisponible : repli assumé ---------- */
{
  const api = fabrique({ window: { localStorage: faireLocalStorage() }, ouvrirBase: async () => null });
  const r = await api.sauverDonnees(bloc);
  t('sans IndexedDB, le repli localStorage est annoncé', [r.ok, r.ou], [true, 'localstorage']);
}

/* ---------- 4. Le bug d'origine : les deux stockages pleins ---------- */
{
  const { api } = monter({
    base: faireBase({ quota: 10 }),
    ls: faireLocalStorage({ quota: 10 }),
  });
  const r = await api.sauverDonnees(bloc);
  t('un quota atteint des deux côtés est un échec, pas un silence', [r.ok, r.raison], [false, 'quota']);
}
{
  /* IndexedDB plein mais localStorage assez large : l'écriture doit passer,
     et surtout ne pas être annoncée réussie côté IndexedDB — c'est la
     transaction avortée qui le dit, pas la requête. */
  const { api, base } = monter({ base: faireBase({ quota: 10 }) });
  const r = await api.sauverDonnees(bloc);
  t('IndexedDB plein bascule sur localStorage', [r.ok, r.ou], [true, 'localstorage']);
  t("et rien n'a été écrit dans IndexedDB", base.contenu.has('data'), false);
}

/* ---------- 5. Le stockage qui accepte et ne conserve rien ---------- */
{
  const api = fabrique({
    window: { localStorage: faireLocalStorage({ amnesique: true }) },
    ouvrirBase: async () => null,
  });
  const r = await api.sauverDonnees(bloc);
  t('une écriture acceptée puis relue vide est un échec', [r.ok, r.raison], [false, 'relecture']);
}

/* ---------- 6. Une lecture ratée ne doit pas passer pour un poste vide ----------
   C'est la seconde moitié du bug : `chargerDonnees` rendait VIDE dans tous
   les cas d'erreur, et l'effet d'enregistrement écrasait aussitôt le bloc
   encore intact par cet état vide. */
{
  const { api } = monter({ base: faireBase({ lectureCasse: true }) });
  const lu = await api.chargerDonnees();
  t('une lecture en panne se signale illisible', [lu.etat, lu.raison], ['illisible', 'lecture']);
}
{
  /* IndexedDB en panne mais l'ancien bloc encore en localStorage : la panne
     ne doit pas masquer un bloc parfaitement lisible. Il n'y a jamais deux
     copies, donc chercher plus loin ne peut pas rendre une version périmée. */
  const { api } = monter({
    base: faireBase({ lectureCasse: true }),
    ls: faireLocalStorage({ initial: { 'aba-cadre:data': JSON.stringify(bloc) } }),
  });
  const lu = await api.chargerDonnees();
  t("une panne IndexedDB n'empêche pas de lire l'ancien emplacement",
    [lu.etat, lu.ou, lu.donnees.seances.length], ['ok', 'localstorage', 1]);
}
{
  const { api, base } = monter();
  base.contenu.set('data', '{ ceci n est pas du JSON');
  const lu = await api.chargerDonnees();
  t('un bloc corrompu se signale illisible', [lu.etat, lu.raison], ['illisible', 'dechiffrement']);
  t('et ne rend pas de données', lu.donnees.seances.length, 0);
}
{
  const { api } = monter();
  const lu = await api.chargerDonnees();
  t('un poste réellement vierge se dit vide', [lu.etat, lu.ou], ['vide', null]);
}

/* ---------- 7. Écritures rapprochées : l'ordre d'appel fait foi ----------
   Deux `setDonnees` de suite lancent deux écritures ; sans file, la plus
   lente valide après la plus récente et remet l'état précédent. */
{
  const lent = (v) => (String(v).includes('lent') ? 30 : 0);
  const { api, base } = monter({ base: faireBase({ delai: lent }) });
  const p1 = api.sauverDonnees({ ...bloc, marque: 'lent' });
  const p2 = api.sauverDonnees({ ...bloc, marque: 'rapide' });
  await Promise.all([p1, p2]);
  t("la dernière écriture appelée est celle qui reste", JSON.parse(base.contenu.get('data')).marque, 'rapide');
}

/* ---------- 8. L'effacement reste borné à Manager ---------- */
{
  const ls = faireLocalStorage({
    initial: {
      'aba-cadre:data': 'x', 'aba-cadre:securite': 'y', 'aba-cadre:theme': 'dark',
      'aba:students': 'DONNEES DE LA TABLETTE', 'autre': 'z',
    },
  });
  const { api, base } = monter({ ls });
  base.contenu.set('data', 'x');
  await api.effacerDonneesManager();
  t('IndexedDB est vidé', base.contenu.has('data'), false);
  t('les clés aba-cadre: sont parties', Array.from(ls._contenu.keys()).filter((k) => k.startsWith('aba-cadre:')), []);
  t('les données DatABA sont intactes', ls.getItem('aba:students'), 'DONNEES DE LA TABLETTE');
  t('et le reste du stockage aussi', ls.getItem('autre'), 'z');
}

/* ---------- 9. Reconnaissance du quota selon les navigateurs ---------- */
{
  const { api } = monter();
  t('QuotaExceededError reconnu', api.estQuota({ name: 'QuotaExceededError' }), true);
  t('code 22 reconnu (anciens WebKit)', api.estQuota({ code: 22 }), true);
  t('code 1014 reconnu (Firefox)', api.estQuota({ code: 1014 }), true);
  t('une panne quelconque ne passe pas pour un quota', api.estQuota(new Error('boom')), false);
}

console.log(`\n${ok} réussi(s), ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
