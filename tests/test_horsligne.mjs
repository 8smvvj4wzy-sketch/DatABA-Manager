/* Précache déterministe et service worker. Deux zones :
   - scripts/precache.mjs, importé directement (classement, empreinte,
     injection) ;
   - public/sw.js, chargé comme texte et exécuté dans un faux environnement
     de service worker (self, caches, fetch simulés) pour rejouer la
     régression qui a motivé cette suite : skipWaiting() appelé avant que le
     précache soit terminé, et activate() qui purgeait sans avoir vérifié que
     le nouveau cache était complet — voir CLAUDE.md, piège « Le hors-ligne
     ne se découvre pas à l'exécution ». */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classerFichiers, empreinte, injecterPrecache } from '../scripts/precache.mjs';

let ok = 0, ko = 0;
const t = (n, a, e) => {
  const p = JSON.stringify(a) === JSON.stringify(e);
  console.log(`${p ? 'OK  ' : 'ECHEC'} ${n}` + (p ? '' : ` → ${JSON.stringify(a)} au lieu de ${JSON.stringify(e)}`));
  p ? ok++ : ko++;
};

const ici = dirname(fileURLToPath(import.meta.url));

/* ==================== scripts/precache.mjs ==================== */

{
  const { obligatoires, facultatifs } = classerFichiers([
    'index.html',
    'manifest.webmanifest',
    'sw.js',
    'assets/index-ABC123.js',
    'assets/index-ABC123.css',
    'assets/police-XYZ.woff2',
    'icon-192.png',
    'icon-512.png',
    'logo-databamanager.png',
  ]);
  t('classerFichiers : obligatoires = coquille + tout assets/', obligatoires, [
    './', './assets/index-ABC123.css', './assets/index-ABC123.js', './assets/police-XYZ.woff2',
    './index.html', './manifest.webmanifest',
  ]);
  t('classerFichiers : facultatifs = le reste', facultatifs, [
    './icon-192.png', './icon-512.png', './logo-databamanager.png',
  ]);
  t('classerFichiers : sw.js jamais précaché (ni obligatoire ni facultatif)',
    obligatoires.includes('./sw.js') || facultatifs.includes('./sw.js'), false);
}

{
  const e1 = empreinte([{ nom: 'a.js', contenu: 'aaa' }, { nom: 'b.css', contenu: 'bbb' }]);
  const e2 = empreinte([{ nom: 'b.css', contenu: 'bbb' }, { nom: 'a.js', contenu: 'aaa' }]);
  t('empreinte : indépendante de l\'ordre des entrées', e1, e2);

  const e3 = empreinte([{ nom: 'a.js', contenu: 'aaa' }, { nom: 'b.css', contenu: 'bbc' }]);
  t('empreinte : change si un seul octet change', e1 === e3, false);

  // Même taille, contenu différent : un hachage sur la seule taille les
  // confondrait, celui-ci ne doit pas.
  const e4 = empreinte([{ nom: 'a.js', contenu: 'aaa' }, { nom: 'b.css', contenu: 'aab' }]);
  t('empreinte : deux fichiers de même taille mais de contenu différent divergent', e1 === e4, false);

  const e5 = empreinte([{ nom: 'a.js', contenu: 'aaa' }, { nom: 'b.css', contenu: 'bbb' }]);
  t('empreinte : stable à contenu identique', e1, e5);
}

