#!/usr/bin/env node
/* Rejoue en navigateur réel le scénario qui échouait avant cette version :
   ouverture en ligne, coupure du réseau, rechargement — l'application
   doit s'ouvrir, polices comprises, sans qu'aucune requête ne parte vers
   Google Fonts. Pilote le Chromium déjà installé sur ce poste
   (playwright-core, PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers) : rien de
   manuel, rien laissé à vérifier « à l'œil » dans un vrai navigateur.

   `playwright-core` est installé à la volée (npm i --no-save) et n'entre
   pas dans package.json : ce script n'est pas destiné au déploiement, et le
   workflow qui lance `npm install` ne doit pas hériter d'un navigateur à
   télécharger. */

import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(fileURLToPath(import.meta.url), '..', '..');
const DIST = join(RACINE, 'dist');

const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

let ok = 0, ko = 0;
function t(nom, actuel, attendu) {
  const p = JSON.stringify(actuel) === JSON.stringify(attendu);
  console.log(`${p ? 'OK  ' : 'ECHEC'} ${nom}` + (p ? '' : ` → ${JSON.stringify(actuel)} au lieu de ${JSON.stringify(attendu)}`));
  p ? ok++ : ko++;
}

function servir(dist) {
  return createServer(async (req, res) => {
    try {
      let chemin = decodeURIComponent(req.url.split('?')[0]);
      if (chemin === '/') chemin = '/index.html';
      const fichier = join(dist, chemin);
      const donnees = await readFile(fichier);
      res.writeHead(200, { 'Content-Type': TYPES_MIME[extname(fichier)] || 'application/octet-stream' });
      res.end(donnees);
    } catch (e) {
      res.writeHead(404);
      res.end('introuvable');
    }
  });
}

function demarrerServeur(dist) {
  return new Promise((resolve) => {
    const serveur = servir(dist);
    serveur.listen(0, '127.0.0.1', () => resolve(serveur));
  });
}

async function attendreControleur(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Le premier chargement qui installe le service worker n'est jamais
  // « contrôlé » par lui (comportement standard) : un rechargement est
  // nécessaire — c'est justement l'ouverture en ligne unique qu'exige le
  // scénario.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 5000 });
}

async function main() {
  console.log('Construction (npm run build)…');
  execSync('npm run build', { cwd: RACINE, stdio: 'inherit' });

  const { chromium } = await import('playwright-core');
  const executablePath = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const navigateur = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

  try {
    const serveur = await demarrerServeur(DIST);
    const port = serveur.address().port;
    const base = `http://127.0.0.1:${port}/`;

    const contexte = await navigateur.newContext();
    const page = await contexte.newPage();
    const requetes = [];
    page.on('request', (r) => requetes.push(r.url()));

    // 1) Première ouverture, en ligne : installe le service worker.
    await page.goto(base, { waitUntil: 'load' });
    await attendreControleur(page);

    // 2) Rechargement en ligne (page maintenant contrôlée) : c'est
    //    « l'ouverture en ligne » que le README promet comme suffisante.
    requetes.length = 0;
    await page.reload({ waitUntil: 'load' });
    const versionInitiale = await page.evaluate(() => new Promise((resolve) => {
      const canal = new MessageChannel();
      canal.port1.onmessage = (e) => resolve(e.data);
      navigator.serviceWorker.controller.postMessage({ type: 'etat' }, [canal.port2]);
    }));
    t('service worker prêt après une seule ouverture en ligne',
      versionInitiale.attendus > 0 && versionInitiale.presents === versionInitiale.attendus, true);

    // 3) Coupure réseau, rechargement : le scénario qui échouait.
    await contexte.setOffline(true);
    requetes.length = 0;
    let echecNavigation = false;
    try {
      await page.reload({ waitUntil: 'load', timeout: 10000 });
    } catch (e) { echecNavigation = true; }
    t('la page se recharge sans réseau après une seule ouverture en ligne', echecNavigation, false);

    const navigationPresente = await page.evaluate(() => !!document.querySelector('body'));
    t('un contenu est bien rendu hors ligne', navigationPresente, true);

    const contenuVisible = await page.evaluate(() => document.body.innerText.length > 0);
    t('la page hors ligne n\'est pas un écran blanc', contenuVisible, true);

    const requetesPolices = requetes.filter((u) => u.includes('fonts.gstatic.com') || u.includes('fonts.googleapis.com'));
    t('aucune requête vers Google Fonts hors ligne', requetesPolices, []);

    const policesChargees = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => f.family.includes('Space Grotesk') || f.family.includes('IBM Plex'));
    });
    t('au moins une police embarquée est effectivement chargée', policesChargees, true);

    await contexte.setOffline(false);

    // 4) Régression : une nouvelle mise en ligne (fichier modifié, rebuild),
    //    une seule ouverture en ligne, puis coupure — doit fonctionner avec
    //    la NOUVELLE version, pas rester bloqué sur l'ancienne ni casser.
    //    public/manifest.webmanifest plutôt qu'un fichier source : il est
    //    copié tel quel par Vite (pas de minification qui pourrait, sur un
    //    simple commentaire, produire un bundle strictement identique).
    const marqueur = join(RACINE, 'public', 'manifest.webmanifest');
    const original = await readFile(marqueur, 'utf8');
    const modifie = JSON.stringify({ ...JSON.parse(original), _essai: String(Date.now()) }, null, 2);
    await writeFile(marqueur, modifie);
    try {
      console.log('\nReconstruction après modification (régression)…');
      execSync('npm run build', { cwd: RACINE, stdio: 'inherit' });
    } finally {
      await writeFile(marqueur, original);
    }

    // Toujours en ligne : provoque explicitement la vérification de mise à
    // jour (registration.update()) plutôt que de compter sur la vérification
    // automatique à la navigation, que Chromium throttle. self.skipWaiting()
    // et self.clients.claim() (public/sw.js) font le reste sans rechargement :
    // c'est le même mécanisme qui, mal ordonné, causait la régression.
    await page.evaluate(() => new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      navigator.serviceWorker.getRegistration().then((r) => r && r.update());
      setTimeout(resolve, 4000);
    }));
    const versionApresMaj = await page.evaluate(() => new Promise((resolve) => {
      const canal = new MessageChannel();
      canal.port1.onmessage = (e) => resolve(e.data);
      navigator.serviceWorker.controller.postMessage({ type: 'etat' }, [canal.port2]);
    }));
    t('la nouvelle version diffère de la précédente', versionApresMaj.version !== versionInitiale.version, true);

    await contexte.setOffline(true);
    let echecApresMaj = false;
    try { await page.reload({ waitUntil: 'load', timeout: 10000 }); } catch (e) { echecApresMaj = true; }
    t('hors ligne juste après une mise en ligne (une seule ouverture en ligne)', echecApresMaj, false);
    const contenuApresMaj = await page.evaluate(() => document.body.innerText.length > 0);
    t('la page reste utilisable hors ligne après une mise à jour', contenuApresMaj, true);

    await contexte.close();
    serveur.close();
  } finally {
    await navigateur.close();
  }

  console.log(`\n${ok} vérification(s) OK, ${ko} échec(s)`);
  if (ko > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