{
  const source = [
    "const OBLIGATOIRES = /* injecté au build */ ['./', './index.html', './manifest.webmanifest'];",
    "const FACULTATIFS = /* injecté au build */ [];",
    "const CACHE_VERSION = /* injecté au build */ 'dev';",
    "const CACHE_NAME = `aba-cadre-${CACHE_VERSION}`;",
  ].join('\n');
  const injecte = injecterPrecache(source, {
    obligatoires: ['./', './index.html', './assets/x.js'],
    facultatifs: ['./icon.png'],
    version: 'vTEST123',
  });
  t('injecterPrecache : remplace OBLIGATOIRES',
    injecte.includes('const OBLIGATOIRES = ["./","./index.html","./assets/x.js"];'), true);
  t('injecterPrecache : remplace FACULTATIFS',
    injecte.includes('const FACULTATIFS = ["./icon.png"];'), true);
  t('injecterPrecache : remplace CACHE_VERSION',
    injecte.includes('const CACHE_VERSION = "vTEST123";'), true);
  t('injecterPrecache : laisse le reste intact',
    injecte.includes('const CACHE_NAME = `aba-cadre-${CACHE_VERSION}`;'), true);
}

/* ==================== public/sw.js, en environnement simulé ==================== */

const sourceSW = readFileSync(join(ici, '..', 'public', 'sw.js'), 'utf8');

class FauxeReponse {
  constructor(corps, { status = 200, type = 'basic', url = '' } = {}) {
    this.status = status;
    this.type = type;
    this.url = url;
    this._corps = corps;
  }
  clone() { return new FauxeReponse(this._corps, { status: this.status, type: this.type, url: this.url }); }
  static error() { return new FauxeReponse(null, { status: 0, type: 'error' }); }
}

function cle(requeteOuUrl) {
  return typeof requeteOuUrl === 'string' ? requeteOuUrl : requeteOuUrl.url;
}

/* `reseau: false` simule une coupure complète : toute requête réseau
   rejette, comme un vrai fetch() sans connexion. `manquants` simule des
   fichiers absents du serveur (404) alors que le réseau répond. */
function creerEnvironnement({ reseau = true, manquants = [] } = {}) {
  const journal = [];
  const magasins = new Map(); // nom de cache -> Map(url -> réponse)

  function reseauFetch(requeteOuUrl) {
    const url = cle(requeteOuUrl);
    if (!reseau) return Promise.reject(new TypeError('réseau indisponible'));
    if (manquants.includes(url)) return Promise.resolve(new FauxeReponse('404', { status: 404, url }));
    return Promise.resolve(new FauxeReponse('ok', { status: 200, url }));
  }

  function fabriquerCache(nom) {
    const store = magasins.get(nom);
    return {
      async addAll(urls) {
        journal.push('addAll:debut');
        for (const url of urls) {
          const r = await reseauFetch(url);
          if (!r || r.status !== 200) { journal.push(`addAll:echec:${url}`); throw new Error(`échec précache : ${url}`); }
          store.set(url, r);
        }
        journal.push('addAll:fin');
      },
      async add(url) {
        const r = await reseauFetch(url);
        if (!r || r.status !== 200) throw new Error(`échec précache : ${url}`);
        store.set(url, r);
      },
      async match(requeteOuUrl) { return store.get(cle(requeteOuUrl)); },
      async put(requeteOuUrl, reponse) { store.set(cle(requeteOuUrl), reponse); },
    };
  }

  const cachesFaux = {
    async open(nom) {
      if (!magasins.has(nom)) magasins.set(nom, new Map());
      return fabriquerCache(nom);
    },
    async keys() { return [...magasins.keys()]; },
    async delete(nom) { return magasins.delete(nom); },
    async match(requeteOuUrl) {
      for (const store of magasins.values()) {
        const r = store.get(cle(requeteOuUrl));
        if (r) return r;
      }
      return undefined;
    },
  };

  const handlers = {};
  const selfFaux = {
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    skipWaiting() { journal.push('skipWaiting'); selfFaux._skipWaitingAppele = true; },
    clients: { async claim() { journal.push('clientsClaim'); selfFaux._clientsClaimed = true; } },
  };

  return {
    self: selfFaux, caches: cachesFaux, fetch: reseauFetch, Response: FauxeReponse,
    journal, handlers, magasins,
    // Pré-remplit un cache pour tester activate()/fetch() sans passer par install().
    seed(nom, entrees) {
      const store = new Map();
      for (const [url, reponse] of Object.entries(entrees)) store.set(url, reponse ?? new FauxeReponse('ok', { status: 200, url }));
      magasins.set(nom, store);
    },
  };
}

function charger(env, { obligatoires, facultatifs, version }) {
  const source = injecterPrecache(sourceSW, { obligatoires, facultatifs, version });
  const fabrique = new Function('self', 'caches', 'fetch', 'Response', source);
  fabrique(env.self, env.caches, env.fetch, env.Response);
}

async function declencher(env, type, payload) {
  const [gestionnaire] = env.handlers[type] || [];
  if (!gestionnaire) throw new Error(`aucun gestionnaire enregistré pour ${type}`);
  const attentes = [];
  const evenement = {
    ...payload,
    waitUntil(p) { attentes.push(p); },
  };
  const resultat = gestionnaire(evenement);
  await resultat;
  await Promise.all(attentes);
  return evenement;
}

/* --- Installation --- */

{
  const env = creerEnvironnement({ reseau: true });
  charger(env, {
    obligatoires: ['./', './index.html', './manifest.webmanifest', './assets/a.js'],
    facultatifs: ['./icon.png'],
    version: 'vInstall1',
  });
  await declencher(env, 'install');
  const store = env.magasins.get('aba-cadre-vInstall1');
  t('install : tous les fichiers obligatoires et facultatifs sont en cache',
    [...store.keys()].sort(),
    ['./', './assets/a.js', './icon.png', './index.html', './manifest.webmanifest'].sort());
  t('install : le facultatif présent est en cache aussi', store.has('./icon.png'), true);
  t('install : skipWaiting appelé après le précache, pas avant',
    env.journal.indexOf('skipWaiting') > env.journal.indexOf('addAll:fin'), true);
}

{
  // La régression exacte : dans l'ancien code, skipWaiting() était le tout
  // premier appel du handler install, avant même cache.open(). Ici on vérifie
  // l'ordre explicitement plutôt que seulement le résultat final.
  const env = creerEnvironnement({ reseau: true });
  charger(env, { obligatoires: ['./', './index.html'], facultatifs: [], version: 'vOrdre' });
  await declencher(env, 'install');
  t('install : le journal ne contient pas skipWaiting avant addAll:debut',
    env.journal[0] === 'addAll:debut', true);
}

{
  const env = creerEnvironnement({ reseau: true, manquants: ['./assets/manquant.js'] });
  charger(env, {
    obligatoires: ['./', './assets/manquant.js'],
    facultatifs: [],
    version: 'vEchecObligatoire',
  });
  let echoue = false;
  try { await declencher(env, 'install'); } catch (e) { echoue = true; }
  t('install : un obligatoire manquant fait échouer l\'installation', echoue, true);
  t('install : skipWaiting jamais appelé si l\'installation échoue',
    env.journal.includes('skipWaiting'), false);
}

{
  const env = creerEnvironnement({ reseau: true, manquants: ['./icon-manquant.png'] });
  charger(env, {
    obligatoires: ['./', './index.html'],
    facultatifs: ['./icon-manquant.png'],
    version: 'vFacultatifManquant',
  });
  let echoue = false;
  try { await declencher(env, 'install'); } catch (e) { echoue = true; }
  t('install : un facultatif manquant n\'empêche pas l\'installation', echoue, false);
  t('install : skipWaiting appelé malgré le facultatif manquant',
    env.journal.includes('skipWaiting'), true);
}

/* --- Activation --- */

{
  const env = creerEnvironnement();
  charger(env, { obligatoires: ['./', './index.html'], facultatifs: [], version: 'vNeuf' });
  env.seed('aba-cadre-vAncien', { './': null, './index.html': null });
  env.seed('aba-cadre-vNeuf', { './': null, './index.html': null }); // complet
  await declencher(env, 'activate');
  t('activate : purge les anciens caches quand le nouveau est complet',
    (await env.caches.keys()).sort(), ['aba-cadre-vNeuf']);
  t('activate : clients.claim() appelé', env.self._clientsClaimed, true);
}

{
  const env = creerEnvironnement();
  charger(env, { obligatoires: ['./', './index.html', './assets/a.js'], facultatifs: [], version: 'vIncomplet' });
  env.seed('aba-cadre-vAncien', { './': null, './index.html': null, './assets/a.js': null });
  env.seed('aba-cadre-vIncomplet', { './': null }); // il manque index.html et assets/a.js
  await declencher(env, 'activate');
  t('activate : ne purge rien si le nouveau cache est incomplet',
    (await env.caches.keys()).sort(), ['aba-cadre-vAncien', 'aba-cadre-vIncomplet'].sort());
}

/* --- Fetch, hors ligne --- */

{
  const env = creerEnvironnement({ reseau: false });
  charger(env, { obligatoires: ['./', './index.html'], facultatifs: [], version: 'vNavigate' });
  env.seed('aba-cadre-vNavigate', {
    './index.html': new FauxeReponse('<html>coquille</html>', { status: 200, url: './index.html' }),
  });
  let capture;
  const [gestionnaire] = env.handlers.fetch;
  const evenement = {
    request: { url: 'https://exemple.test/', method: 'GET', mode: 'navigate' },
    respondWith(p) { capture = p; },
    waitUntil() {},
  };
  gestionnaire(evenement);
  const reponse = await capture;
  t('fetch navigate hors ligne : rend index.html depuis le cache', reponse && reponse._corps, '<html>coquille</html>');
}

{
  const env = creerEnvironnement({ reseau: false });
  charger(env, { obligatoires: ['./', './index.html', './assets/a.js'], facultatifs: [], version: 'vAsset' });
  env.seed('aba-cadre-vAsset', {
    './assets/a.js': new FauxeReponse('console.log(1)', { status: 200, url: './assets/a.js' }),
  });
  let capture;
  const [gestionnaire] = env.handlers.fetch;
  const evenement = {
    request: { url: './assets/a.js', method: 'GET', mode: 'no-cors' },
    respondWith(p) { capture = p; },
    waitUntil() {},
  };
  gestionnaire(evenement);
  const reponse = await capture;
  t('fetch asset hors ligne, en cache : rend la réponse mise en cache', reponse && reponse._corps, 'console.log(1)');
}

{
  const env = creerEnvironnement({ reseau: false });
  charger(env, { obligatoires: ['./', './index.html'], facultatifs: [], version: 'vAbsent' });
  env.seed('aba-cadre-vAbsent', {});
  let capture;
  const [gestionnaire] = env.handlers.fetch;
  const evenement = {
    request: { url: 'https://exemple.test/assets/inconnu.js', method: 'GET', mode: 'no-cors' },
    respondWith(p) { capture = p; },
    waitUntil() {},
  };
  gestionnaire(evenement);
  const reponse = await capture;
  t('fetch asset hors ligne, absent du cache : Response.error(), jamais undefined',
    reponse !== undefined && reponse.type === 'error', true);
}

/* --- Message « etat », lu par CarteHorsLigne (src/App.jsx) --- */

{
  const env = creerEnvironnement();
  charger(env, { obligatoires: ['./', './index.html', './assets/a.js'], facultatifs: [], version: 'vEtat' });
  env.seed('aba-cadre-vEtat', { './': null, './index.html': null }); // ./assets/a.js manque
  let recu;
  await declencher(env, 'message', {
    data: { type: 'etat' },
    ports: [{ postMessage(m) { recu = m; } }],
  });
  t('message etat : rend la version, le compte attendu et présent', recu, { version: 'vEtat', attendus: 3, presents: 2 });
}

console.log(`\n${ok} test(s) OK, ${ko} échec(s)`);
if (ko > 0) process.exit(1);
