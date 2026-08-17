import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, CalendarDays, Users, FileText, Settings,
  Lock, Download, Upload, TrendingUp, AlertTriangle, Target, Trash2,
  Radar as RadarIcon, Activity, Table2, Printer, X, Check, Grid3x3, Layers, Sun, Moon,
  ChevronLeft, ChevronRight, ChevronDown, Minimize2, Maximize2, Palette,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, Bar, Area, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid, Legend,
} from 'recharts';

/* ==================== Identité visuelle ====================
   Tokens de src/index.css : ils changent avec le thème choisi (attribut
   data-theme sur <html>, posé avant le premier rendu par le script de
   index.html). Reprise de DatABA, bleu en accent — c'est ce qui distingue
   les deux applications au premier coup d'œil, à la place que jouait le
   bleu dans l'ancienne palette beige de Manager. */
const PAPER = 'var(--paper)';
const CARD = 'var(--card)';
const INK = 'var(--ink)';
const INK_SOFT = 'var(--ink-soft)';
const BORDER = 'var(--border)';
const ACCENT = 'var(--accent)';
const ACCENT_INK = 'var(--accent-ink)';
const ACCENT_WASH = 'var(--accent-wash)';
/* Fond de la navigation latérale : un cran plus sombre que la page, pour
   qu'elle se détache sans devenir un bloc noir sur tout un bord d'écran. */
const NAV_BG = 'var(--nav-bg)';
/* Voile derrière la palette de commande : noir fixe, indépendant du thème —
   même convention que côté DatABA. */
const OVERLAY_BACKDROP = 'var(--overlay-backdrop)';
/* Alerte : crises, mais aussi erreurs et actions destructrices — un seul
   token d'alerte réactif au thème, plutôt qu'un rouge générique figé. Même
   convention que CRISIS côté DatABA. */
const CRISE = 'var(--crisis)';
const F_DISPLAY = "'Space Grotesk', sans-serif";
const F_BODY = "'IBM Plex Sans', sans-serif";
const F_MONO = "'IBM Plex Mono', monospace";
/* Le document imprimé (rapport, bilan de crise) s'écarte volontairement de la
   typographie d'écran : un document transmis à l'extérieur (Airmes) se lit
   dans un registre institutionnel, pas dans celui d'un produit. Cambria/
   Georgia plutôt que Calibri : présentes sur tous les postes (Windows, macOS,
   Linux) sans police à charger, alors que Calibri n'existe nativement que
   sous Windows/Office — un repli sur Carlito y aurait rendu différemment
   selon le poste qui imprime. Passe par --font-doc (src/index.css) : une
   seule source, au cas où une règle d'impression en ait besoin. Voir
   DESIGN.md. */
const F_DOC = 'var(--font-doc)';

/* ==================== Palette catégorielle ====================
   Fixe entre les deux thèmes — elle code de l'information, pas une
   ambiance — choisie pour rester lisible sur clair comme sur sombre.
   Identique à celle de DatABA (src/App.jsx L17-50). Jamais l'accent : Règle
   de l'Accent Seul. */
const CAT_TEAL = '#00A870';
const CAT_INDIGO = '#3B5BDB';
const CAT_AMBER = '#FF8A3D';
const CAT_CORAL = '#FF4D6D';
const CAT_VIOLET = '#7C5CFF';
const CAT_CYAN = '#00B8D9';
const CAT_LILAC = '#A78BFA';
const CAT_SLATE = '#64748B';

/* Contraste garanti sur un fond de couleur fixe (catégorielle), calculé par
   luminance relative plutôt que supposé blanc — un badge ambre ou lilas ne
   se lit pas de la même façon qu'un badge indigo. Porté de texteLisibleSur
   côté DatABA (src/App.jsx:57). Ne s'applique qu'à un hex réel : jamais à un
   token `var(--…)`, dont le contraste est déjà résolu par sa propre paire
   (ex. ACCENT / ACCENT_INK). */
function texteLisibleSur(hex) {
  const c = String(hex).replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrasteBlanc = 1.05 / (L + 0.05);
  const contrasteNoir = (L + 0.05) / 0.05;
  return contrasteBlanc >= contrasteNoir ? '#fff' : '#000';
}

/* Réutilisées pour les comparaisons de performance générales (tendances,
   seuils 60/80 %) en plus des états d'acquisition eux-mêmes : bon/moyen/
   mauvais partagent la teinte du badge d'état correspondant. */
const ACQUIS = CAT_TEAL;
const EN_COURS = CAT_AMBER;
const NON_ACQUIS = CAT_CORAL;

/* Correspondance état → palette catégorielle proposée par le dossier de
   passation : acquis/teal, en_cours/indigo, plateau/ambre, non_acquis/
   corail, dormant/ardoise, mesure/lilas. « bientôt acquis » n'a pas
   d'équivalent DatABA — cyan, proche du teal sans s'y confondre. */
const ETATS = {
  acquis: { label: 'Acquis', court: 'Acquis', color: CAT_TEAL },
  bientot: { label: 'Bientôt acquis', court: 'Bientôt', color: CAT_CYAN },
  plateau: { label: 'En plateau', court: 'Plateau', color: CAT_AMBER },
  en_cours: { label: "En cours d'acquisition", court: 'En cours', color: CAT_INDIGO },
  dormant: { label: 'Sans cotation récente', court: 'Dormant', color: CAT_SLATE },
  /* Suivi en mesure brute (occurrences, minutes, latence) : aucun seuil
     d'acquisition en pourcentage ne s'y applique. */
  mesure: { label: 'Suivi en mesure', court: 'Mesure', color: CAT_LILAC },
  non_acquis: { label: 'Non acquis', court: 'Non acquis', color: CAT_CORAL },
};
/* Sens d'une hausse par état, pour l'écart affiché entre deux périodes (voir
   Ecart) : plus d'acquis ou de bientôt-acquis est un progrès, plus de
   plateau, de dormant ou de non-acquis ne l'est pas. */
const ETAT_HAUSSE_FAVORABLE = {
  acquis: true, bientot: true, plateau: false, en_cours: true, dormant: false, mesure: true, non_acquis: false,
};
/* Le rapport transmis ne retient que trois états : les nuances de travail
   interne n'ont pas leur place dans un document officiel. */
const ETAT_RAPPORT = {
  acquis: 'Acquis',
  bientot: "En cours d'acquisition",
  plateau: "En cours d'acquisition",
  en_cours: "En cours d'acquisition",
  dormant: "En cours d'acquisition",
  /* Un relevé d'occurrences ou de durée ne se juge pas sur l'échelle
     Acquis / Non acquis : il se lit à son évolution, affichée juste à côté. */
  mesure: 'Suivi en mesure',
  non_acquis: 'Non acquis',
};

/* Intensité ressentie, telle que saisie dans DatABA — même convention
   traffic-light que ACQUIS/EN_COURS/NON_ACQUIS. */
const INTENSITES = {
  1: { label: 'Légère', color: CAT_TEAL },
  2: { label: 'Modérée', color: CAT_AMBER },
  3: { label: 'Forte', color: CAT_CORAL },
};

const PLATEAU_MIN_POINTS = 6;
const PLATEAU_ECART_MAX = 20;
const DORMANT_JOURS = 21;

/* Verrouillage automatique : 15 minutes d'inactivité OU d'absence de
   l'onglet. Une simple perte de focus (bascule vers un autre onglet,
   consultation d'un mail) ne verrouille plus tout de suite — c'était le
   comportement hérité de la mise en veille des tablettes, inadapté à un
   poste de bureau où changer d'onglet est un geste courant. */
const DELAI_VERROUILLAGE = 15 * 60 * 1000;

/* Décide si le retour sur l'onglet doit verrouiller la session, selon la
   durée de l'absence. Fonction pure, testée hors du composant : c'est elle
   qui porte la règle, pas le useEffect qui l'appelle. */
function doitVerrouillerAuRetour(partiA, maintenant, delai) {
  return partiA != null && (maintenant - partiA) >= delai;
}

/* ==================== Chiffrement ====================
   Fonctions identiques à celles de DatABA : même dérivation de clé, même
   schéma, pour lire ses fichiers sans rien adapter côté éducateur. */
function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}
function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
async function deriveAesKey(passphrase, salt, usages) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, usages);
}
async function decryptEnvelope(envelope, passphrase) {
  const key = await deriveAesKey(passphrase, fromB64(envelope.salt), ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function encryptJSON(obj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { format: 'aba-backup-encrypted', version: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) };
}
async function hashPin(pin, saltB64) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromB64(saltB64), iterations: 150000, hash: 'SHA-256' }, km, 256);
  return toB64(bits);
}
function newSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}
let dataKey = null;
async function deriveDataKey(pin, saltB64) {
  return deriveAesKey(pin, fromB64(saltB64), ['encrypt', 'decrypt']);
}
async function encryptValue(texte, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(texte));
  return JSON.stringify({ __enc: 1, iv: toB64(iv), data: toB64(ct) });
}
async function decryptValue(raw, key) {
  let env = null;
  try { env = JSON.parse(raw); } catch (e) { return raw; }
  if (!env || env.__enc !== 1) return raw;
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.iv) }, key, fromB64(env.data));
  return new TextDecoder().decode(plain);
}
function lockDelayMs(failed) {
  if (failed < 3) return 0;
  if (failed < 5) return 30 * 1000;
  if (failed < 8) return 5 * 60 * 1000;
  return 15 * 60 * 1000;
}

/* ==================== Stockage ====================
   Les deux applications DatABA sont publiées sous la même adresse et
   partagent le même espace : chaque effacement se limite à son préfixe. */
const PREFIXE = 'aba-cadre:';
const STORE_KEY = `${PREFIXE}data`;
const SECU_KEY = `${PREFIXE}securite`;

const VIDE = {
  personnes: [], seances: [], crises: [], stabilite: [], sources: [],
  /* Classes (ex-Groupes côté DatABA) : liste plate dédupliquée par id, comme
     les personnes et les sources — une classe ne dépend pas de la tablette
     qui l'a exportée. */
  classes: [],
  /* Relevés de suivi continu au format v4 (multi-axes). `stabilite` reste le
     format v3 (axe unique, `etat`), alimenté par les tablettes pas encore
     mises à jour — jamais les deux pour le même import, voir
     fusionnerImport. Les axes sont stockés par source : deux tablettes
     peuvent avoir des critères différents pour le même identifiant d'axe. */
  suivi: [], _axesSuivi: {},
  /* Compteurs d'occurrence, table de noms indexée par source comme `_ateliers`
     et `_intervenants`. Côté DatABA ils sont définis sur la personne
     (`students[].compteurs`) et leurs appuis voyagent dans `suivi`, mêlés aux
     relevés d'état — voir `compteursDePersonne` pour ce qui les sépare. */
  _compteurs: {},
  /* Jeu de guidances de l'établissement, par source. DatABA l'exporte
     (`backup.guidances`) et s'en sert de repli quand un objectif ne porte pas
     son propre `config.guidanceSet` : c'est lui qui dit quel code vaut
     « indépendant ». Sans lui, Manager retombait en dur sur le code 'I' et
     rendait donc un autre pourcentage que la tablette dès qu'un établissement
     avait renommé ce code ou en avait marqué un second. */
  _guidances: {},
  _idVersInitiales: {}, _ateliers: {}, _intervenants: {}, alias: { personnes: {}, objectifs: {} }, commentaires: {},
  /* Code de curriculum attaché à l'objectif lui-même, et non au couple
     personne-objectif : une même compétence garde son code quelle que soit la
     personne qui la travaille. La clé est donc le nom de l'objectif.
     `codesEfl` reste le nom de la clé (voyage à l'export, dans les rapports
     enregistrés, dans l'import inter-Manager) même si l'interface ne dit plus
     « EFL » — un renommage de clé casserait la lecture d'un fichier échangé
     avec un Manager pas encore mis à jour, pour zéro différence à l'écran. */
  codesEfl: {},
  /* Rapports enregistrés : uniquement leur composition — personne, période,
     objectifs retenus, réglages du bilan de crise. Les commentaires et les
     libellés vivent déjà à part et suivent d'eux-mêmes, si bien qu'un rapport
     rouvert reflète les cotations les plus récentes plutôt qu'un figé. */
  rapports: [],
  /* Critères de suivi continu et compteurs promus en objectif. DatABA ne sait
     pas dire qu'un axe ou un compteur sert à coter un objectif — un axe n'a
     que ses critères, un compteur que son nom, aucun seuil d'acquisition — et
     pourtant ces deux modes cotent bien des objectifs réels (les demandes
     spontanées au compteur, l'estompage de l'éducateur au suivi). Le choix se
     fait donc ici, par personne, et il est persisté avec les données.

     Clé : `<initiales>|critere:<nomAxe>||<cle>` ou `<initiales>|compteur:<id>`,
     le même espace de clés que les séries du graphique.
     Valeur : { actif, unite, seuil, jours, sens }. `seuil` à null = aucun
     critère d'acquisition, l'objectif reste « Suivi en mesure ». */
  objectifsSuivi: {},
};

function normaliser(d) {
  return {
    ...VIDE,
    ...d,
    alias: { personnes: {}, objectifs: {}, ...(d.alias || {}) },
    stabilite: d.stabilite || [],
    suivi: d.suivi || [],
    _axesSuivi: d._axesSuivi || {},
    _compteurs: d._compteurs || {},
    _guidances: d._guidances || {},
    classes: d.classes || [],
    commentaires: d.commentaires || {},
    codesEfl: d.codesEfl || {},
    rapports: d.rapports || [],
    objectifsSuivi: d.objectifsSuivi || {},
  };
}
/* --- Où vit le bloc consolidé ---
   IndexedDB d'abord, `localStorage` en repli. Le bloc a longtemps vécu dans
   `localStorage` seul, et c'est ce qui a fait perdre des imports entiers :
   son quota est de l'ordre de 5 Mo *par origine*, compté en UTF-16, et le
   bloc chiffré est du base64 (≈ 1,33× le JSON). Quelques centaines de
   séances et les relevés de suivi continu de plusieurs tablettes le
   dépassent. `setItem` lève alors QuotaExceededError — que l'ancien code
   avalait en silence : l'import s'affichait, la session entière
   fonctionnait, et rien n'avait jamais été écrit. Au relancement, tout
   était vide.

   IndexedDB n'a pas ce plafond (part du disque, plusieurs centaines de Mo au
   minimum). Il n'est pas non plus à l'abri d'un poste réglé pour effacer les
   données de site à la fermeture : `demanderStockagePersistant` demande au
   navigateur de ne pas évincer, et l'écran Gestion affiche ce qu'il a
   répondu.

   Le doublon `localStorage` est retiré dès la première écriture IndexedDB
   réussie : deux copies, c'est une copie périmée qui ressuscite le jour où
   la bonne disparaît. */
const IDB_BASE = 'aba-cadre';
const IDB_TABLE = 'bloc';
const IDB_CLE = 'data';

let basePromesse = null;
function ouvrirBase() {
  if (basePromesse) return basePromesse;
  basePromesse = new Promise((resolve) => {
    try {
      if (!window.indexedDB) { resolve(null); return; }
      const req = window.indexedDB.open(IDB_BASE, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_TABLE)) db.createObjectStore(IDB_TABLE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) { resolve(null); /* navigation privée sur certains navigateurs */ }
  });
  return basePromesse;
}
/* `null` = aucun bloc stocké, `undefined` = IndexedDB indisponible.
   Les deux se distinguent : le premier est un premier lancement, le second
   impose le repli sur localStorage. */
async function lireIDB() {
  const db = await ouvrirBase();
  if (!db) return undefined;
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(IDB_TABLE, 'readonly');
      const req = tx.objectStore(IDB_TABLE).get(IDB_CLE);
      req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
      req.onerror = () => reject(req.error || new Error('lecture IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('lecture IndexedDB interrompue'));
    } catch (e) { reject(e); }
  });
}
/* La réussite se lit sur `oncomplete` de la transaction, pas sur le
   `onsuccess` de la requête : un dépassement de quota laisse la requête
   réussir puis avorte la transaction. Attendre la requête seule
   rapporterait une écriture qui n'a jamais été validée. */
async function ecrireIDB(valeur) {
  const db = await ouvrirBase();
  if (!db) throw new Error('IndexedDB indisponible');
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(IDB_TABLE, 'readwrite');
      tx.objectStore(IDB_TABLE).put(valeur, IDB_CLE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('écriture IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('écriture IndexedDB interrompue'));
    } catch (e) { reject(e); }
  });
}
async function effacerIDB() {
  const db = await ouvrirBase();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_TABLE, 'readwrite');
      tx.objectStore(IDB_TABLE).delete(IDB_CLE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch (e) { resolve(); }
  });
}
function estQuota(e) {
  if (!e) return false;
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || e.code === 22 || e.code === 1014;
}
/* Demandée une fois au démarrage. Un refus n'est pas une panne : le
   navigateur garde les données mais se réserve de les évincer sous pression
   disque. C'est dit dans Gestion plutôt que deviné. */
async function demanderStockagePersistant() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) { return null; }
}

/* Résultat d'une lecture. `etat` vaut :
   - 'ok'        : bloc lu et déchiffré ;
   - 'vide'      : rien de stocké (premier lancement, ou tout effacé) ;
   - 'illisible' : un bloc existe mais n'a pas pu être lu — déchiffrement,
                   JSON, ou stockage en erreur.
   Le troisième cas ne rendait autrefois qu'un `VIDE` indiscernable du
   deuxième, et l'effet d'enregistrement écrasait aussitôt le bloc encore
   intact par cet état vide : une lecture ratée détruisait les données.
   L'appelant doit suspendre toute écriture sur 'illisible'. */
async function chargerDonnees() {
  let brut;
  let ou = null;
  /* Une lecture IndexedDB en panne n'interrompt pas la recherche : le bloc
     des versions précédentes vit dans localStorage, et il n'y a jamais deux
     copies — celle de localStorage est retirée dès la première écriture
     IndexedDB réussie. Chercher plus loin ne peut donc pas rendre une
     version périmée. La panne n'est retenue que si rien n'est trouvé
     ensuite : dire « vide » alors qu'IndexedDB n'a pas répondu ferait
     écraser un bloc peut-être intact. */
  let panne = null;
  try {
    brut = await lireIDB();
    if (brut != null) ou = 'indexeddb';
  } catch (e) {
    panne = 'indexeddb';
  }
  if (brut == null) {
    /* Repli et migration : la première écriture déplacera ce bloc dans
       IndexedDB. */
    try {
      brut = window.localStorage.getItem(STORE_KEY);
      if (brut != null) ou = 'localstorage';
    } catch (e) {
      panne = panne || 'localstorage';
    }
  }
  if (brut == null) {
    if (panne) return { donnees: VIDE, etat: 'illisible', ou: panne, raison: 'lecture' };
    return { donnees: VIDE, etat: 'vide', ou: null };
  }
  try {
    const texte = dataKey ? await decryptValue(brut, dataKey) : brut;
    return { donnees: normaliser(JSON.parse(texte)), etat: 'ok', ou, taille: brut.length };
  } catch (e) {
    return { donnees: VIDE, etat: 'illisible', ou, raison: 'dechiffrement', taille: brut.length };
  }
}

/* Les écritures sont sérialisées : deux `setDonnees` rapprochés lancent deux
   chiffrements de durées différentes, et sans file la plus lente pouvait
   valider après la plus récente et remettre l'état précédent. */
let chaineEcriture = Promise.resolve();
function sauverDonnees(d) {
  const suite = chaineEcriture.then(() => ecrireBloc(d), () => ecrireBloc(d));
  chaineEcriture = suite.catch(() => {});
  return suite;
}
/* Toute écriture est relue avant d'être annoncée réussie. `setItem` qui ne
   lève pas ne prouve pas que la donnée est là : un stockage en lecture seule
   ou une session éphémère l'acceptent puis ne la rendent pas. */
async function ecrireBloc(d) {
  let charge;
  try {
    const texte = JSON.stringify(d);
    charge = dataKey ? await encryptValue(texte, dataKey) : texte;
  } catch (e) {
    return { ok: false, raison: 'chiffrement', quand: Date.now() };
  }
  try {
    await ecrireIDB(charge);
    if (await lireIDB() === charge) {
      try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* rien à retirer */ }
      return { ok: true, ou: 'indexeddb', taille: charge.length, quand: Date.now() };
    }
  } catch (e) { /* repli sur localStorage, avec son plafond */ }
  try {
    window.localStorage.setItem(STORE_KEY, charge);
    if (window.localStorage.getItem(STORE_KEY) === charge) {
      return { ok: true, ou: 'localstorage', taille: charge.length, quand: Date.now() };
    }
    return { ok: false, raison: 'relecture', taille: charge.length, quand: Date.now() };
  } catch (e) {
    return { ok: false, raison: estQuota(e) ? 'quota' : 'stockage', taille: charge.length, quand: Date.now() };
  }
}

async function effacerDonneesManager() {
  try {
    const cles = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIXE)) cles.push(k);
    }
    cles.forEach((k) => window.localStorage.removeItem(k));
  } catch (e) { /* stockage indisponible */ }
  /* La base IndexedDB porte le même préfixe et n'appartient qu'à Manager :
     l'effacement s'y borne comme il se borne à `aba-cadre:` côté
     localStorage. Jamais de `deleteDatabase` sur autre chose. */
  await effacerIDB();
}

/* ==================== Import et fusion ==================== */
/* Classes (alias de compatibilité `groupes`, même contenu, émis par les
   tablettes pas encore mises à jour). Liste plate dédupliquée par id : une
   classe ne dépend pas de la tablette qui l'a exportée, et la retrouver
   d'une source à l'autre est ce qui permet de désambiguïser deux personnes
   aux mêmes initiales. `suite` (v3, sans stabilite/suivi v4) ne concerne
   pas ce lot mais suit le même principe de repli sur l'alias. */
function fusionnerClasses(actuelles, backup) {
  const brutes = backup.classes || backup.groupes || [];
  const parId = new Map(actuelles.map((c) => [c.id, c]));
  brutes.forEach((c) => {
    if (!c || !c.id) return;
    parId.set(c.id, { id: c.id, nom: c.name || c.nom || c.id });
  });
  return Array.from(parId.values());
}

/* Fusion d'une liste datée (séances, crises, relevés) par identifiant.

   Le fichier importé gagne : un identifiant déjà connu voit son enregistrement
   REMPLACÉ par la version entrante, à sa place dans la liste. C'est ce qui fait
   remonter une séance re-cotée, une crise dont la durée a été renseignée après
   coup, un relevé corrigé — avant, la version d'origine restait et l'import
   annonçait « 0 nouvelle », ce qui se lit comme « rien de neuf ».

   Contrepartie assumée : aucune date de version n'est comparée, donc réimporter
   un fichier PLUS ANCIEN que ce qui est déjà consolidé fait régresser les
   enregistrements concernés. La purge par source reste le recours.

   Les ajouts vont à la fin, les remplacements restent en place : l'historique
   ne se réordonne pas à chaque import. */
function fusionnerParId(actuels, entrants, transformer) {
  const liste = actuels.slice();
  const index = new Map(liste.map((x, i) => [x.id, i]));
  let nouveaux = 0;
  let majs = 0;
  (entrants || []).forEach((brut) => {
    if (!brut) return;
    const x = transformer ? transformer(brut) : brut;
    const i = index.get(x.id);
    if (i === undefined) {
      index.set(x.id, liste.length);
      liste.push(x);
      nouveaux += 1;
    } else {
      /* Un enregistrement identique n'est pas une mise à jour : le dire
         gonflerait le compte à chaque réimport du même fichier. */
      if (JSON.stringify(liste[i]) !== JSON.stringify(x)) majs += 1;
      liste[i] = x;
    }
  });
  return { liste, nouveaux, majs };
}

function fusionnerImport(actuel, backup, nomSource) {
  const personnes = actuel.personnes.slice();
  const parInitiales = new Map(personnes.map((p) => [p.initials, p]));
  /* Deux personnes de classes différentes peuvent porter les mêmes
     initiales : la déduplication par initiales les fusionnerait en une
     seule. La classe permet de le détecter — pas encore de le résoudre
     (ça suppose de changer la clé d'identité des personnes dans toute
     l'application) — donc on compte les collisions et on les signale à
     l'import plutôt que de les laisser passer en silence. */
  let collisionsInitiales = 0;
  (backup.students || []).forEach((s) => {
    const classeId = s.classeId || s.groupeId || null;
    const existante = parInitiales.get(s.initials);
    if (!existante) {
      const p = { id: s.id, initials: s.initials, classeId };
      personnes.push(p);
      parInitiales.set(s.initials, p);
    } else {
      if (existante.classeId == null && classeId != null) existante.classeId = classeId;
      else if (classeId != null && existante.classeId != null && existante.classeId !== classeId) collisionsInitiales += 1;
    }
  });

  const classes = fusionnerClasses(actuel.classes || [], backup);
  const idVersInitiales = Object.fromEntries((backup.students || []).map((s) => [s.id, s.initials]));
  const ateliersSource = Object.fromEntries((backup.ateliers || []).map((a) => [a.id, a.name]));
  const intervenantsSource = Object.fromEntries((backup.intervenants || []).map((i) => [i.id, i.name]));
  /* Compteurs d'occurrence, deux origines. `backup.compteurs` est le tableau
     plat que reconstruit l'import inter-Manager ; `students[].compteurs` est
     la forme native de DatABA, qui prime quand les deux sont là. Un compteur
     naît sans nom côté DatABA (champ vide à placeholder) : on fige ici le même
     repli que lui, pour ne pas afficher une ligne muette. Un identifiant absent
     de cette table se lira « Compteur retiré » — les deux cas restent
     distincts, ce qu'un repli unique ne permettrait pas. */
  const compteursSource = {
    ...Object.fromEntries((backup.compteurs || []).map((c) => [c.id, c.nom])),
    ...Object.fromEntries((backup.students || []).flatMap((s) => (s.compteurs || [])
      .map((c) => [c.id, (c.nom || '').trim() || 'Compteur sans nom']))),
  };

  /* Guidances de l'établissement. Fusionnées par code plutôt que remplacées :
     un export ultérieur qui aurait perdu un code ne doit pas rendre muettes
     les cotations passées qui s'en servent. Le fichier entrant gagne sur un
     code déjà connu — c'est lui qui porte le drapeau `independent` à jour. */
  const axesSource = (() => {
    const parId = new Map(((actuel._axesSuivi || {})[nomSource] || []).map((a) => [a.id, a]));
    (backup.axesSuivi || []).forEach((a) => { if (a && a.id) parId.set(a.id, a); });
    return Array.from(parId.values());
  })();

  const guidancesSource = (() => {
    const parCode = new Map(((actuel._guidances || {})[nomSource] || []).map((g) => [g.code, g]));
    (backup.guidances || []).forEach((g) => {
      if (!g || !g.code) return;
      parCode.set(g.code, { code: g.code, label: g.label || g.code, independent: !!g.independent });
    });
    return Array.from(parCode.values());
  })();

  const fusionSeances = fusionnerParId(actuel.seances, backup.sessions,
    (s) => ({ ...s, source: s.source || nomSource }));
  const seances = fusionSeances.liste;

  const fusionCrises = fusionnerParId(actuel.crises, backup.crises,
    (c) => ({ ...c, source: c.source || nomSource }));
  const crises = fusionCrises.liste;

  /* Relevés de suivi continu. Attention au champ `source` : côté DatABA il
     dit d'où vient le relevé (une pastille de suivi), ici il désigne la
     tablette d'origine, comme pour les séances et les crises. On le renomme
     donc en `origine` à l'entrée, sinon l'attribution par tablette serait
     écrasée par la valeur du relevé et le croisement avec les ateliers
     viserait la mauvaise source.

     Un fichier v4 porte les mêmes relevés dans `suivi` (multi-axes) et dans
     `stabilite` (alias v3, projection appauvrie). Les additionner les
     dupliquerait : on lit `suivi` s'il est présent — même vide, c'est le
     signe d'une tablette à jour — et on ne retombe sur `stabilite` que s'il
     est absent. */
  const actuelleStabilite = actuel.stabilite || [];
  const actuelSuivi = actuel.suivi || [];
  let stabilite = actuelleStabilite;
  let suivi = actuelSuivi;
  let nbNouveauxReleves;
  let nbRelevesMisAJour;
  const renommerSource = (r) => ({ ...r, origine: r.origine || r.source || null, source: nomSource });
  if (Array.isArray(backup.suivi)) {
    const f = fusionnerParId(actuelSuivi, backup.suivi, renommerSource);
    suivi = f.liste;
    nbNouveauxReleves = f.nouveaux;
    nbRelevesMisAJour = f.majs;
  } else {
    const f = fusionnerParId(actuelleStabilite, backup.stabilite, renommerSource);
    stabilite = f.liste;
    nbNouveauxReleves = f.nouveaux;
    nbRelevesMisAJour = f.majs;
  }

  return {
    ...actuel,
    personnes,
    classes,
    seances,
    crises,
    stabilite,
    suivi,
    sources: actuel.sources.includes(nomSource) ? actuel.sources : [...actuel.sources, nomSource],
    /* Les tables indexées par source se complètent, elles ne se remplacent
       pas. Un fichier partiel — des relevés de suivi sans `students`, par
       exemple — portait sinon une table vide qui écrasait celle de la
       tablette déjà importée : plus aucune cotation, plus aucun relevé
       rattaché à personne, sans le moindre message, alors que les données
       restaient bien en mémoire. `_axesSuivi` avait déjà son repli, les trois
       autres l'ont maintenant. */
    _idVersInitiales: { ...(actuel._idVersInitiales || {}), [nomSource]: { ...((actuel._idVersInitiales || {})[nomSource] || {}), ...idVersInitiales } },
    _ateliers: { ...(actuel._ateliers || {}), [nomSource]: { ...((actuel._ateliers || {})[nomSource] || {}), ...ateliersSource } },
    /* Fusionnés par id, comme les quatre autres tables par source. Le
       remplacement pur était le seul écart du lot : un second export de la
       même tablette dont un axe avait été retiré faisait basculer tous les
       relevés passés qui s'y rattachaient en « Suivi retiré », alors qu'ils
       restaient bien en base. Le fichier entrant gagne sur un axe déjà connu,
       c'est lui qui porte les critères à jour. */
    _axesSuivi: { ...(actuel._axesSuivi || {}), [nomSource]: axesSource },
    collisionsInitiales,
    _intervenants: { ...(actuel._intervenants || {}), [nomSource]: { ...((actuel._intervenants || {})[nomSource] || {}), ...intervenantsSource } },
    _compteurs: { ...(actuel._compteurs || {}), [nomSource]: { ...((actuel._compteurs || {})[nomSource] || {}), ...compteursSource } },
    _guidances: { ...(actuel._guidances || {}), [nomSource]: guidancesSource },
    nbNouvellesSeances: fusionSeances.nouveaux,
    nbNouvellesCrises: fusionCrises.nouveaux,
    nbNouveauxReleves,
    /* Mises à jour d'enregistrements déjà consolidés, comptées à part des
       ajouts : un réimport enrichi annonçait « 0 nouvelle », ce qui se lisait
       comme « rien de neuf » alors que le fichier portait des corrections. */
    nbSeancesMisesAJour: fusionSeances.majs,
    nbCrisesMisesAJour: fusionCrises.majs,
    nbRelevesMisAJour,
  };
}

function idPourSource(donnees, source, initiales) {
  const t = (donnees._idVersInitiales || {})[source] || {};
  return Object.keys(t).find((id) => t[id] === initiales) || null;
}

/* ==================== Calcul des scores ====================
   Auxiliaire interne de `valeurCotation`, et de personne d'autre : il ne sait
   calculer que les modes dont le score est un pourcentage DIRECT et rend null
   pour l'occurrence comme pour l'intervalle. L'appeler depuis un écran, c'est
   y faire disparaître ces deux modes — ce qui est arrivé à trois endroits à la
   fois. Le vérificateur interdit désormais tout appel hors de
   `valeurCotation`.

   `guidances` est le jeu de l'établissement (`_guidances`, par source) :
   DatABA s'en sert de repli quand un objectif ne porte pas son propre
   `config.guidanceSet`, et c'est lui qui dit quel code vaut « indépendant ».
   Sans lui, le repli en dur sur 'I' rendait un autre pourcentage que la
   tablette dès qu'un établissement avait renommé ce code ou en avait marqué un
   second. Le repli sur 'I' reste, en dernier recours seulement — c'est celui
   d'`isIndependentCode` côté DatABA. */
function objectiveScoreValue(obj, entry, guidances) {
  if (!obj || !entry) return null;
  const propre = (obj.config && obj.config.guidanceSet) || [];
  const gList = propre.length ? propre : (guidances || []);
  const indep = (code) => {
    const g = gList.find((x) => x.code === code);
    return g ? !!g.independent : code === 'I';
  };
  const t = obj.type;

  if (t === 'trials') {
    const codes = (entry.trials || []).map((x) => (x && typeof x === 'object' ? x.code : x)).filter(Boolean);
    if (!codes.length) return null;
    return Math.round((codes.filter(indep).length / codes.length) * 100);
  }
  if (t === 'probe') {
    const v = entry.guidance != null ? entry.guidance : entry.value;
    if (v == null) return null;
    return typeof v === 'number' ? v * 100 : (indep(v) ? 100 : 0);
  }
  if (t === 'chaining') {
    const steps = (obj.config && obj.config.steps) || [];
    const codes = steps.map((st) => (entry.steps || {})[st.id]).filter(Boolean);
    if (!codes.length) return null;
    return Math.round((codes.filter(indep).length / codes.length) * 100);
  }
  if (t === 'balance') {
    const steps = (obj.config && obj.config.steps) || [];
    const issues = (obj.config && obj.config.balanceOutcomes) || [];
    const meta = (k) => issues.find((o) => o.k === k);
    const essais = Array.isArray(entry.trials) ? entry.trials : [{ steps: entry.steps || {} }];
    let reussi = 0, notes = 0;
    essais.forEach((es) => {
      steps.forEach((st) => {
        const e = (es.steps || {})[st.id];
        if (!e || !e.outcome) return;
        const m = meta(e.outcome);
        if (m && m.exclu) return;
        if (!m && e.outcome === 'manque') return;
        notes += 1;
        if (m ? m.reussite : e.outcome === 'reussi') reussi += 1;
      });
    });
    return notes ? Math.round((reussi / notes) * 100) : null;
  }
  return null;
}

/* ==================== Critère d'acquisition ====================
   La référence est `masteryDe` / `masteryStatus` côté DatABA : les deux
   applications doivent rendre le même verdict sur les mêmes données, sans
   quoi un bilan contredit la tablette qui l'a produit.

   Deux champs manquaient ici et changeaient le verdict :
   - `unit` : 'sessions' (défaut) ou 'days'. Un Probe se valide par jours
     consécutifs — plusieurs probes le même jour ne comptent que pour un point.
   - `sens` : 'min' (au moins le seuil, le seul sens qui vaille pour un
     pourcentage de réussite) ou 'max' (au plus le seuil, pour un comptage
     qu'on cherche à faire baisser — un comportement problème coté à
     l'occurrence est acquis quand il passe SOUS le seuil). */

/* Types dont le score est un pourcentage, et types admettant un critère.
   Mêmes listes que PERCENT_TYPES / MASTERY_TYPES côté DatABA. `timer` et
   `latency` n'y figurent pas : ce sont des modes retirés, conservés en
   lecture pour les données anciennes. */
const TYPES_POURCENT = ['trials', 'interval', 'chaining', 'balance', 'probe'];
const TYPES_CRITERE = [...TYPES_POURCENT, 'occurrence'];

const CRITERE_DEFAUT = { threshold: 80, sessions: 3, unit: 'sessions', sens: 'min' };
/* Un Probe sans `config.mastery` explicite — modèle ancien, export partiel —
   ne doit pas retomber sur « 80 % sur 3 séances » : son défaut est
   « 100 % sur 3 jours ». Même repli que DEFAULT_MASTERY_PROBE côté DatABA. */
const CRITERE_DEFAUT_PROBE = { threshold: 100, sessions: 3, unit: 'days', sens: 'min' };

function critereDe(obj) {
  if (!obj || !TYPES_CRITERE.includes(obj.type)) return null;
  const base = obj.type === 'probe' ? CRITERE_DEFAUT_PROBE : CRITERE_DEFAUT;
  const m = (obj.config && obj.config.mastery) || {};
  /* Comparaison de type plutôt que repli sur une valeur fausse : un seuil à 0
     est légitime en sens 'max' (zéro occurrence), et `m.threshold || 80` le
     remplaçait silencieusement par 80. */
  return {
    threshold: typeof m.threshold === 'number' ? m.threshold : base.threshold,
    needed: typeof m.sessions === 'number' ? m.sessions : base.sessions,
    unit: m.unit === 'days' ? 'days' : (m.unit === 'sessions' ? 'sessions' : base.unit),
    sens: m.sens === 'max' ? 'max' : (m.sens === 'min' ? 'min' : base.sens),
    pourcent: TYPES_POURCENT.includes(obj.type),
    /* Le critère a-t-il été réglé sur la tablette, ou vient-il du repli ?
       La distinction ne sert pas au calcul mais à l'affichage : sur un
       comptage brut, un seuil hérité du défaut ne veut rien dire et ne doit
       pas produire de verdict (voir analyserObjectif). */
    explicite: !!(obj.config && obj.config.mastery),
  };
}

/* Le seuil est-il tenu ? C'est ici que `sens` entre en jeu, et nulle part
   ailleurs : toute comparaison écrite en dur ailleurs finirait par diverger. */
function tientLeSeuil(valeur, crit) {
  if (!crit || valeur == null) return false;
  return crit.sens === 'max' ? valeur <= crit.threshold : valeur >= crit.threshold;
}

/* Écart au seuil, toujours positif quand le seuil n'est pas tenu, quel que
   soit le sens. Affiché tel quel : « il manque N points » en sens 'min',
   « N de trop » en sens 'max'. */
function ecartAuSeuil(valeur, crit) {
  if (!crit || valeur == null) return null;
  return crit.sens === 'max' ? valeur - crit.threshold : crit.threshold - valeur;
}

/* Regroupe les points d'une même journée calendaire en un seul point moyenné,
   pour un critère exprimé en jours plutôt qu'en séances. Porté de
   `toDayPoints` côté DatABA ; la date est conservée en plus, elle sert à
   l'affichage de la série et ne change pas le décompte. */
function pointsParJour(points) {
  const parJour = new Map();
  points.forEach((p) => {
    if (!p.date) return;
    const jour = new Date(p.date).toDateString();
    if (!parJour.has(jour)) parJour.set(jour, { somme: 0, n: 0, date: p.date });
    const e = parJour.get(jour);
    e.somme += p.value;
    e.n += 1;
  });
  return Array.from(parJour.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((e) => ({ value: Math.round(e.somme / e.n), date: e.date }));
}

/* Série sur laquelle se compte la suite : les séances, ou les journées quand
   le critère est exprimé en jours. */
function serieCritere(points, crit) {
  return crit && crit.unit === 'days' ? pointsParJour(points) : points;
}

/* Longueur de la suite en cours, comptée depuis la fin. */
function suiteAuSeuil(points, crit) {
  if (!crit) return 0;
  const serie = serieCritere(points, crit);
  let suite = 0;
  for (let i = serie.length - 1; i >= 0; i--) {
    if (tientLeSeuil(serie[i].value, crit)) suite += 1;
    else break;
  }
  return suite;
}

/* `guidancesParSource` est `donnees._guidances` : le jeu de l'établissement,
   par tablette, dont `objectiveScoreValue` se sert de repli quand l'objectif
   ne porte pas le sien. Optionnel — sans lui le repli reste celui d'avant. */
function analyserObjectif(seances, tableParSource, obj, guidancesParSource) {
  const points = [];
  const mesures = [];
  let unite = null;
  /* Historique de phase et phase en cours : lus sur le snapshot de la séance
     la plus récente. L'historique est cumulatif côté tablette — le dernier
     snapshot les porte toutes —, alors qu'un snapshot ancien ignore les
     changements survenus depuis. Retenus avant même de savoir si la séance
     porte une cotation exploitable : un objectif sélectionné mais non coté
     renseigne quand même sa phase. */
  let dernierSnap = null;
  let dateDernierSnap = null;
  seances.forEach((sess) => {
    const sid = tableParSource[sess.source];
    if (!sid) return;
    const oid = Object.keys(sess.objectiveSnapshot || {}).find((k) => sess.objectiveSnapshot[k].name === obj.name);
    if (!oid || !((sess.selectedObjectives || {})[sid] || []).includes(oid)) return;
    const entry = (sess.data || {})[sid] && sess.data[sid][oid];
    const snap = sess.objectiveSnapshot[oid];
    if (!dateDernierSnap || new Date(sess.date) >= new Date(dateDernierSnap)) {
      dernierSnap = snap;
      dateDernierSnap = sess.date;
    }

    /* Les mesures brutes vivent à part des points en pourcentage. Les mélanger
       fausserait toutes les moyennes d'autonomie du reste de l'application :
       un compteur d'occurrences à 12 n'est pas un score de 12 %. La bascule
       se fait sur l'unité rendue par valeurCotation, et non sur le type :
       c'est ce qui fait enfin entrer le mode Intervalle dans les points, lui
       dont le score est bien un pourcentage mais qu'objectiveScoreValue ne
       sait pas calculer — ses cotations n'apparaissaient nulle part. */
    const m = valeurCotation(snap, entry, (guidancesParSource || {})[sess.source]);
    if (!m) return;
    if (m.unite === '%') {
      /* Le créneau (matin/après-midi) n'existe que pour Probe à deux prises
         par jour : porté jusqu'au point plutôt qu'ignoré, sinon un probe
         manqué sur un créneau prévu se lit comme un trou dans les données
         plutôt que comme l'information de suivi que c'est. */
      const creneau = snap.type === 'probe' && entry && entry.creneau ? entry.creneau : null;
      points.push({ date: sess.date, value: m.valeur, favorite: !!snap.favorite, creneau });
    } else {
      mesures.push({ date: sess.date, value: m.valeur, favorite: !!snap.favorite });
      unite = m.unite;
    }
  });
  points.sort((a, b) => new Date(a.date) - new Date(b.date));
  mesures.sort((a, b) => new Date(a.date) - new Date(b.date));

  const crit = critereDe(obj);

  /* Un seuil ne s'applique pas à n'importe quelle série. Sur un pourcentage,
     il se lit directement ; sur un comptage d'occurrences, il porte sur le
     nombre brut — c'est le cas du comportement problème, acquis quand il
     passe *sous* le seuil. Mais on ne juge un comptage que si le critère a
     été réglé sur la tablette : le repli « 80 sur 3 séances » n'a aucun sens
     sur un compteur, et classerait « non acquis » un suivi que personne n'a
     demandé de juger. */
  const critere = crit && (crit.pourcent || crit.explicite) ? crit : null;

  const base = {
    points,
    mesures,
    unite,
    phaseHistory: (dernierSnap && dernierSnap.phaseHistory) || [],
    phase: (dernierSnap && dernierSnap.activePhaseName) || null,
    threshold: critere ? critere.threshold : null,
    needed: critere ? critere.needed : null,
    unit: critere ? critere.unit : null,
    sens: critere ? critere.sens : null,
    critPourcent: critere ? critere.pourcent : null,
    prioritaire: points.some((p) => p.favorite) || mesures.some((m) => m.favorite),
  };

  return { ...base, ...etatDeSerie(points, mesures, critere) };
}

/* La cascade d'états, à part de ce qui l'alimente : un objectif coté en séance
   (analyserObjectif) et un critère de suivi continu promu en objectif
   (lignesSuiviContinu) doivent la traverser à l'identique, sinon les mêmes
   chiffres donneraient deux verdicts selon leur provenance.

   Reçoit les deux séries déjà triées et le critère déjà résolu (null = aucun
   seuil applicable). Rend `etat`, `streak`, et selon le cas `jours` ou
   `moyenne` — exactement les champs que les consommateurs de `lignes`
   attendent en plus de la base. */
function etatDeSerie(points, mesures, critere) {
  const serie = critere && !critere.pourcent ? mesures : points;

  /* Dormance : lue sur la cotation la plus récente, quelle que soit la série
     qui la porte. Un objectif coté hier en mesure brute n'est pas dormant
     parce que sa dernière valeur en pourcentage remonte à un mois. */
  const derniere = [points, mesures]
    .filter((a) => a.length)
    .map((a) => a[a.length - 1].date)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;
  const jours = derniere ? Math.floor((Date.now() - new Date(derniere)) / 86400000) : null;

  /* Un objectif suivi en mesure brute — occurrences, minutes, latence — sans
     critère applicable n'a rien à comparer à un seuil d'acquisition. Le
     classer « Non acquis » comme avant était faux : il n'était pas raté, il
     n'était pas mesuré sur cette échelle. Il garde donc son propre état, et
     seule l'absence de cotation récente peut encore le rendre dormant.

     `!critere` est ajouté à la garde pour un critère de suivi continu promu
     en objectif sans seuil réglé (voir lignesSuiviContinu) : sa série peut
     très bien être non vide et pourtant n'avoir jamais été jugée — c'est un
     cas qu'un objectif de séance ne produisait pas (un critère y est toujours
     résolu, au pire par défaut), donc sans conséquence sur les objectifs
     existants. */
  if (!critere || !serie.length) {
    if (!points.length && !mesures.length) return { etat: 'non_acquis', streak: 0 };
    if (jours >= DORMANT_JOURS) return { etat: 'dormant', streak: 0, jours };
    return { etat: 'mesure', streak: 0 };
  }

  const streak = suiteAuSeuil(serie, critere);
  /* La série effectivement jugée : regroupée par journée quand le critère
     s'exprime en jours. C'est aussi celle que regarde le plateau. */
  const serieJugee = serieCritere(serie, critere);

  if (critere && streak >= critere.needed) return { etat: 'acquis', streak };
  if (jours >= DORMANT_JOURS) return { etat: 'dormant', streak, jours };
  if (critere && critere.needed > 1 && streak >= critere.needed - 1) return { etat: 'bientot', streak };
  /* Plateau : réservé aux critères en pourcentage. PLATEAU_ECART_MAX vaut
     20 points de pourcentage — sur un comptage brut, « à 20 près » ne veut
     rien dire. L'écart passe par ecartAuSeuil, sans quoi il serait calculé à
     l'envers dès que le sens est 'max'. */
  if (critere && critere.pourcent && serieJugee.length >= PLATEAU_MIN_POINTS) {
    const cinq = serieJugee.slice(-5);
    const moyenne = Math.round(cinq.reduce((a, p) => a + p.value, 0) / cinq.length);
    const ecart = ecartAuSeuil(moyenne, critere);
    if (ecart > 0 && ecart <= PLATEAU_ECART_MAX) return { etat: 'plateau', streak, moyenne };
  }
  return { etat: 'en_cours', streak };
}

/* Créneaux d'un Probe à deux prises par jour : matin avant 13 h, en heure
   locale — jamais UTC, même clé que côté DatABA. Manager ne fait que lire le
   créneau posé par la tablette, il ne le recalcule pas. */
const PROBE_CRENEAUX = { matin: 'Matin', aprem: 'Après-midi' };
const libelleCreneauProbe = (c) => PROBE_CRENEAUX[c] || null;

/* Libellé du critère tel qu'il s'affiche sous un objectif. Le sens s'y lit :
   « seuil 80 % » d'un côté, « au plus 2 occurrences » de l'autre. Écrire
   « seuil 2 » sur un comportement problème laissait croire qu'il fallait
   l'atteindre — c'est l'inverse qui est demandé. */
function libelleSeuil(ligne) {
  if (!ligne || ligne.threshold == null) return null;
  const unite = ligne.critPourcent ? '%' : (ligne.unite || '');
  const valeur = `${ligne.threshold}${unite ? ` ${unite}` : ''}`;
  return ligne.sens === 'max' ? `au plus ${valeur}` : `seuil ${valeur}`;
}
/* Le critère complet, unité comprise : un Probe se valide sur des jours, pas
   sur des séances, et l'écrire « sur 3 séances » était faux. */
function libelleCritere(ligne) {
  const seuil = libelleSeuil(ligne);
  if (!seuil) return null;
  const n = ligne.needed;
  const pluriel = n > 1 ? 's' : '';
  return `${seuil} sur ${n} ${ligne.unit === 'days' ? `jour${pluriel}` : `séance${pluriel}`}`;
}

/* Une ligne restreinte à une période, sur ses deux séries. `mesures` restait
   non filtré avant l'arrivée du suivi continu promu en objectif : une carte
   en mode mesure affichait alors tout son historique quelle que soit la
   période choisie, pendant que `points` la respectait déjà. Même fonction
   pour le Tableau de bord et la fiche personne, pour que les deux lisent la
   même période de la même façon. */
function filtrerLignePeriode(ligne, periode) {
  return {
    ...ligne,
    points: ligne.points.filter((pt) => dansPeriode(pt.date, periode)),
    mesures: ligne.mesures.filter((m) => dansPeriode(m.date, periode)),
  };
}

function construireLignes(donnees) {
  const lignes = [];
  donnees.personnes.forEach((p) => {
    const tableParSource = {};
    donnees.sources.forEach((src) => {
      const sid = idPourSource(donnees, src, p.initials);
      if (sid) tableParSource[src] = sid;
    });

    const siennes = donnees.seances.filter((sess) => {
      const sid = tableParSource[sess.source];
      return sid && (sess.selectedObjectives || {})[sid];
    });

    const objectifs = new Map();
    siennes.forEach((sess) => {
      const sid = tableParSource[sess.source];
      (sess.selectedObjectives[sid] || []).forEach((oid) => {
        const snap = (sess.objectiveSnapshot || {})[oid];
        if (snap && !objectifs.has(snap.name)) objectifs.set(snap.name, snap);
      });
    });

    objectifs.forEach((obj) => {
      lignes.push({
        initials: p.initials,
        objectif: obj.name,
        type: obj.type,
        ...analyserObjectif(siennes, tableParSource, obj, donnees._guidances),
      });
    });
  });
  return [...lignes, ...lignesSuiviContinu(donnees, lignes)];
}

/* Unités d'un critère de suivi continu promu en objectif. `pourcent` décide de
   la série d'accueil : une part de temps est bornée 0-100 et rejoint `points`
   comme n'importe quelle cotation en pourcentage, le reste rejoint `mesures`.
   C'est la règle qu'applique déjà analyserObjectif — l'aiguillage se fait sur
   l'unité, pas sur le type — et non une convention nouvelle. */
const UNITES_OBJECTIF_SUIVI = {
  part: { label: 'Part du temps borné', unite: '%', pourcent: true },
  minutes: { label: 'Minutes cumulées', unite: 'min', pourcent: false },
  episodes: { label: "Nombre d'épisodes", unite: 'épisodes', pourcent: false },
  occurrences: { label: "Nombre d'appuis", unite: 'occurrences', pourcent: false },
};
const cleObjectifSuivi = (initiales, cleSerie) => `${initiales}|${cleSerie}`;

/* Valeur d'une journée pour un critère, dans l'unité demandée. Les segments
   non bornés sont exclus comme partout ailleurs, et une journée qui n'en a
   aucun ne rend rien : ce n'est pas un zéro, rien n'y a été mesuré. */
function valeurJourSuivi(segmentsDuJour, cle, unite) {
  const bornes = segmentsDuJour.filter((s) => s.ms != null);
  if (!bornes.length) return null;
  const siens = bornes.filter((s) => s.cle === cle);
  if (unite === 'episodes') return siens.length;
  const ms = siens.reduce((a, s) => a + s.ms, 0);
  if (unite === 'minutes') return Math.round(ms / 60000);
  const total = bornes.reduce((a, s) => a + s.ms, 0);
  return total ? Math.round((ms / total) * 100) : null;
}

/* Lignes d'objectif issues du suivi continu et des compteurs, pour les seuls
   couples personne × série que l'utilisateur a explicitement promus.

   `dejaCotes` sert à l'identité : `objectif` est un NOM, et ce nom est la clé
   React, l'ancre DOM du défilement, la clé d'alias, de code de curriculum et
   de commentaire. Si un objectif coté en séance porte déjà ce nom chez la même
   personne, deux lignes distinctes partageraient tout cela — le nom promu est
   alors suffixé, et seulement dans ce cas. */
function lignesSuiviContinu(donnees, dejaCotes) {
  const reglages = donnees.objectifsSuivi || {};
  if (!Object.keys(reglages).length) return [];
  const pris = new Set((dejaCotes || []).map((l) => `${l.initials}|${l.objectif}`));
  const lignes = [];

  (donnees.personnes || []).forEach((p) => {
    const segments = segmentsSuivi(suiviDePersonne(donnees, p.initials));
    const appuis = compteursDePersonne(donnees, p.initials);

    /* Segments regroupés par (axe, jour) : la part d'un critère se calcule sur
       le temps borné de SON axe dans SA journée, jamais sur le total. */
    const parAxeJour = new Map();
    segments.forEach((s) => {
      const j = jourLocal(s.debut);
      if (j == null) return;
      const k = `${s.nomAxe}||${j}`;
      if (!parAxeJour.has(k)) parAxeJour.set(k, []);
      parAxeJour.get(k).push(s);
    });

    const ajouter = (cleReg, cleSerie, nom, type, journalieres, reglage) => {
      const meta = UNITES_OBJECTIF_SUIVI[reglage.unite] || UNITES_OBJECTIF_SUIVI.occurrences;
      journalieres.sort((a, b) => new Date(a.date) - new Date(b.date));
      const points = meta.pourcent ? journalieres : [];
      const mesures = meta.pourcent ? [] : journalieres;
      /* Un seuil réglé ici est explicite par construction : personne ne l'a
         hérité d'un défaut, quelqu'un l'a saisi. Sans seuil, aucun critère —
         l'objectif reste « Suivi en mesure », lu à son évolution. */
      const critere = reglage.seuil == null ? null : {
        threshold: reglage.seuil,
        needed: reglage.jours || 1,
        unit: 'days',
        sens: reglage.sens === 'max' ? 'max' : 'min',
        pourcent: meta.pourcent,
        explicite: true,
      };
      let objectif = nom;
      if (pris.has(`${p.initials}|${objectif}`)) {
        objectif = `${nom} (${type === 'compteur' ? 'compteur' : 'suivi continu'})`;
      }
      lignes.push({
        initials: p.initials,
        objectif,
        type,
        points,
        mesures,
        unite: meta.pourcent ? null : meta.unite,
        phaseHistory: [],
        phase: null,
        threshold: critere ? critere.threshold : null,
        needed: critere ? critere.needed : null,
        unit: critere ? critere.unit : null,
        sens: critere ? critere.sens : null,
        critPourcent: critere ? critere.pourcent : null,
        prioritaire: false,
        /* Marque de provenance : la sous-vue Suivi continu s'en sert pour dire
           qu'une série alimente aussi le bilan, et le Tableau de bord pour ne
           pas annoncer « séances » là où il s'agit de journées. `cleSuivi` est
           la clé de réglage d'origine (celle d'`objectifsSuivi`) : c'est ce
           qui permet à la sous-vue Suivi continu de retrouver l'état de la
           ligne qu'un réglage vient de produire, sans reconstituer le nom. */
        origineSuivi: type,
        cleSuivi: cleReg,
        ...etatDeSerie(points, mesures, critere),
      });
    };

    Object.entries(reglages).forEach(([cle, reglage]) => {
      if (!reglage || !reglage.actif) return;
      const sep = cle.indexOf('|');
      if (sep < 0 || cle.slice(0, sep) !== p.initials) return;
      const cleSerie = cle.slice(sep + 1);

      if (cleSerie.startsWith('compteur:')) {
        const id = cleSerie.slice('compteur:'.length);
        const siens = appuis.filter((r) => r.compteurId === id);
        if (!siens.length) return;
        const parJour = new Map();
        siens.forEach((r) => {
          const j = jourLocal(r.timestamp);
          if (j == null) return;
          parJour.set(j, (parJour.get(j) || 0) + 1);
        });
        const journalieres = Array.from(parJour.entries())
          .map(([j, n]) => ({ date: `${j}T12:00:00`, value: n, favorite: false }));
        if (!journalieres.length) return;
        ajouter(cle, cleSerie, siens[0].nomCompteur, 'compteur', journalieres,
          { ...reglage, unite: 'occurrences' });
        return;
      }

      if (!cleSerie.startsWith('critere:')) return;
      /* `critere:<nomAxe>||<cle>` — le nom d'axe peut contenir n'importe quoi,
         seule la dernière occurrence du séparateur fait foi. */
      const reste = cleSerie.slice('critere:'.length);
      const coupe = reste.lastIndexOf('||');
      if (coupe < 0) return;
      const nomAxe = reste.slice(0, coupe);
      const cleCritere = reste.slice(coupe + 2);
      const journalieres = [];
      let libelle = null;
      parAxeJour.forEach((segs, k) => {
        if (k.slice(0, k.lastIndexOf('||')) !== nomAxe) return;
        const value = valeurJourSuivi(segs, cleCritere, reglage.unite);
        if (value == null) return;
        const porteur = segs.find((s) => s.cle === cleCritere);
        if (porteur && !libelle) libelle = porteur.meta.l;
        journalieres.push({ date: `${k.slice(k.lastIndexOf('||') + 2)}T12:00:00`, value, favorite: false });
      });
      if (!journalieres.length || !libelle) return;
      ajouter(cle, cleSerie, libelle, 'suivi', journalieres, reglage);
    });
  });

  return lignes;
}

/* ==================== Table de faits ====================
   Une ligne par cotation, par crise, par segment de suivi continu et par
   objectif, avec toutes les dimensions résolues. C'est ce qui permet de
   croiser librement deux axes sans avoir prévu la combinaison à l'avance.
   `lignes` (état d'acquisition par personne × objectif, construireLignes)
   nourrit la table `objectifs` ; les trois autres se suffisent à elles-mêmes. */
function construireFaits(donnees, lignes) {
  const cotations = [];
  const nomIntervenant = (source, id) => {
    const t = (donnees._intervenants || {})[source] || {};
    return t[id] || 'Non renseigné';
  };

  donnees.seances.forEach((sess) => {
    /* `libelleSeance` et non `nomAtelier` : sans quoi les séances libres et les
       séances Équilibre tombent toutes dans un même « Hors atelier » et la
       dimension Atelier d'Explorer les confond. */
    const atelier = libelleSeance(donnees, sess);
    const intervenant = nomIntervenant(sess.source, sess.intervenantId);
    const table = (donnees._idVersInitiales || {})[sess.source] || {};

    (sess.studentIds || []).forEach((sid) => {
      const initiales = table[sid];
      if (!initiales) return;

      ((sess.selectedObjectives || {})[sid] || []).forEach((oid) => {
        const obj = (sess.objectiveSnapshot || {})[oid];
        const entry = (sess.data || {})[sid] && sess.data[sid][oid];
        if (!obj) return;
        /* `valeurCotation` et non `objectiveScoreValue` : ce dernier ne sait
           calculer que les quatre modes dont le score est un pourcentage
           DIRECT, et rend null pour le mode Intervalle — dont le score est
           pourtant bien un pourcentage, calculé par partNiveauCible. Les
           cotations en Intervalle sortaient donc du taux d'autonomie moyen,
           alors qu'elles entrent bien dans les points de analyserObjectif :
           deux chiffres différents pour la même cotation. L'occurrence reste
           hors du taux, elle, mais parce que ce n'est pas un pourcentage. */
        const m = valeurCotation(obj, entry, guidancesDe(donnees, sess.source));
        const score = m && m.unite === '%' ? m.valeur : null;
        const app = mesuresAppoint(entry);
        cotations.push({
          seanceId: sess.id,
          date: sess.date,
          personne: initiales,
          atelier,
          intervenant,
          objectif: obj.name,
          type: (TYPES_COTATION[obj.type] || obj.type),
          phase: obj.activePhaseName || 'Non renseignée',
          score,
          /* Mesures d'appoint : sur la table des cotations et non à part, elles
             n'existent que rattachées à l'une d'elles. null quand rien n'a été
             validé — `agreger` écarte les null, la case reste donc vide plutôt
             que de compter un zéro qui n'a pas été mesuré. */
          compteurAppoint: app ? app.compteur : null,
          chronoAppointMin: minutesAppoint(app),
        });
      });
    });
  });

  const crises = (donnees.crises || []).map((c) => {
    const table = (donnees._idVersInitiales || {})[c.source] || {};
    return {
      date: c.date,
      personne: table[c.studentId] || 'Non renseignée',
      atelier: nomAtelier(donnees, c.source, c.atelierId),
      /* DatABA note plusieurs intervenants sur une crise (`intervenantIds`).
         Le champ arrivait bien à l'import et n'était lu nulle part : les
         séances et les relevés portaient leur intervenant dans les faits, les
         crises non, si bien que le croisement crises × intervenant était le
         seul à ne pas exister. Plusieurs noms sont joints plutôt que réduits au
         premier — écarter les autres inventerait une attribution unique que la
         tablette n'a pas faite. */
      intervenant: (c.intervenantIds || []).map((id) => nomIntervenant(c.source, id)).join(', ') || 'Non renseigné',
      type: (c.kind || 'crise') === 'abc' ? 'Observation' : 'Crise',
      intensite: c.intensite ? `${c.intensite} · ${INTENSITES[c.intensite].label}` : 'Non renseignée',
      intensiteNum: c.intensite || null,
      minutes: Math.round((c.durationMs || 0) / 60000),
    };
  });

  /* Un fait par segment de suivi continu — pas par relevé : c'est la durée
     bornée entre deux relevés qui a un sens à cumuler ou moyenner, un
     horodatage isolé n'en a aucun. Les segments non bornés (voir
     segmentsJournee) sont exclus, même règle que sur la fiche personne. */
  const suivi = [];
  (donnees.personnes || []).forEach((p) => {
    const releves = suiviDePersonne(donnees, p.initials);
    const parAxeJour = new Map();
    releves.forEach((r) => {
      const cle = `${r.nomAxe}|${jourLocal(r.timestamp)}`;
      if (!parAxeJour.has(cle)) parAxeJour.set(cle, []);
      parAxeJour.get(cle).push(r);
    });
    parAxeJour.forEach((rs, cle) => {
      const axe = cle.slice(0, cle.lastIndexOf('|'));
      const triees = rs.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const nonFin = triees.filter((r) => !r.fin);
      /* segmentsJournee ne pousse un segment que pour un relevé qui n'est pas
         une clôture, dans le même ordre relatif : le k-ième segment retourné
         correspond donc au k-ième relevé non-clôture de `triees`. */
      segmentsJournee(triees).forEach((seg, i) => {
        if (seg.ms == null) return;
        const porteur = nonFin[i];
        suivi.push({
          date: new Date(seg.debut).toISOString(),
          personne: p.initials,
          atelier: porteur ? nomAtelier(donnees, porteur.source, porteur.atelierId) : 'Hors atelier',
          intervenant: porteur ? nomIntervenant(porteur.source, porteur.intervenantId) : 'Non renseigné',
          axe,
          critere: seg.meta.l,
          origine: libelleOrigineReleve(porteur && porteur.origine),
          minutes: Math.round(seg.ms / 60000),
        });
      });
    });
  });

  /* Un fait par appui de compteur d'occurrence. Table à part, et non une
     colonne de plus sur `suivi` : un appui est ponctuel, il n'a pas de durée à
     cumuler, et le mêler aux segments obligerait chaque mesure à savoir
     laquelle des deux natures elle regarde. */
  const compteurs = [];
  (donnees.personnes || []).forEach((p) => {
    compteursDePersonne(donnees, p.initials).forEach((r) => {
      compteurs.push({
        date: new Date(r.timestamp).toISOString(),
        personne: p.initials,
        compteur: r.nomCompteur,
        atelier: nomAtelier(donnees, r.source, r.atelierId),
        intervenant: nomIntervenant(r.source, r.intervenantId),
        origine: libelleOrigineReleve(r.origine),
      });
    });
  });

  /* Un fait par personne × objectif, daté de sa cotation la plus récente :
     l'état d'acquisition est une valeur globale (construireLignes), pas un
     événement daté, mais l'ancrer ainsi permet de croiser « objectifs actifs
     récemment » avec les axes temporels comme les autres tables. `evolution`
     porte sur tout l'historique de l'objectif, pas seulement sur la période
     affichée — la période ne filtre ici que la liste des objectifs retenus,
     via leur dernière cotation. */
  /* Une ligne en mesure brute (occurrences, minutes, suivi continu promu en
     objectif) n'a pas de `points` mais a des `mesures` : elle a sa place ici
     aussi, faute de quoi les mesures `objAcquis`/`objPartAcquis` de l'Explorer
     l'ignoraient. `evolution` reste réservée au pourcentage — la colonne est
     en points de %, y verser un delta d'occurrences ou de minutes mélangerait
     deux unités dans la même colonne. */
  const objectifs = (lignes || [])
    .filter((l) => l.points.length || l.mesures.length)
    .map((l) => {
      const serie = l.points.length ? l.points : l.mesures;
      const dernier = serie[serie.length - 1];
      const premier = serie[0];
      return {
        date: dernier.date,
        personne: l.initials,
        objectif: l.objectif,
        type: (TYPES_COTATION[l.type] || l.type),
        etat: ETAT_RAPPORT[l.etat] || l.etat,
        acquis: l.etat === 'acquis' ? 1 : 0,
        evolution: (l.points.length > 1) ? Math.round(dernier.value - premier.value) : null,
      };
    });

  return { cotations, crises, suivi, compteurs, objectifs };
}

/* `timer` et `latency` ne figurent plus dans les TYPES de DatABA (retirés au
   profit d'Intervalle et de Probe) mais restent ici : Manager ne propose
   jamais de créer un objectif, seulement d'afficher ceux déjà cotés — une
   cotation ancienne dans ces deux modes doit encore pouvoir se lire. */
const TYPES_COTATION = {
  trials: 'Essai par essai', probe: 'Probe', occurrence: 'Par occurrence',
  timer: 'Timer', interval: 'Niveau par intervalle', chaining: 'Chaînage',
  latency: 'Latence', balance: 'Balance Program',
  /* Objectifs issus du suivi continu (lignesSuiviContinu), sans équivalent
     côté DatABA : ce ne sont pas des types de cotation de séance. */
  suivi: 'Suivi continu', compteur: "Compteur d'occurrence",
};

const nomAtelier = (d, source, id) => (id && ((d._ateliers || {})[source] || {})[id]) || 'Hors atelier';

/* DatABA connaît trois natures de séance, mais son modèle n'en nomme que deux :
   `mode` vaut 'atelier' ou 'balance', et la séance libre est un 'atelier' SANS
   atelier. Manager les résolvait toutes par `nomAtelier`, qui rend « Hors
   atelier » dès que l'identifiant est nul : une séance libre et une séance
   Équilibre s'affichaient à l'identique, introuvables par la recherche et
   fondues sous une même valeur dans la dimension Atelier d'Explorer.

   Même règle que côté DatABA, où elle est écrite deux fois (export Excel et
   liste des séances) — ici une seule fois, et tout le monde l'appelle. */
function libelleSeance(d, sess) {
  if (!sess) return 'Hors atelier';
  if (sess.atelierId) return nomAtelier(d, sess.source, sess.atelierId);
  return sess.mode === 'balance' ? 'Équilibre' : 'Séance libre';
}

/* Nom d'un compteur d'occurrence, même patron. Le repli dit « retiré » et non
   « sans nom » : un compteur sans nom a été enregistré comme tel à l'import
   (voir fusionnerImport), donc arriver ici signifie que l'identifiant n'est
   plus dans la configuration de la tablette. */
const nomCompteurDe = (d, source, id) => (id && ((d._compteurs || {})[source] || {})[id]) || 'Compteur retiré';
/* Jeu de guidances de la tablette d'où vient la cotation — à passer à
   `valeurCotation` par tout ce qui lit une cotation de séance. */
const guidancesDe = (d, source) => ((d._guidances || {})[source] || []);

const cleAlias = (initiales, objectif) => `${initiales}|${objectif}`;
const nomAffiche = (d, initiales) => (d.alias.personnes || {})[initiales] || initiales;
const libelleAffiche = (d, initiales, objectif) => (d.alias.objectifs || {})[cleAlias(initiales, objectif)] || objectif;
const codeEflDe = (d, objectif) => ((d.codesEfl || {})[objectif] || '').trim();
/* Nom de la classe d'une personne, ou null si elle n'en a pas (données
   d'avant le rattrapage, ou tablette qui n'a pas encore migré Groupe → Classe). */
function nomClasseDe(d, initiales) {
  const p = (d.personnes || []).find((x) => x.initials === initiales);
  if (!p || !p.classeId) return null;
  const c = (d.classes || []).find((x) => x.id === p.classeId);
  return c ? c.nom : null;
}

/* ==================== Suivi continu (multi-axes) ====================
   Repris de DatABA : axeDe / metaCritere / CRITERE_INCONNU. Un critère retiré
   de la configuration ne ressuscite pas — les relevés passés qui le portaient
   restent affichés, avec leur clé d'origine entre parenthèses. */
const CRITERE_INCONNU_SUIVI = { k: null, l: 'Critère retiré', color: INK_SOFT };

function axeDe(axes, suiviId) {
  return (axes || []).find((a) => a.id === suiviId) || null;
}
function metaCritereSuivi(criteres, k) {
  return (criteres || []).find((c) => c.k === k) || CRITERE_INCONNU_SUIVI;
}
/* Les critères historiques de l'axe 'stabilité', pour lire les relevés v3
   (`stabilite`, champ `etat`) avec les mêmes couleurs que le suivi continu.
   Mêmes clés que DEFAULT_CRITERES_SUIVI côté DatABA. */
const CRITERES_STABILITE_V3 = [
  { k: 'stable', l: 'Stable', color: ACQUIS },
  { k: 'pre-crise', l: 'Pré-crise', color: EN_COURS },
  { k: 'crise', l: 'Crise', color: NON_ACQUIS },
  { k: 'post-crise', l: 'Post-crise', color: CAT_INDIGO },
];

/* L'axe et les critères d'un relevé, quelle que soit sa provenance : un
   relevé v4 porte suiviId + critere et se résout dans les axes de sa source ;
   un relevé v3 (stabilite) n'a qu'un état sur l'axe historique implicite. */
function axeEtCritereDuReleve(donnees, releve, estV4) {
  if (estV4) {
    const axes = (donnees._axesSuivi || {})[releve.source] || [];
    const axe = axeDe(axes, releve.suiviId);
    const meta = axe ? metaCritereSuivi(axe.criteres, releve.critere) : CRITERE_INCONNU_SUIVI;
    return { nomAxe: axe ? axe.nom : 'Suivi retiré', meta, cle: releve.critere };
  }
  return { nomAxe: 'Suivi de stabilité', meta: metaCritereSuivi(CRITERES_STABILITE_V3, releve.etat), cle: releve.etat };
}

/* Un appui de compteur d'occurrence voyage dans `suivi`, au milieu des relevés
   d'état, mais il n'en est pas un : il est ponctuel. Il n'a ni axe, ni critère,
   ni durée jusqu'au suivant. Le laisser passer dans segmentsJournee lui
   inventait un état qui dure jusqu'à l'appui d'après — huit appuis sur
   « demandes » sortaient en sept segments d'une durée jamais observée, tous
   confondus sur un axe fantôme « Suivi retiré » puisque leur `suiviId` est
   absent. D'où la séparation à la source : suiviDePersonne les écarte,
   compteursDePersonne les prend. */
const estReleveCompteur = (r) => !!r && r.kind === 'compteur';

/* Geste qui a produit un relevé, côté DatABA : un appui sur la pastille de
   suivi, la clôture de la journée, ou une saisie a posteriori. Le champ arrive
   sous le nom `source` et `fusionnerImport` le renomme `origine`, `source`
   désignant ici la tablette. Il était conservé depuis toujours et n'apparaissait
   nulle part : un axe de croisement de plus, pas une donnée de plus. */
const ORIGINES_RELEVE = { pastille: 'Pastille', cloture: 'Clôture de journée', manuel: 'Saisie manuelle' };
const libelleOrigineReleve = (o) => ORIGINES_RELEVE[o] || 'Non renseignée';

/* Relevés de suivi continu d'une personne, v4 et v3 réunis et triés du plus
   récent au plus ancien. Chaque entrée porte de quoi s'afficher sans
   redemander l'axe. */
function suiviDePersonne(donnees, initiales) {
  const estDeLaPersonne = (r) => ((donnees._idVersInitiales || {})[r.source] || {})[r.studentId] === initiales;
  const v4 = (donnees.suivi || [])
    .filter((r) => estDeLaPersonne(r) && !estReleveCompteur(r))
    .map((r) => ({ ...r, ...axeEtCritereDuReleve(donnees, r, true), estV4: true }));
  const v3 = (donnees.stabilite || [])
    .filter(estDeLaPersonne)
    .map((r) => ({ ...r, ...axeEtCritereDuReleve(donnees, r, false), estV4: false }));
  return [...v4, ...v3].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/* Appuis de compteur d'occurrence d'une personne, résolus et triés du plus
   récent au plus ancien — symétrique de suiviDePersonne. Un compteur n'existe
   qu'en v4 : le format v3 (`stabilite`) n'en a jamais porté. */
function compteursDePersonne(donnees, initiales) {
  return (donnees.suivi || [])
    .filter((r) => estReleveCompteur(r)
      && ((donnees._idVersInitiales || {})[r.source] || {})[r.studentId] === initiales)
    .map((r) => ({ ...r, nomCompteur: nomCompteurDe(donnees, r.source, r.compteurId) }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/* Jour local d'un horodatage, en « AAAA-MM-JJ » — repris de DatABA
   (`jourLocal`). Jamais `toISOString().slice(0, 10)`, qui bascule de jour en
   fin de soirée selon le fuseau. */
function jourLocal(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* Jours où l'on a une trace de la personne : une séance à laquelle elle a
   participé, une crise ou une observation la concernant, un relevé de suivi
   continu. C'est la meilleure preuve de présence dont Manager dispose —
   DatABA ne consigne aucun calendrier de présence.

   Sert à distinguer deux choses que la chronologie des crises confondait : un
   jour sans crise, qui est un vrai zéro et doit compter, et un jour d'absence
   ou de vacances, qui ne doit pas. Sans cette distinction la tendance se
   calculait sur les seules tranches où il s'était passé quelque chose, donc
   biaisée vers le haut ; en comptant tous les jours du calendrier elle
   l'aurait été vers le bas.

   Biais résiduel assumé, dit à l'écran : un jour de présence sans rien de coté
   ni relevé reste invisible et son zéro est perdu. `initiales` à null =
   n'importe quelle personne, pour le filtre « toutes les personnes ». */
function joursObserves(donnees, initiales) {
  const jours = new Set();
  const ajouter = (d) => { const j = jourLocal(d); if (j) jours.add(j); };
  const iniDe = (source, sid) => ((donnees._idVersInitiales || {})[source] || {})[sid];

  (donnees.seances || []).forEach((s) => {
    if (initiales && !(s.studentIds || []).some((sid) => iniDe(s.source, sid) === initiales)) return;
    ajouter(s.date);
  });
  (donnees.crises || []).forEach((c) => {
    if (initiales && iniDe(c.source, c.studentId) !== initiales) return;
    ajouter(c.date);
  });
  /* Les appuis de compteur comptent comme trace de présence au même titre
     qu'un relevé d'état, mais ils ne passent plus par suiviDePersonne : il faut
     donc les ajouter explicitement, sans quoi une journée où seul un compteur a
     servi disparaîtrait des jours observés. */
  if (initiales) {
    suiviDePersonne(donnees, initiales).forEach((r) => ajouter(r.timestamp));
    compteursDePersonne(donnees, initiales).forEach((r) => ajouter(r.timestamp));
  } else {
    [...(donnees.suivi || []), ...(donnees.stabilite || [])].forEach((r) => ajouter(r.timestamp));
  }
  return jours;
}

/* Découpage d'une journée en segments, pour la frise de suivi continu. Reçoit
   les relevés déjà résolus par suiviDePersonne (un seul axe, un seul jour,
   triés du plus ancien au plus récent) — contrairement à `segmentsJournee`
   côté DatABA qui recherche l'axe lui-même dans les relevés bruts, chaque
   relevé porte déjà sa `meta` ici. Une clôture (`r.fin`) ne démarre pas de
   segment, elle borne le précédent. Le dernier segment de la liste reste
   `ms: null` tant qu'aucune clôture ni relevé suivant ne le borne : ce n'est
   pas une durée nulle, c'est une durée pas encore connue — l'étirer jusqu'à
   minuit inventerait une donnée jamais saisie. */
function segmentsJournee(relevesJour) {
  const segments = [];
  for (let i = 0; i < relevesJour.length; i++) {
    const r = relevesJour[i];
    if (r.fin) continue;
    const debut = new Date(r.timestamp).getTime();
    if (Number.isNaN(debut)) continue;
    const suivant = relevesJour[i + 1];
    const fin = suivant ? new Date(suivant.timestamp).getTime() : null;
    segments.push({ debut, fin, meta: r.meta, cle: r.cle, ms: fin != null ? fin - debut : null });
  }
  return segments;
}

/* Part du temps passée dans chaque critère, sur un ensemble de segments
   (une journée, ou plusieurs journées mises bout à bout sur une période). Les
   segments non bornés (`ms: null`) sont exclus du dénominateur et comptés à
   part : un pourcentage ne doit jamais reposer sur une durée devinée. */
function repartitionCriteres(segments) {
  const bornes = segments.filter((s) => s.ms != null);
  const total = bornes.reduce((a, s) => a + s.ms, 0);
  const parCritere = new Map();
  bornes.forEach((s) => {
    if (!parCritere.has(s.cle)) parCritere.set(s.cle, { cle: s.cle, meta: s.meta, ms: 0, n: 0 });
    const e = parCritere.get(s.cle);
    e.ms += s.ms;
    e.n += 1;
  });
  return {
    totalMs: total,
    /* Nombre de segments bornés : le dénominateur des occurrences. Il diffère
       de `segments.length` — un relevé jamais borné ne compte pas plus ici que
       dans les durées, sans quoi les deux lectures ne parleraient pas du même
       ensemble de faits. */
    totalN: bornes.length,
    nonBornes: segments.length - bornes.length,
    lignes: Array.from(parCritere.values())
      .map((e) => ({
        ...e,
        part: total ? Math.round((e.ms / total) * 100) : null,
        partN: bornes.length ? Math.round((e.n / bornes.length) * 100) : null,
      }))
      .sort((a, b) => b.ms - a.ms),
  };
}

/* Tous les segments de suivi continu d'une personne, tous axes et toutes
   journées confondus, chacun étiqueté de son axe. Reçoit les relevés déjà
   résolus par `suiviDePersonne`.

   Le découpage se fait par (axe, jour) : deux axes se chevauchent dans le temps
   sans se borner l'un l'autre, et une journée ne se prolonge pas dans la
   suivante — sans ce double regroupement, le dernier relevé du lundi serait
   borné par le premier du mardi et produirait un segment de quatorze heures
   qui n'a jamais été observé. Même construction que celle de `construireFaits`,
   ramenée ici pour que la fiche personne et la table de faits lisent la même
   chose. Les segments non bornés sont conservés (`ms: null`) : c'est à
   l'appelant de les écarter d'un calcul, et à `repartitionCriteres` de les
   compter à part. */
function segmentsSuivi(releves) {
  const parAxeJour = new Map();
  (releves || []).forEach((r) => {
    const jour = jourLocal(r.timestamp);
    if (jour == null) return;
    const cle = `${r.nomAxe}||${jour}`;
    if (!parAxeJour.has(cle)) parAxeJour.set(cle, { nomAxe: r.nomAxe, releves: [] });
    parAxeJour.get(cle).releves.push(r);
  });
  const tous = [];
  parAxeJour.forEach(({ nomAxe, releves: rs }) => {
    const triees = rs.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    segmentsJournee(triees).forEach((s) => tous.push({ ...s, nomAxe }));
  });
  return tous.sort((a, b) => a.debut - b.debut);
}

/* Clé de série d'un critère : un même libellé peut exister sur deux axes
   différents (« Calme » sur l'axe humeur et sur l'axe activité) sans désigner
   la même chose. L'axe fait donc partie de l'identité. Même séparateur que le
   croisement d'ExplorerScreen, pour une clé composite qui se relit. */
const cleSerieSuivi = (nomAxe, cle) => `${nomAxe}||${cle}`;

/* Chronologie du suivi continu, tranche par tranche — l'équivalent de
   `chronologieCrises` pour les segments de suivi.

   `mesure` vaut 'duree' (chaque segment pèse ses minutes) ou 'occurrences'
   (chaque segment pèse 1) : un critère peut occuper peu de temps en revenant
   souvent, ou l'inverse.

   La part est rapportée au total de **son propre axe sur sa propre tranche**,
   jamais au total général : les axes sont indépendants et se chevauchent dans
   le temps, additionner leurs durées donnerait un dénominateur qui ne
   correspond à aucune durée réelle. Deux critères d'un même axe se partagent
   donc bien 100 %, deux critères d'axes différents sont chacun rapportés au
   leur.

   Les segments non bornés sont exclus, même règle que partout ailleurs, et une
   tranche qui n'en contient aucun n'est pas créée : elle sortirait comme un
   zéro qu'elle n'est pas. */
function chronologieSuivi(segments, granularite, mesure) {
  const occurrences = mesure === 'occurrences';
  /* Cumul en unité brute (millisecondes ou nombre de segments), converti en
     minutes seulement à la sortie : arrondir chaque segment avant de sommer
     ferait disparaître les segments de moins de trente secondes et la somme
     des minutes cesserait d'égaler la durée du tout. */
  const poids = (s) => (occurrences ? 1 : s.ms);
  const tranches = new Map();
  (segments || []).forEach((s) => {
    if (s.ms == null) return;
    const cle = cleAgregation(s.debut, granularite);
    if (!tranches.has(cle)) tranches.set(cle, { cle, series: new Map(), totauxAxe: new Map() });
    const t = tranches.get(cle);
    const p = poids(s);
    const k = cleSerieSuivi(s.nomAxe, s.cle);
    if (!t.series.has(k)) t.series.set(k, { nomAxe: s.nomAxe, cle: s.cle, meta: s.meta, brut: 0 });
    t.series.get(k).brut += p;
    t.totauxAxe.set(s.nomAxe, (t.totauxAxe.get(s.nomAxe) || 0) + p);
  });
  return Array.from(tranches.values())
    .sort((a, b) => a.cle - b.cle)
    .map((t) => {
      const series = {};
      t.series.forEach((v, k) => {
        const total = t.totauxAxe.get(v.nomAxe) || 0;
        series[k] = {
          nomAxe: v.nomAxe,
          cle: v.cle,
          meta: v.meta,
          valeur: occurrences ? v.brut : Math.round(v.brut / 60000),
          part: total ? Math.round((v.brut / total) * 100) : null,
        };
      });
      return { cle: t.cle, label: etiquetteAgregation(t.cle, granularite), series };
    });
}

/* Clé de série d'un compteur. Espace de clés distinct de celui des critères :
   `cleSerieSuivi` met toujours un nom d'axe avant le séparateur, jamais le
   préfixe réservé ci-dessous. */
const cleSerieCompteur = (id) => `compteur||${id}`;

/* Chronologie des appuis d'un compteur d'occurrence, même forme de sortie que
   `chronologieSuivi` pour que le graphique mêle les deux sans conversion.

   Pas de `part` : un compteur n'a aucun dénominateur qui veuille dire quelque
   chose — ni durée totale, ni ensemble de critères qui se partageraient un
   temps. Le seul chiffre juste est le nombre d'appuis. */
function chronologieCompteurs(releves, granularite) {
  const tranches = new Map();
  (releves || []).forEach((r) => {
    const t0 = new Date(r.timestamp).getTime();
    if (Number.isNaN(t0)) return;
    const cle = cleAgregation(t0, granularite);
    if (!tranches.has(cle)) tranches.set(cle, { cle, series: new Map() });
    const t = tranches.get(cle);
    const k = cleSerieCompteur(r.compteurId);
    if (!t.series.has(k)) {
      t.series.set(k, { compteurId: r.compteurId, nomCompteur: r.nomCompteur, valeur: 0, part: null });
    }
    t.series.get(k).valeur += 1;
  });
  return Array.from(tranches.values())
    .sort((a, b) => a.cle - b.cle)
    .map((t) => {
      const series = {};
      t.series.forEach((v, k) => { series[k] = { ...v }; });
      return { cle: t.cle, label: etiquetteAgregation(t.cle, granularite), series };
    });
}

/* Croisement de deux droites de tendance, à partir des séries ajustées que
   `tendanceLineaire` a déjà produites — pas de second calcul de moindres
   carrés, et donc pas de risque de divergence entre le trait affiché et le
   point annoncé.

   Rien n'est extrapolé : un croisement au-delà du dernier point observé ou
   avant le premier ne renvoie rien. Annoncer « elles se croiseront en mars »
   sur la foi d'une droite prolongée serait donner une date que personne n'a
   observée. Deux droites parallèles ne se croisent pas non plus. */
function croisementTendances(fitA, fitB) {
  if (!fitA || !fitB || fitA.length !== fitB.length || fitA.length < 3) return null;
  const n = fitA.length;
  const penteA = (fitA[n - 1] - fitA[0]) / (n - 1);
  const penteB = (fitB[n - 1] - fitB[0]) / (n - 1);
  const dp = penteA - penteB;
  if (!dp) return null;
  const index = (fitB[0] - fitA[0]) / dp;
  if (!Number.isFinite(index) || index < 0 || index > n - 1) return null;
  return {
    index: Math.round(index * 100) / 100,
    valeur: Math.round((fitA[0] + penteA * index) * 100) / 100,
  };
}


/* ==================== Composants de base ==================== */
function Btn({ children, onClick, variant = 'solid', className = '', disabled, style, title }) {
  const base = 'rounded-xl px-4 py-2.5 font-medium text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-40';
  const styles = variant === 'solid'
    ? { backgroundColor: ACCENT, color: ACCENT_INK }
    : variant === 'outline'
    ? { backgroundColor: 'transparent', color: INK, border: `1px solid ${BORDER}` }
    : { backgroundColor: 'transparent', color: INK_SOFT };
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`${base} ${className}`} style={{ fontFamily: F_DISPLAY, ...styles, ...style }}>
      {children}
    </button>
  );
}
function Card({ children, className = '', style, ...rest }) {
  return <div className={`rounded-2xl border p-4 ${className}`} style={{ borderColor: BORDER, backgroundColor: CARD, ...style }} {...rest}>{children}</div>;
}
function Chip({ label, on, onClick }) {
  return (
    <button onClick={onClick} className="rounded-lg px-3 py-1.5 text-xs border"
      style={{ borderColor: on ? ACCENT : BORDER, backgroundColor: on ? ACCENT : 'transparent', color: on ? ACCENT_INK : INK_SOFT }}>
      {label}
    </button>
  );
}
function Empty({ children }) {
  return <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: BORDER, color: INK_SOFT }}>{children}</div>;
}
function SectionTitle({ children, sub, icone: Icone }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold flex items-center gap-2" style={{ fontFamily: F_DISPLAY }}>
        {Icone && <Icone size={20} style={{ color: INK_SOFT }} />}{children}
      </h2>
      {sub && <p className="text-sm mt-0.5" style={{ color: INK_SOFT }}>{sub}</p>}
    </div>
  );
}

/* Contexte de lecture partagé : la personne et la classe qu'on regarde, valables
   pour tous les écrans d'analyse à la fois.

   Le grief auquel il répond : la personne était choisie trois fois, dans trois
   états sans rapport — la liste de gauche de la fiche, les pastilles de l'écran
   Crises, le sujet du rapport — et les écrans Séances et Explorer n'en avaient
   même pas la notion. Passer de l'un à l'autre par le rail latéral ne reportait
   rien.

   Rendu par ManagerApp une seule fois et passé à `SelecteurPeriode`, qui
   l'insère dans sa bande collante. Ni état ni logique ici : c'est un affichage.
   Le choix de la personne rouvre la palette de commande (⌘K) plutôt que
   d'aligner une pastille par personne — sur un effectif de quinze, une rangée
   de quinze pastilles collantes mangerait le haut de chaque écran, et la
   palette est déjà le geste documenté. */
function BandeauContexte({ donnees, contexte, setContexte, onPalette }) {
  const { personne, classe } = contexte;
  const classes = donnees.classes || [];
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-t-xl border"
      style={{ backgroundColor: CARD, borderColor: BORDER, borderBottom: 'none' }}>
      <Users size={13} style={{ color: INK_SOFT }} />
      {personne ? (
        <>
          <span className="text-xs font-semibold" style={{ fontFamily: F_DISPLAY, color: ACCENT }}>
            {nomAffiche(donnees, personne)}
          </span>
          <Btn variant="ghost" onClick={onPalette} className="text-xs py-1">Changer</Btn>
          <Btn variant="ghost" onClick={() => setContexte({ ...contexte, personne: null })} className="text-xs py-1">
            Toutes les personnes
          </Btn>
        </>
      ) : (
        <>
          <span className="text-xs" style={{ color: INK_SOFT }}>Toutes les personnes</span>
          <Btn variant="ghost" onClick={onPalette} className="text-xs py-1">Choisir une personne</Btn>
        </>
      )}
      {classes.length > 0 && (
        <label className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs" style={{ color: INK_SOFT }}>Classe</span>
          <select value={classe} onChange={(e) => setContexte({ ...contexte, classe: e.target.value })}
            className="rounded-lg border px-2 py-1 text-xs bg-transparent"
            style={{ borderColor: classe ? ACCENT : BORDER, color: INK }}>
            <option value="">Toutes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

/* Sélecteur de période, partagé par tous les écrans */
/* `collant` : la carte se réduit à une bande fine posée en position sticky,
   qui reste atteignable au défilement sous les graphiques — sans lui,
   modifier la période impose de remonter en haut de l'écran à chaque fois.
   Repliée par défaut ; « Modifier » déplie le formulaire complet en dessous.
   Le panneau déplié est collant lui aussi — enveloppé dans le même bloc
   sticky que la bande, plutôt que de calculer un second décalage : plus
   simple, et ça évite qu'un réglage ouvert (comparaison + type de
   graphique + courbes) sorte du champ au premier défilement.
   `extra`/`resumeExtra` : un écran qui a d'autres réglages de vue à faire
   suivre au même endroit (type de graphique, courbes de tendance — voir
   PersonnesScreen et CrisesScreen) les passe ici plutôt que de poser un
   second bloc sticky à côté : deux bandes collantes qui s'empilent sans
   coordination sont le prochain piège, pas seulement un choix plus
   verbeux.
   Absent (RapportScreen, où le sélecteur est un champ de formulaire parmi
   d'autres, pas un filtre d'écran) : comportement d'origine, toujours
   déplié, jamais collant, `extra` ignoré.
   `bandeau` : le nœud de sélection personne/classe partagé par les écrans de
   lecture (BandeauContexte), construit une seule fois par ManagerApp. Il vit ici, dans la bande
   collante, et non dans un second bandeau posé au-dessus des écrans : cette
   bande porte déjà `no-print`, elle est déjà couverte par test_impression, et
   un bloc de plus dans la structure de page est le risque de régression n°1 à
   l'impression. Ignoré quand `!collant`, donc absent du Rapport — un document
   composé ne porte pas le contexte de lecture de l'écran. */
function SelecteurPeriode({ periode, setPeriode, avecGranularite, avecComparaison, collant, comparaisonUtile = true, extra, resumeExtra, bandeau }) {
  const p = periode;
  const maj = (champs) => setPeriode({ ...p, ...champs });
  const cmp = p.comparer;
  const majCmp = (champs) => maj({ comparer: { ...(cmp || { mode: 'precedente', debut: '', fin: '' }), ...champs } });
  const [deplie, setDeplie] = useState(!collant);

  const corps = (
    <>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[
          { k: 'raccourci', l: 'Raccourci' },
          { k: 'dates', l: 'Dates précises' },
          { k: 'mois', l: 'Mois calendaires' },
        ].map((m) => (
          <Chip key={m.k} label={m.l} on={p.mode === m.k} onClick={() => maj({ mode: m.k })} />
        ))}
        <span className="text-xs ml-auto self-center" style={{ color: INK_SOFT }}>{libellePeriode(p)}</span>
      </div>

      {p.mode === 'raccourci' && (
        <div className="flex flex-wrap gap-1.5">
          {RACCOURCIS.map((r) => <Chip key={r.k} label={r.label} on={p.jours === r.k} onClick={() => maj({ jours: r.k })} />)}
        </div>
      )}

      {p.mode === 'dates' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: INK_SOFT }}>du</span>
          <input type="date" value={p.debut} onChange={(e) => maj({ debut: e.target.value })}
            className="rounded-lg border px-2 py-1.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }} />
          <span className="text-xs" style={{ color: INK_SOFT }}>au</span>
          <input type="date" value={p.fin} onChange={(e) => maj({ fin: e.target.value })}
            className="rounded-lg border px-2 py-1.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }} />
          {(p.debut || p.fin) && <Btn variant="ghost" onClick={() => maj({ debut: '', fin: '' })} className="text-xs py-1.5">Effacer</Btn>}
        </div>
      )}

      {p.mode === 'mois' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: INK_SOFT }}>de</span>
          <input type="month" value={p.moisDebut} onChange={(e) => maj({ moisDebut: e.target.value })}
            className="rounded-lg border px-2 py-1.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }} />
          <span className="text-xs" style={{ color: INK_SOFT }}>à</span>
          <input type="month" value={p.moisFin} onChange={(e) => maj({ moisFin: e.target.value })}
            className="rounded-lg border px-2 py-1.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }} />
          {(p.moisDebut || p.moisFin) && <Btn variant="ghost" onClick={() => maj({ moisDebut: '', moisFin: '' })} className="text-xs py-1.5">Effacer</Btn>}
          <span className="text-xs w-full" style={{ color: INK_SOFT }}>
            Le mois de fin est inclus en entier — « septembre à janvier » couvre bien tout le mois de janvier.
          </span>
        </div>
      )}

      {avecGranularite && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Regrouper par</span>
          {GRANULARITES.map((g) => <Chip key={g.k} label={g.label} on={p.granularite === g.k} onClick={() => maj({ granularite: g.k })} />)}
        </div>
      )}

      {avecComparaison && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Comparer à</span>
            <Chip label="Rien" on={!cmp} onClick={() => maj({ comparer: null })} />
            <Chip label="Période précédente" on={!!cmp && cmp.mode === 'precedente'} onClick={() => majCmp({ mode: 'precedente' })} />
            <Chip label="Dates précises" on={!!cmp && cmp.mode === 'dates'} onClick={() => majCmp({ mode: 'dates' })} />
            {libelleComparaison(p) && (
              <span className="text-xs ml-auto self-center" style={{ color: INK_SOFT }}>{libelleComparaison(p)}</span>
            )}
          </div>
          {cmp && cmp.mode === 'dates' && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs" style={{ color: INK_SOFT }}>du</span>
              <input type="date" value={cmp.debut || ''} onChange={(e) => majCmp({ debut: e.target.value })}
                className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: BORDER, color: INK, backgroundColor: CARD }} />
              <span className="text-xs" style={{ color: INK_SOFT }}>au</span>
              <input type="date" value={cmp.fin || ''} onChange={(e) => majCmp({ fin: e.target.value })}
                className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: BORDER, color: INK, backgroundColor: CARD }} />
            </div>
          )}
          {/* Le réglage est proposé sur tout un écran, mais ne sert pas sous
             toutes ses sous-vues (le croisement, par exemple) : le dire
             plutôt que de laisser deviner pourquoi rien ne change. */}
          {cmp && !comparaisonUtile && (
            <p className="text-xs mt-1" style={{ color: INK_SOFT, fontStyle: 'italic' }}>
              Cette vue n'affiche pas encore d'écart avec la période de comparaison.
            </p>
          )}
        </div>
      )}
      {extra}
    </>
  );

  if (!collant) {
    return <Card className="mb-4">{corps}</Card>;
  }

  return (
    <div className="sticky top-0 z-10 mb-4 no-print">
      {bandeau}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl border"
        style={{ backgroundColor: CARD, borderColor: BORDER, borderTopLeftRadius: bandeau ? 0 : undefined, borderTopRightRadius: bandeau ? 0 : undefined }}>
        <span className="text-xs font-medium shrink-0" style={{ color: INK, fontFamily: F_MONO }}>{libellePeriode(p)}</span>
        {resumeExtra && (
          <span className="text-xs shrink-0" style={{ color: INK_SOFT }}>· {resumeExtra}</span>
        )}
        {p.mode === 'raccourci' && (
          <div className="flex flex-wrap gap-1.5">
            {RACCOURCIS.map((r) => <Chip key={r.k} label={r.label} on={p.jours === r.k} onClick={() => maj({ jours: r.k })} />)}
          </div>
        )}
        <Btn variant="ghost" onClick={() => setDeplie((d) => !d)} className="text-xs py-1 ml-auto">
          {deplie ? 'Réduire' : 'Modifier'}
        </Btn>
      </div>
      {deplie && <Card className="mt-2">{corps}</Card>}
    </div>
  );
}

/* Écart avec la période de référence, dit seulement s'il est net.
   Même double condition que `sensTendance` : un écart absolu et un écart
   relatif. Sans elle, passer de 1 crise à 2 s'annoncerait « +100 % », et
   l'écran crierait sur du bruit. En dessous du seuil on affiche « stable »,
   pas rien : l'absence de mouvement est une réponse, le silence n'en est pas
   une. `—` est réservé au cas où la référence n'existe pas. */
function Ecart({ valeur, reference, unite = '', hausseFavorable = true, className = '' }) {
  if (valeur == null || reference == null) {
    return <span className={`text-xs ${className}`} style={{ color: INK_SOFT, fontFamily: F_MONO }}>—</span>;
  }
  const delta = valeur - reference;
  const net = Math.abs(delta) >= 1 && Math.abs(delta) >= 0.25 * Math.abs(reference);
  if (!net) {
    return <span className={`text-xs ${className}`} style={{ color: INK_SOFT, fontFamily: F_MONO }}>stable</span>;
  }
  const arrondi = Math.round(delta * 10) / 10;
  const couleur = (delta > 0) === hausseFavorable ? ACQUIS : NON_ACQUIS;
  return (
    <span className={`text-xs ${className}`} style={{ color: couleur, fontFamily: F_MONO }}>
      {arrondi > 0 ? '+' : '−'}{Math.abs(arrondi)}{unite}
    </span>
  );
}

/* Bascule entre effectifs et pourcentages */
function BasculeUnite({ unite, setUnite }) {
  return (
    <div className="flex gap-1.5">
      <Chip label="Nombre" on={unite === 'nombre'} onClick={() => setUnite('nombre')} />
      <Chip label="Pourcentage" on={unite === 'pct'} onClick={() => setUnite('pct')} />
    </div>
  );
}

/* ==================== Graphiques ==================== */
const STYLES_GRAPHIQUE = [
  { k: 'ligne', label: 'Courbe' },
  { k: 'barres', label: 'Barres' },
  { k: 'aire', label: 'Aire' },
  { k: 'points', label: 'Points' },
];
/* Lectures superposables à une série. Cumulables : elles ne disent pas la même
   chose et se complètent — la droite donne le sens général, la moyenne mobile
   montre les paliers que la droite écrase, moyenne et médiane situent le
   niveau par rapport au seuil d'acquisition déjà tracé. Aucune n'est active
   par défaut : un graphique s'ouvre sur ses données, pas sur leur commentaire. */
/* Couleurs d'accent. `echantillon` pointe une variable CSS et non un hex :
   le contrôle 2 sexies de verifier.sh refuse tout hex écrit en dur ici, et
   une pastille de choix doit montrer sa couleur même quand ce n'est pas celle
   en vigueur — d'où les --swatch-* déclarés dans src/index.css. 'neutre' est
   l'absence de data-accent, pas une valeur. */
const ACCENTS = [
  { k: 'neutre', label: 'Neutre', echantillon: 'var(--swatch-neutre)' },
  { k: 'rose', label: 'Rose', echantillon: 'var(--swatch-rose)' },
  { k: 'vert', label: 'Vert', echantillon: 'var(--swatch-vert)' },
  { k: 'jaune', label: 'Jaune', echantillon: 'var(--swatch-jaune)' },
  { k: 'rouge', label: 'Rouge', echantillon: 'var(--swatch-rouge)' },
];

const COURBES_LECTURE = [
  { k: 'tendance', label: 'Tendance' },
  { k: 'mobile', label: 'Moyenne mobile' },
  { k: 'moyenne', label: 'Moyenne' },
  { k: 'mediane', label: 'Médiane' },
];
/* --- Période d'observation ---
   Trois façons de la définir : un raccourci glissant, une plage de dates au
   jour près, ou une plage de mois calendaires — « de septembre à janvier »
   ne se laisse pas exprimer en nombre de jours. */
const RACCOURCIS = [
  { k: 7, label: '7 jours' },
  { k: 30, label: '30 jours' },
  { k: 90, label: '3 mois' },
  { k: 180, label: '6 mois' },
  { k: 365, label: '1 an' },
  { k: 0, label: 'Tout' },
];
const GRANULARITES = [
  { k: 'jour', label: 'Jour' },
  { k: 'semaine', label: 'Semaine' },
  { k: 'mois', label: 'Mois' },
];

/* `comparer` : la période de référence à laquelle on oppose celle-ci, ou null.
   Deux modes — 'precedente' (même durée, juste avant) et 'dates' (une plage
   choisie, pour comparer à un trimestre précis plutôt qu'à ce qui précède).
   Elle vit dans l'objet période plutôt qu'à côté : tout ce qui reçoit déjà
   `periode` reçoit donc la comparaison sans changer de signature. */
const periodeVide = () => ({ mode: 'raccourci', jours: 30, debut: '', fin: '', moisDebut: '', moisFin: '', granularite: 'jour', comparer: null });

/* Bornes effectives, en millisecondes. null = pas de borne. */
function bornesDe(p) {
  if (!p) return { min: null, max: null };
  if (p.mode === 'dates') {
    return {
      min: p.debut ? new Date(`${p.debut}T00:00:00`).getTime() : null,
      max: p.fin ? new Date(`${p.fin}T23:59:59`).getTime() : null,
    };
  }
  if (p.mode === 'mois') {
    let min = null, max = null;
    if (p.moisDebut) min = new Date(`${p.moisDebut}-01T00:00:00`).getTime();
    if (p.moisFin) {
      const [a, m] = p.moisFin.split('-').map(Number);
      max = new Date(a, m, 0, 23, 59, 59).getTime(); // dernier jour du mois
    }
    return { min, max };
  }
  return { min: p.jours ? Date.now() - p.jours * 86400000 : null, max: null };
}
const dansPeriode = (date, p) => {
  const { min, max } = bornesDe(p);
  const t = new Date(date).getTime();
  return (min == null || t >= min) && (max == null || t <= max);
};
function libellePeriode(p) {
  if (!p) return 'Tout';
  if (p.mode === 'dates') {
    if (!p.debut && !p.fin) return 'Tout';
    const f = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR') : '…');
    return `du ${f(p.debut)} au ${f(p.fin)}`;
  }
  if (p.mode === 'mois') {
    if (!p.moisDebut && !p.moisFin) return 'Tout';
    const f = (m) => (m ? new Date(`${m}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '…');
    return `de ${f(p.moisDebut)} à ${f(p.moisFin)}`;
  }
  return (RACCOURCIS.find((r) => r.k === p.jours) || { label: 'Tout' }).label;
}

/* ==================== Période de comparaison ====================
   « Est-ce que ce qu'on met en place porte ses fruits ? » ne se lit pas sur un
   état, seulement sur un écart. D'où une seconde période, réglée une fois dans
   le sélecteur et relue partout.

   `periodeComparee` renvoie un objet période ordinaire : tout ce qui sait déjà
   filtrer avec `dansPeriode` sait donc filtrer la référence, sans code de
   filtrage en double. */
function periodeComparee(p) {
  const c = p && p.comparer;
  if (!c) return null;
  if (c.mode === 'dates') {
    if (!c.debut && !c.fin) return null;
    return { ...periodeVide(), mode: 'dates', debut: c.debut || '', fin: c.fin || '', granularite: p.granularite };
  }
  /* Période précédente de même durée. Une période ouverte d'un côté n'a pas de
     durée : sans borne basse on retombe sur 30 jours, sans borne haute c'est
     maintenant — mêmes replis que la tendance des crises, qui faisait déjà ce
     calcul dans son coin avant d'être ramenée ici. */
  const { min, max } = bornesDe(p);
  const fin = max || Date.now();
  const debut = min || (fin - 30 * 86400000);
  const duree = fin - debut;
  if (duree <= 0) return null;
  const iso = (t) => {
    const d = new Date(t);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return { ...periodeVide(), mode: 'dates', debut: iso(debut - duree), fin: iso(debut - 1), granularite: p.granularite };
}
function libelleComparaison(p) {
  const ref = periodeComparee(p);
  if (!ref) return null;
  if (p.comparer.mode === 'dates') return libellePeriode(ref);
  return `période précédente (${libellePeriode(ref)})`;
}

/* Clé d'agrégation selon la granularité choisie */
function cleAgregation(date, granularite) {
  const d = new Date(date);
  if (granularite === 'mois') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (granularite === 'semaine') {
    const x = new Date(d);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function etiquetteAgregation(cle, granularite) {
  const d = new Date(cle);
  if (granularite === 'mois') return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/* ==================== Types sans pourcentage ====================
   objectiveScoreValue ne rend un score que pour les quatre types qui
   s'expriment en pourcentage d'indépendance. Les quatre autres — occurrence,
   timer, intervalle, latence — produisaient donc zéro point dans Manager,
   alors que DatABA sait parfaitement les chiffrer. Un objectif « demandes
   spontanées » coté à l'occurrence était invisible ici.
   On rend chaque type dans son unité propre, avec le sens d'une hausse :
   plus de demandes spontanées, c'est un progrès ; plus de latence, non. */
const UNITES_BRUTES = {
  occurrence: { unite: 'occurrences', cumulable: true, hausseFavorable: true },
  timer: { unite: 'min', cumulable: true, hausseFavorable: true },
  latency: { unite: 's', cumulable: false, hausseFavorable: false },
  interval: { unite: '%', cumulable: false, hausseFavorable: true },
};

function parseHM(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/* Part du niveau cible sur le temps total observé, comme le calcule DatABA :
   relevés en direct et périodes saisies à la main s'additionnent. */
function partNiveauCible(obj, entry) {
  const c = (obj && obj.config) || {};
  const pas = c.intervalSeconds || (c.intervalMinutes || 5) * 60;
  const totaux = {};
  Object.values(entry.marks || {}).forEach((lid) => {
    if (lid) totaux[lid] = (totaux[lid] || 0) + pas;
  });
  (entry.segments || []).forEach((s) => {
    const a = parseHM(s.start);
    const b = parseHM(s.end);
    const duree = a === null || b === null || b <= a ? 0 : (b - a) * 60;
    if (duree > 0 && s.levelId) totaux[s.levelId] = (totaux[s.levelId] || 0) + duree;
  });
  const total = Object.values(totaux).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const niveaux = c.levels || [];
  const cible = c.targetLevelId || (niveaux[0] && niveaux[0].id);
  /* Sans niveau cible, il n'y a rien à mesurer. Faute de cette garde,
     `totaux[undefined] || 0` valait 0 et la fonction rendait 0 % — un snapshot
     amputé de ses niveaux se lisait donc « 0 % » puis « Non acquis », comme un
     échec, au lieu d'être écarté faute de quoi juger. */
  if (!cible) return null;
  return Math.round(((totaux[cible] || 0) / total) * 100);
}

/* Valeur d'une cotation, quel que soit son type : le pourcentage quand il
   existe, sinon la mesure brute. Renvoie null si rien n'a été relevé. */
function valeurCotation(obj, entry, guidances) {
  if (!obj || !entry) return null;
  const score = objectiveScoreValue(obj, entry, guidances);
  if (score != null) return { valeur: score, unite: '%', cumulable: false, hausseFavorable: true };

  if (obj.type === 'occurrence') {
    if (typeof entry.count !== 'number') return null;
    return { valeur: entry.count, ...UNITES_BRUTES.occurrence };
  }
  if (obj.type === 'timer') {
    if (typeof entry.elapsedMs !== 'number' || entry.elapsedMs <= 0) return null;
    return { valeur: Math.round(entry.elapsedMs / 60000), ...UNITES_BRUTES.timer };
  }
  if (obj.type === 'latency') {
    if (!Array.isArray(entry.latencies) || !entry.latencies.length) return null;
    const moy = entry.latencies.reduce((a, b) => a + b, 0) / entry.latencies.length;
    return { valeur: Math.round(moy / 100) / 10, ...UNITES_BRUTES.latency };
  }
  if (obj.type === 'interval') {
    const part = partNiveauCible(obj, entry);
    if (part == null) return null;
    return { valeur: part, ...UNITES_BRUTES.interval };
  }
  return null;
}

/* Compteur et chronomètre d'appoint, que DatABA attache à n'importe quelle
   cotation quel que soit son mode (widget `MesuresAuxiliaires`, activé par
   `config.avecCompteur` / `avecChrono`). Ce ne sont pas des scores : ils
   accompagnent la cotation sans la remplacer, et n'entrent donc ni dans
   `points` ni dans `mesures`.

   `valideA` fait foi, exactement comme dans `mesuresExport` côté DatABA : il
   distingue « pas encore mesuré » (null) de « mesuré à zéro », et lire
   `total` sans lui ferait apparaître un zéro partout où le widget n'a jamais
   servi. Rend null quand rien n'a été validé — l'appelant n'affiche alors
   rien du tout. */
function mesuresAppoint(entry) {
  const c = entry && entry.mesures && entry.mesures.compteur;
  const h = entry && entry.mesures && entry.mesures.chrono;
  const compteur = c && c.valideA ? (c.total || 0) : null;
  const secondes = h && h.valideA ? Math.round((h.elapsedMs || 0) / 1000) : null;
  if (compteur == null && secondes == null) return null;
  return { compteur, secondes };
}

/* Durée d'appoint en minutes, pour la table de faits et les mesures d'Explorer
   — les durées de suivi continu y sont déjà en minutes, mélanger les unités
   dans une même colonne d'un tableau croisé n'aurait pas de sens. */
const minutesAppoint = (m) => (m && m.secondes != null ? Math.round(m.secondes / 60) : null);

/* Libellé court d'une mesure d'appoint, pour l'afficher à côté de la cotation
   qu'elle accompagne. Les secondes restent des secondes ici : à l'échelle
   d'une cotation, arrondir 40 secondes à 1 minute perdrait la mesure. */
function libelleAppoint(m) {
  if (!m) return null;
  const bouts = [];
  if (m.compteur != null) bouts.push(`compteur ${m.compteur}`);
  if (m.secondes != null) {
    bouts.push(m.secondes >= 60
      ? `chrono ${Math.floor(m.secondes / 60)} min ${String(m.secondes % 60).padStart(2, '0')} s`
      : `chrono ${m.secondes} s`);
  }
  return bouts.join(' · ');
}

/* Détail des cotations d'une personne sur une période, au niveau de
   l'essai/étape/intervalle — pas du score agrégé de la séance
   (`construireFaits` s'arrête là). Une ligne par élément brut pour les
   quatre types qui s'y prêtent (trials, chaining, balance, interval) ; pour
   probe/occurrence/timer/latency, la donnée relevée est déjà un scalaire,
   il n'y a rien en dessous à décomposer — une ligne par cotation, comme
   `valeurCotation` la rend déjà pour ces quatre-là. `periode` filtre sur la
   date de séance, jamais sur celle d'un essai : DatABA ne date pas
   l'essai lui-même. */
function detailCotationsPersonne(donnees, personne, periode) {
  const lignes = [];
  const nomIntervenant = (source, id) => (((donnees._intervenants || {})[source] || {})[id]) || 'Non renseigné';

  donnees.seances.forEach((sess) => {
    if (!dansPeriode(sess.date, periode)) return;
    const table = (donnees._idVersInitiales || {})[sess.source] || {};
    const sid = Object.keys(table).find((k) => table[k] === personne);
    if (!sid || !(sess.studentIds || []).includes(sid)) return;

    const atelier = libelleSeance(donnees, sess);
    const intervenant = nomIntervenant(sess.source, sess.intervenantId);

    ((sess.selectedObjectives || {})[sid] || []).forEach((oid) => {
      const obj = (sess.objectiveSnapshot || {})[oid];
      const entry = (sess.data || {})[sid] && sess.data[sid][oid];
      if (!obj || !entry) return;
      /* Mesures d'appoint portées sur chaque ligne du détail, comme le fait
         déjà l'export CSV de DatABA : elles valent pour la cotation entière,
         pas pour l'essai, mais les répéter est le seul moyen de les faire
         voyager dans un tableau à plat. Vides quand rien n'a été validé. */
      const app = mesuresAppoint(entry);
      const base = {
        date: sess.date, seanceId: sess.id, atelier, intervenant,
        objectif: obj.name, code: codeEflDe(donnees, obj.name),
        type: TYPES_COTATION[obj.type] || obj.type,
        compteurAppoint: app && app.compteur != null ? app.compteur : '',
        chronoAppoint: app && app.secondes != null ? app.secondes : '',
      };

      if (obj.type === 'trials') {
        (entry.trials || []).forEach((t, i) => {
          const code = t && typeof t === 'object' ? t.code : t;
          if (!code) return;
          lignes.push({ ...base, unite: 'essai', repere: `essai ${i + 1}`, valeur: code });
        });
      } else if (obj.type === 'chaining') {
        const steps = (obj.config && obj.config.steps) || [];
        steps.forEach((st, i) => {
          const code = (entry.steps || {})[st.id];
          if (!code) return;
          lignes.push({ ...base, unite: 'étape', repere: st.name || `étape ${i + 1}`, valeur: code });
        });
      } else if (obj.type === 'balance') {
        const steps = (obj.config && obj.config.steps) || [];
        const essais = Array.isArray(entry.trials) ? entry.trials : [{ steps: entry.steps || {} }];
        essais.forEach((es, ie) => {
          steps.forEach((st, i) => {
            const e = (es.steps || {})[st.id];
            if (!e || !e.outcome) return;
            lignes.push({ ...base, unite: 'étape', repere: `essai ${ie + 1} · ${st.name || `étape ${i + 1}`}`, valeur: e.outcome });
          });
        });
      } else if (obj.type === 'interval') {
        Object.entries(entry.marks || {}).forEach(([cle, lid]) => {
          if (!lid) return;
          lignes.push({ ...base, unite: 'intervalle', repere: cle, valeur: lid });
        });
        (entry.segments || []).forEach((s) => {
          if (!s.levelId) return;
          lignes.push({ ...base, unite: 'segment saisi', repere: `${s.start || '?'}–${s.end || '?'}`, valeur: s.levelId });
        });
      } else if (obj.type === 'probe') {
        const v = entry.guidance != null ? entry.guidance : entry.value;
        if (v == null) return;
        lignes.push({ ...base, unite: 'probe', repere: libelleCreneauProbe(entry.creneau) || 'probe', valeur: v });
      } else {
        /* occurrence / timer / latency : valeur brute déjà scalaire, rien à
           décomposer en dessous — voir le commentaire de tête. */
        const m = valeurCotation(obj, entry, guidancesDe(donnees, sess.source));
        if (!m) return;
        lignes.push({ ...base, unite: m.unite, repere: 'cotation', valeur: m.valeur });
      }
    });
  });

  return lignes.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function telechargerFichier(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Même patron que les exports CSV d'Explorer et de LecteurExcel (séparateur
   `;`, guillemets doublés, BOM pour qu'Excel reconnaisse l'UTF-8) — copié
   plutôt que factorisé avec eux, comme ils le sont déjà l'un de l'autre :
   trois écrans, trois formes de lignes, rien à gagner à les faire dépendre
   d'un formateur commun. Passe par `telechargerFichier`, contrairement aux
   deux autres qui refont l'aller-retour `createObjectURL` chacun. */
function telechargerCsv(enTete, rangees, nomFichier) {
  const sep = ';';
  const echapper = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const lignesCsv = [enTete, ...rangees].map((r) => r.map(echapper).join(sep));
  telechargerFichier(new Blob(['\uFEFF' + lignesCsv.join('\n')], { type: 'text/csv;charset=utf-8' }), nomFichier);
}

/* Rasterise le graphique affiché en PNG, sans bibliothèque : on sérialise le
   SVG produit par recharts et on le repeint dans un canvas. Deux précautions —
   un fond opaque, sinon le PNG est transparent et illisible une fois collé
   dans un document ; et un facteur d'échelle, sinon l'image sort à la taille
   écran et pixellise à l'impression.
   Limite assumée : les polices Google ne sont pas embarquées dans le SVG, les
   étiquettes sortent donc dans une police système approchante. */
async function exporterGraphePng(conteneur, nomFichier) {
  const svg = conteneur && conteneur.querySelector('svg');
  if (!svg) return false;
  const boite = svg.getBoundingClientRect();
  const largeur = Math.ceil(boite.width) || 640;
  const hauteur = Math.ceil(boite.height) || 320;

  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(largeur));
  clone.setAttribute('height', String(hauteur));
  const fond = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  fond.setAttribute('width', '100%');
  fond.setAttribute('height', '100%');
  fond.setAttribute('fill', CARD);
  clone.insertBefore(fond, clone.firstChild);

  const source = new XMLSerializer().serializeToString(clone);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('svg illisible'));
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    });
  } catch (e) {
    return false;
  }

  const echelle = 2;
  const canvas = document.createElement('canvas');
  canvas.width = largeur * echelle;
  canvas.height = hauteur * echelle;
  const ctx = canvas.getContext('2d');
  ctx.scale(echelle, echelle);
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) telechargerFichier(blob, nomFichier);
      resolve();
    }, 'image/png');
  });
  return true;
}

/* Droite de tendance par moindres carrés. Renvoie la valeur ajustée pour
   chaque point, ou null si la série est trop courte pour qu'une pente ait le
   moindre sens. */
function tendanceLineaire(valeurs) {
  const n = valeurs.length;
  if (n < 3) return null;
  const sx = (n - 1) * n / 2;
  const sy = valeurs.reduce((a, v) => a + v, 0);
  const sxy = valeurs.reduce((a, v, i) => a + i * v, 0);
  const sxx = valeurs.reduce((a, _, i) => a + i * i, 0);
  const denom = n * sxx - sx * sx;
  if (!denom) return null;
  const pente = (n * sxy - sx * sy) / denom;
  const origine = (sy - pente * sx) / n;
  return valeurs.map((_, i) => Math.round((origine + pente * i) * 100) / 100);
}

/* Moyenne mobile centrée. Renvoie un tableau de même longueur, `null` là où la
   fenêtre déborde de la série — jamais une fenêtre rétrécie sur les bords :
   une moyenne « mobile » calculée sur un point isolé n'en est pas une, et la
   courbe doit s'arrêter là où le calcul s'arrête. Même principe que le segment
   de suivi non borné, qui reste de durée inconnue plutôt que d'être deviné.
   Fenêtre impaire seulement : une fenêtre paire n'a pas de centre. */
function moyenneMobile(valeurs, fenetre = 3) {
  if (!valeurs || valeurs.length < fenetre || fenetre < 3 || fenetre % 2 === 0) return null;
  const demi = (fenetre - 1) / 2;
  return valeurs.map((_, i) => {
    if (i < demi || i > valeurs.length - 1 - demi) return null;
    const tranche = valeurs.slice(i - demi, i + demi + 1);
    return Math.round((tranche.reduce((a, v) => a + v, 0) / fenetre) * 100) / 100;
  });
}

/* Médiane et moyenne d'une série, arrondies au centième. `null` en dessous de
   trois valeurs : c'est le seuil que `tendanceLineaire` applique déjà, et les
   quatre lectures doivent apparaître et disparaître ensemble plutôt que de
   laisser croire qu'une série trop courte se lit quand même. */
function medianeDe(valeurs) {
  if (!valeurs || valeurs.length < 3) return null;
  const triees = valeurs.slice().sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  const m = triees.length % 2 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
  return Math.round(m * 100) / 100;
}
function moyenneDe(valeurs) {
  if (!valeurs || valeurs.length < 3) return null;
  return Math.round((valeurs.reduce((a, v) => a + v, 0) / valeurs.length) * 100) / 100;
}

/* Sens de la tendance, dit en clair — mais seulement s'il est net.
   Un écart absolu ne suffit pas comme critère : « +0,5 crise » ne veut pas
   dire la même chose chez quelqu'un qui en fait une par semaine et chez
   quelqu'un qui en fait vingt. On exige donc les deux : au moins une crise
   d'écart sur toute la période, et au moins un quart de la moyenne. Sans
   cela, neuf semaines identiques suivies d'un unique soubresaut suffisaient
   à afficher « en hausse » — un signal d'alerte pour rien. */
function sensTendance(valeurs) {
  const ajustees = tendanceLineaire(valeurs);
  if (!ajustees) return null;
  const ecart = ajustees[ajustees.length - 1] - ajustees[0];
  const moyenne = valeurs.reduce((a, v) => a + v, 0) / valeurs.length;
  if (Math.abs(ecart) < 1 || Math.abs(ecart) < 0.25 * moyenne) return null;
  return ecart > 0 ? 'en hausse' : 'en baisse';
}

/* ==================== Moyenne par jour et évolution ====================
   Une mesure brute se lit mal séance par séance : trois cotations le même jour
   pèseraient trois fois plus qu'une seule dans la courbe et dans la tendance.
   On ramène donc chaque journée à une valeur, puis on regarde l'évolution de
   cette moyenne sur la période. */
function moyennesParJour(mesures) {
  const parJour = new Map();
  mesures.forEach((m) => {
    const cle = cleAgregation(m.date, 'jour');
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle).push(m.value);
  });
  return Array.from(parJour.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cle, valeurs]) => ({
      date: new Date(cle).toISOString(),
      value: Math.round((valeurs.reduce((a, v) => a + v, 0) / valeurs.length) * 10) / 10,
      seances: valeurs.length,
    }));
}

/* En dessous de ce nombre de journées, annoncer « +35 % » serait donner un
   chiffre à du bruit. On affiche alors la moyenne, sans progression. */
const MIN_JOURS_EVOLUTION = 5;

/* Évolution exprimée en pourcentage. On compare les deux extrémités de la
   droite de tendance et non la première et la dernière valeur : un jour
   exceptionnel à l'un des bouts suffirait sinon à inverser le sens.
   Une moyenne de départ nulle n'a pas de pourcentage — le rapport serait une
   division par zéro. On rend alors les deux valeurs, à dire en clair. */
function evolutionMoyenne(journalieres) {
  if (journalieres.length < MIN_JOURS_EVOLUTION) return null;
  const ajustees = tendanceLineaire(journalieres.map((j) => j.value));
  if (!ajustees) return null;
  const arrondi = (x) => Math.round(x * 10) / 10;
  const depart = ajustees[0];
  const arrivee = ajustees[ajustees.length - 1];
  return {
    depart: arrondi(depart),
    arrivee: arrondi(arrivee),
    pct: depart > 0 ? Math.round(((arrivee - depart) / depart) * 100) : null,
    jours: journalieres.length,
  };
}

/* Imprime une seule zone de l'écran — la chronologie des crises, les courbes
   d'une personne — telle qu'elle est réglée, sans passer par l'onglet Rapport.
   On marque la cible et toute la chaîne de ses ancêtres ; la feuille de style
   masque alors, à chaque niveau, les frères qui ne mènent pas à elle.
   Les classes sont posées directement sur les nœuds plutôt que par un état
   React : window.print() s'exécute dans le même tour de boucle que le clic, un
   rendu React n'aurait pas encore eu lieu au moment de l'impression.
   Le nettoyage passe par afterprint, avec un délai de secours pour les
   navigateurs qui ne l'émettent pas, et couvre aussi l'annulation. */
function imprimerZone(element) {
  if (!element) return false;
  const ancetres = [];
  let n = element.parentElement;
  while (n && n !== document.body) {
    n.classList.add('chemin-impression');
    ancetres.push(n);
    n = n.parentElement;
  }
  document.body.classList.add('chemin-impression', 'impression-ciblee');
  element.classList.add('zone-impression');

  let fait = false;
  const nettoyer = () => {
    if (fait) return;
    fait = true;
    element.classList.remove('zone-impression');
    ancetres.forEach((a) => a.classList.remove('chemin-impression'));
    document.body.classList.remove('chemin-impression', 'impression-ciblee');
    window.removeEventListener('afterprint', nettoyer);
  };
  window.addEventListener('afterprint', nettoyer);
  window.print();
  setTimeout(nettoyer, 2000);
  return true;
}

/* Nom de fichier sans caractère qui gêne un système de fichiers */
const nomSain = (s) => String(s || '').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'graphique';

/* Repères de changement de phase, même règle que DatABA (ObjectiveChart) : la
   verticale se pose sur le premier point postérieur au changement, seul point
   de la courbe où elle est lisible. Deux cas rendent zéro repère plutôt qu'un
   repère faux — la première entrée de l'historique n'est pas datée (c'est la
   phase d'origine, elle ne marque aucun changement), et un changement
   postérieur au dernier point coté n'a rien à marquer sur cette période.
   L'index plutôt que l'étiquette : la mise en forme des étiquettes appartient
   au graphique, pas au calcul. */
function reperesDePhase(points, historique) {
  return (historique || [])
    .filter((ph) => ph && ph.date)
    .map((ph) => {
      const index = (points || []).findIndex((p) => new Date(p.date) >= new Date(ph.date));
      return index < 0 ? null : { id: ph.id, name: ph.name, repere: !!ph.repere, index };
    })
    .filter(Boolean);
}

/* Position et empilement des étiquettes de repère, même règle que DatABA
   (src/App.jsx, ObjectiveChart) : une estimation à 5,6 px/caractère (IBM Plex
   Sans, 10 px) rapportée à une largeur de tracé de référence de 360 px, sans
   mesure réelle du SVG rendu — Manager en affiche plusieurs tailles (180 px
   dans les cartes, 300 ou 70vh en plein écran), aucune ne descend sous cette
   référence. Le compromis assumé : basculer un peu trop tôt sur deux lignes
   sur un grand graphique plutôt que laisser deux noms se chevaucher sur un
   petit. */
const LARGEUR_TRACE_REF = 360;
const PX_PAR_CARACTERE = 5.6;
function placerEtiquettesReperes(reperes, nbPoints) {
  const dernierParLigne = [null, null];
  return reperes.map((r) => {
    const texte = r.name.length > 18 ? `${r.name.slice(0, 17)}…` : r.name;
    const demi = Math.min(0.45, (texte.length * PX_PAR_CARACTERE) / 2 / LARGEUR_TRACE_REF);
    const pos = nbPoints > 1 ? r.index / (nbPoints - 1) : 0.5;
    const ancre = pos - demi < 0 ? 'start' : pos + demi > 1 ? 'end' : 'middle';
    const debut = ancre === 'start' ? pos : ancre === 'end' ? pos - 2 * demi : pos - demi;
    const fin = ancre === 'start' ? pos + 2 * demi : ancre === 'end' ? pos : pos + demi;
    let ligne = 0;
    if (dernierParLigne[0] != null && debut < dernierParLigne[0]) ligne = 1;
    if (ligne === 1 && dernierParLigne[1] != null && debut < dernierParLigne[1]) ligne = 0;
    dernierParLigne[ligne] = fin;
    return { ...r, texte, ancre, ligne };
  });
}

/* Un seul ComposedChart pour les quatre styles, au lieu de quatre conteneurs
   distincts : Recharts refuse une <Line> dans un BarChart ou un ScatterChart,
   donc superposer une courbe de lecture imposait de toute façon ce
   regroupement. ApercuCrises fait déjà exactement ça pour ses barres et sa
   tendance. */
function Graphique({ points, style, seuil, hauteur = 220, unite = '%', courbes = [], phases = [] }) {
  const valeurs = points.map((p) => p.value);
  const actif = (k) => courbes.includes(k);
  /* Les quatre lectures partagent le seuil de trois points de tendanceLineaire :
     elles apparaissent et disparaissent ensemble plutôt que d'en laisser une
     seule donner un chiffre à du bruit. */
  const tendance = actif('tendance') ? tendanceLineaire(valeurs) : null;
  const mobile = actif('mobile') ? moyenneMobile(valeurs) : null;
  const moyenne = actif('moyenne') ? moyenneDe(valeurs) : null;
  const mediane = actif('mediane') ? medianeDe(valeurs) : null;
  const avecLegende = !!(tendance || mobile);

  const donnees = points.map((p, i) => ({
    label: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      + (libelleCreneauProbe(p.creneau) ? ` (${libelleCreneauProbe(p.creneau)})` : ''),
    valeur: p.value,
    Tendance: tendance ? tendance[i] : null,
    'Moyenne mobile': mobile ? mobile[i] : null,
  }));
  /* Un pourcentage se lit toujours sur 0-100 : borner l'axe évite de faire
     passer une variation de trois points pour un bouleversement. Une mesure
     brute — occurrences, minutes, secondes — n'a pas de maximum connu, on
     laisse alors recharts choisir l'échelle. */
  const enPourcent = unite === '%';
  const etiquette = enPourcent ? 'Résultat' : 'Moyenne du jour';
  const reperes = placerEtiquettesReperes(reperesDePhase(points, phases), points.length);
  const deuxLignes = reperes.some((r) => r.ligne === 1);
  /* Le nom de phase se pose au-dessus de la verticale : sans marge haute, il
     sort du cadre sur les graphiques courts du rapport imprimé. */
  const marge = { top: reperes.length ? (deuxLignes ? 32 : 20) : 8, right: 8, bottom: 4, left: -14 };
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={donnees} margin={marge}>
          <CartesianGrid stroke={BORDER} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis domain={enPourcent ? [0, 100] : [0, 'auto']} allowDecimals={!enPourcent}
            tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: INK, fontFamily: F_BODY, fontSize: 12 }}
            formatter={(v, nom) => [`${v} ${unite}`, nom]} />
          {seuil != null && <ReferenceLine y={seuil} stroke={ACQUIS} strokeDasharray="4 4" strokeWidth={1.5} />}
          {/* Changements de phase : des verticales, en encre du thème et non en
              accent — elles datent le suivi, elles ne désignent pas un état.
              Même tracé que sur la courbe de DatABA, pour qu'un éducateur et
              un cadre lisent le même graphique. Tirets longs pour un
              changement de phase, pointillé fin pour un repère de procédure :
              même encre pour les deux, aucune couleur ajoutée — lisible en
              thème sombre comme à l'impression. */}
          {reperes.map((r) => (
            <ReferenceLine key={r.id} x={donnees[r.index].label}
              stroke={r.repere ? INK_SOFT : INK}
              strokeDasharray={r.repere ? '1 3' : '5 3'}
              strokeWidth={r.repere ? 1 : 1.5}
              label={({ viewBox }) => (
                <text
                  x={viewBox.x + (r.ancre === 'start' ? 2 : r.ancre === 'end' ? -2 : 0)}
                  y={viewBox.y - (r.ligne ? 17 : 6)}
                  textAnchor={r.ancre}
                  fontSize={10}
                  fontFamily={F_BODY}
                  fill={r.repere ? INK_SOFT : INK}
                >{r.texte}</text>
              )}
            />
          ))}
          {/* Moyenne et médiane sont des horizontales : ReferenceLine, le même
              primitif que le seuil, plutôt qu'une série constante de plus. */}
          {moyenne != null && (
            <ReferenceLine y={moyenne} stroke={INK_SOFT} strokeDasharray="2 3" strokeWidth={1.5}
              label={{ value: `moy. ${moyenne}`, position: 'insideTopLeft', fontSize: 10, fill: INK_SOFT }} />
          )}
          {mediane != null && (
            <ReferenceLine y={mediane} stroke={INK_SOFT} strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: `méd. ${mediane}`, position: 'insideBottomLeft', fontSize: 10, fill: INK_SOFT }} />
          )}
          {/* Série de données en bleu, pas en encre du thème : l'encre suit le
              texte, donc quasi blanche en thème sombre, et la courbe de
              tendance — tracée en encre elle aussi — s'y confondait purement
              et simplement. Chaque élément de ce graphique porte désormais sa
              propre teinte, indépendante du thème.
              `name` explicite : sans lui la légende afficherait la clé brute
              « valeur » à côté des lectures, qui portent déjà leur nom. */}
          {style === 'barres' ? (
            <Bar dataKey="valeur" name={etiquette} fill={CAT_INDIGO} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ) : style === 'aire' ? (
            <Area type="monotone" dataKey="valeur" name={etiquette} stroke={CAT_INDIGO} fill={CAT_INDIGO} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
          ) : style === 'points' ? (
            <Scatter dataKey="valeur" name={etiquette} fill={CAT_INDIGO} isAnimationActive={false} />
          ) : (
            <Line type="monotone" dataKey="valeur" name={etiquette} stroke={CAT_INDIGO} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          )}
          {/* Teintes distinctes de la série et du seuil. Ambre plutôt que cyan
              pour la moyenne mobile : le cyan est trop proche du teal du seuil
              d'acquisition. La chronologie des crises, elle, garde ses lectures
              en encre — ses séries occupent déjà cette palette, voir BlocsCrise. */}
          {tendance && <Line type="linear" dataKey="Tendance" stroke={CAT_VIOLET} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
          {mobile && <Line type="monotone" dataKey="Moyenne mobile" stroke={CAT_AMBER} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />}
          {avecLegende && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Modale plein écran d'un graphique, partagée entre la fiche personne
   (CarteObjectif) et la chronologie de crises (BlocsCrise) : un
   agrandissement qui se contentait de changer la hauteur d'une carte
   n'ouvrait sur rien de plus que ce qui était déjà visible autour. Un seul
   composant plutôt que deux implémentations qui se ressembleraient sans
   être partagées — le risque de divergence documenté dans CLAUDE.md pour
   tout ce qui ressemble à BlocsCrise sans en être.
   Reprend le patron de PaletteCommande (`fixed inset-0 z-50`, fond
   `OVERLAY_BACKDROP`, clic dehors pour fermer) avec sa propre écoute
   Échap : indépendante de celle de ManagerApp, qui ne gère que la palette
   de commande et les raccourcis d'onglets, montée seulement tant que la
   modale l'est.
   `styleOptions`/`style`/`onStyle` et `courbes`/`onBasculerCourbe` sont
   optionnels : la chronologie de crises n'a que deux styles, le bilan
   d'objectif quatre — au lieu d'un menu fixé une fois pour toutes, chaque
   appelant passe ses propres options et son propre état, la modale ne fait
   qu'afficher les contrôles déjà en vigueur sur l'écran d'où elle vient. */
function GrapheAgrandi({ titre, sousTitre, styleOptions, style, onStyle, courbes, onBasculerCourbe, onExporterPng, onFermer, children }) {
  useEffect(() => {
    const surTouche = (e) => { if (e.key === 'Escape') onFermer(); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 no-print"
      style={{ backgroundColor: OVERLAY_BACKDROP }} onClick={onFermer}>
      <div className="w-full max-w-5xl rounded-2xl border overflow-hidden shadow-lg flex flex-col"
        style={{ backgroundColor: CARD, borderColor: BORDER, maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2" style={{ borderColor: BORDER }}>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ fontFamily: F_DISPLAY }}>{titre}</div>
            {sousTitre && <div className="text-xs" style={{ color: INK_SOFT }}>{sousTitre}</div>}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {styleOptions && styleOptions.map((g) => (
              <Chip key={g.k} label={g.label} on={style === g.k} onClick={() => onStyle(g.k)} />
            ))}
            {onExporterPng && (
              <Btn variant="outline" className="text-xs py-1.5" onClick={onExporterPng}><Download size={13} /> PNG</Btn>
            )}
            <Btn variant="ghost" className="text-xs py-1.5" onClick={onFermer}>Fermer</Btn>
          </div>
        </div>
        {courbes && (
          <div className="px-4 py-2 border-b flex flex-wrap items-center gap-1.5" style={{ borderColor: BORDER }}>
            <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Superposer</span>
            {COURBES_LECTURE.map((c) => (
              <Chip key={c.k} label={c.label} on={courbes.includes(c.k)} onClick={() => onBasculerCourbe(c.k)} />
            ))}
          </div>
        )}
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* Aperçu minuscule, sans axes : lisible d'un coup d'œil dans une liste */
/* `enPourcent` borne l'axe à [0, 100] pour une série de pourcentages ; une
   mesure brute (occurrences, minutes) n'a pas cette borne — un domaine figé
   écrasait la courbe sur la ligne du bas ou la faisait sortir du cadre. */
function MiniGraphe({ points, couleur, enPourcent = true }) {
  const donnees = points.map((p, i) => ({ i, v: p.value }));
  return (
    <div style={{ height: 40, width: 110 }} className="shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={donnees} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis domain={enPourcent ? [0, 100] : ['auto', 'auto']} hide />
          <Line type="monotone" dataKey="v" stroke={couleur} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Radar : quels objectifs sont travaillés, et à quel niveau */
/* Une seule série ne répondait à rien : le dernier résultat de chaque
   objectif est une photo, pas une évolution. Avec une période de comparaison
   réglée (voir periodeComparee), une seconde série superpose le dernier
   résultat de la même période de référence — la forme qui se creuse ou se
   remplit d'un contour à l'autre montre ce qui a bougé. Sans comparaison
   réglée, une seule série : le comportement d'origine reste le repli. */
function RadarObjectifs({ lignes, lignesRef, libelleRef, hauteur = 320 }) {
  const tronque = (nom) => (nom.length > 22 ? `${nom.slice(0, 20)}…` : nom);
  const dernier = (l) => (l.points.length ? l.points[l.points.length - 1].value : null);
  const refDe = (objectif) => (lignesRef || []).find((l) => l.objectif === objectif);

  const donnees = lignes
    .filter((l) => l.points.length)
    .map((l) => {
      const ref = refDe(l.objectif);
      return {
        objectif: tronque(l.objectif),
        niveau: dernier(l),
        seances: l.points.length,
        reference: ref && ref.points.length ? dernier(ref) : null,
      };
    });
  if (donnees.length < 3) {
    return <p className="text-xs text-center py-8" style={{ color: INK_SOFT }}>Le radar demande au moins trois objectifs cotés sur la période.</p>;
  }
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={donnees} outerRadius="70%">
          <PolarGrid stroke={BORDER} />
          <PolarAngleAxis dataKey="objectif" tick={{ fontSize: 10, fill: INK_SOFT }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: INK_SOFT }} />
          {lignesRef && (
            <Radar name={libelleRef || 'Période de référence'} dataKey="reference" stroke={INK_SOFT} fill={INK_SOFT} fillOpacity={0.12} strokeDasharray="4 3" isAnimationActive={false} />
          )}
          <Radar name="Dernier résultat" dataKey="niveau" stroke={ACCENT} fill={ACCENT} fillOpacity={0.25} isAnimationActive={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: INK, fontFamily: F_BODY, fontSize: 12 }}
            formatter={(v, n, entree) => [v == null ? '—' : (entree.dataKey === 'niveau' ? `${v} % · ${entree.payload.seances} séances` : `${v} %`), n]} />
          {lignesRef && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ==================== Écran de verrouillage ==================== */
function LockScreen({ security, onUnlock, onSetup, onFailedAttempt }) {
  const [step, setStep] = useState(security.pinHash ? 'enter' : 'create1');
  const [premier, setPremier] = useState('');
  const [valeur, setValeur] = useState('');
  const [erreur, setErreur] = useState('');
  const [now, setNow] = useState(Date.now());
  const [reset, setReset] = useState(false);

  const bloqueJusqua = security.lockUntil || 0;
  const attente = bloqueJusqua > now;

  useEffect(() => {
    if (!attente) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [attente]);

  async function valider() {
    if (attente || valeur.length < 4) return;
    if (step === 'enter') {
      const hash = await hashPin(valeur, security.pinSalt);
      if (hash === security.pinHash) { onUnlock(valeur); return; }
      const failed = (security.failedAttempts || 0) + 1;
      const delai = lockDelayMs(failed);
      onFailedAttempt(failed, delai ? Date.now() + delai : 0);
      setErreur(delai ? 'Mot de passe incorrect — saisie suspendue' : 'Mot de passe incorrect');
      setValeur('');
      setTimeout(() => setErreur(''), 1500);
      return;
    }
    if (step === 'create1') { setPremier(valeur); setValeur(''); setStep('create2'); return; }
    if (valeur !== premier) {
      setErreur('Les deux saisies ne correspondent pas');
      setPremier(''); setValeur(''); setStep('create1');
      setTimeout(() => setErreur(''), 1800);
      return;
    }
    const salt = newSalt();
    const hash = await hashPin(valeur, salt);
    await onSetup(hash, salt, valeur);
  }

  const titres = { enter: attente ? 'Saisie suspendue' : 'DatABA Manager', create1: 'Protéger ce poste', create2: 'Confirmez' };
  const sous = {
    enter: attente ? `Nouvel essai possible dans ${Math.ceil((bloqueJusqua - now) / 1000)} s.` : 'Saisissez votre mot de passe',
    create1: "Ce mot de passe verrouille l'accès et chiffre les données consolidées sur cet ordinateur.",
    create2: 'Ressaisissez le même mot de passe',
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAPER, fontFamily: F_BODY }}>
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-center mb-1" style={{ fontFamily: F_DISPLAY, color: INK }}>{titres[step]}</h1>
        <p className="text-sm text-center mb-5" style={{ color: INK_SOFT }}>{sous[step]}</p>
        {erreur && <p className="text-sm text-center mb-3" style={{ color: NON_ACQUIS }}>{erreur}</p>}
        <input type="password" value={valeur} autoFocus disabled={attente}
          onChange={(e) => setValeur(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') valider(); }}
          placeholder="Mot de passe"
          className="w-full rounded-xl border px-3 py-3 text-base bg-transparent mb-3"
          style={{ borderColor: BORDER, color: INK }} />
        <Btn onClick={valider} disabled={attente || valeur.length < 4} className="w-full">
          {step === 'enter' ? 'Déverrouiller' : step === 'create1' ? 'Continuer' : 'Valider'}
        </Btn>
        <p className="text-xs text-center mt-3" style={{ color: INK_SOFT }}>Au moins 4 caractères.</p>

        {step === 'enter' && (
          <div className="text-center mt-6">
            <button onClick={() => setReset(true)} className="text-xs underline" style={{ color: INK_SOFT }}>Mot de passe oublié ?</button>
          </div>
        )}
        {reset && (
          <Card className="mt-4">
            <p className="text-sm mb-3" style={{ color: INK_SOFT }}>
              Les données consolidées sont chiffrées avec ce mot de passe : sans lui, elles ne sont pas
              récupérables. Vous pouvez effacer celles de Manager et réimporter les sauvegardes depuis
              le dossier partagé. <strong>DatABA n'est pas touchée.</strong>
            </p>
            <div className="flex gap-2">
              <Btn onClick={() => { effacerDonneesManager().then(() => window.location.reload()); }} className="flex-1 text-sm" style={{ backgroundColor: NON_ACQUIS, color: texteLisibleSur(NON_ACQUIS) }}>
                Effacer et recommencer
              </Btn>
              <Btn variant="ghost" onClick={() => setReset(false)} className="text-sm">Annuler</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ==================== Stockage : ce qui se voit ====================
   Trois textes pour trois causes distinctes. Les confondre en un « erreur
   d'enregistrement » ne dit pas quoi faire : le quota se règle en purgeant
   ou en exportant, un stockage refusé se règle dans le navigateur. */
const RAISONS_STOCKAGE = {
  quota: {
    titre: "Le stockage de ce navigateur est plein",
    detail: "Le bloc consolidé dépasse ce que ce poste accepte de conserver. Exportez vos données maintenant, puis purgez les séances les plus anciennes depuis Gestion.",
  },
  relecture: {
    titre: "Ce navigateur n'a rien conservé",
    detail: "L'écriture a été acceptée puis relue vide. C'est le comportement d'une fenêtre de navigation privée, ou d'un poste réglé pour effacer les données de site. Exportez vos données avant de fermer.",
  },
  stockage: {
    titre: "Le stockage de ce navigateur est refusé",
    detail: "Ni IndexedDB ni le stockage local n'acceptent d'écrire. Vérifiez que les données de site ne sont pas bloquées pour cette adresse. Exportez vos données avant de fermer.",
  },
  chiffrement: {
    titre: "Le chiffrement du bloc a échoué",
    detail: "Les données n'ont pas pu être préparées pour l'enregistrement. Exportez-les avant de fermer.",
  },
};

/* Bandeau permanent tant que la dernière écriture a échoué. Il ne se ferme
   pas : le seul geste utile est d'exporter, et une croix transformerait un
   avertissement en dérangement à faire taire. */
function BandeauStockage({ etat }) {
  if (!etat || etat.ok) return null;
  const r = RAISONS_STOCKAGE[etat.raison] || RAISONS_STOCKAGE.stockage;
  return (
    <div className="no-print rounded-xl border px-4 py-3 mb-4"
      role="alert"
      style={{ borderColor: NON_ACQUIS, backgroundColor: NON_ACQUIS, color: texteLisibleSur(NON_ACQUIS), printColorAdjust: 'exact' }}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold" style={{ fontFamily: F_DISPLAY }}>
            {r.titre} — rien n'est enregistré
          </div>
          <p className="text-xs mt-1">
            {r.detail} Tout ce qui est à l'écran disparaîtra à la fermeture de l'application.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Écran bloquant : un bloc est stocké mais illisible. Deux causes, deux
   issues — et surtout, aucune écriture entre-temps. */
function EcranBlocIllisible({ etat, securite }) {
  const dechiffrement = etat.raison === 'dechiffrement';
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAPER, fontFamily: F_BODY }}>
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-center mb-1" style={{ fontFamily: F_DISPLAY, color: INK }}>
          Données consolidées illisibles
        </h1>
        <p className="text-sm text-center mb-5" style={{ color: INK_SOFT }}>
          {dechiffrement
            ? 'Un bloc est bien stocké sur ce poste, mais il ne se déchiffre pas avec ce mot de passe.'
            : "Le stockage de ce navigateur n'a pas répondu à la lecture."}
        </p>
        <Card className="mb-3">
          <p className="text-sm" style={{ color: INK_SOFT }}>
            <strong style={{ color: INK }}>Rien n'a été écrit.</strong> L'enregistrement est suspendu tant que
            ce bloc n'est pas lu : si le problème est passager — un stockage momentanément
            indisponible — les données sont toujours là et rouvrir suffit.
            {dechiffrement && securite && !securite.disabled
              ? " Si le mot de passe de ce poste a été changé depuis, c'est l'ancien qui déchiffre ce bloc."
              : ''}
          </p>
        </Card>
        <Btn onClick={() => window.location.reload()} className="w-full mb-2">Réessayer</Btn>
        <Btn variant="ghost"
          onClick={() => {
            if (!window.confirm("Effacer le bloc illisible et repartir de zéro ?\n\nSes données ne seront pas récupérables sur ce poste. Les tablettes DatABA ne sont pas touchées : une réimportation depuis le dossier partagé reste possible.\n\nSuppression définitive.")) return;
            effacerDonneesManager().then(() => window.location.reload());
          }}
          className="w-full text-sm" style={{ color: NON_ACQUIS }}>
          Effacer et repartir de zéro
        </Btn>
      </div>
    </div>
  );
}

function tailleLisible(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} caractères`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

/* État de l'enregistrement, en clair et à demeure. Ce qu'un poste qui perd
   ses imports ne disait nulle part : où le bloc est écrit, ce qu'il pèse,
   quand la dernière écriture a réussi, et si le navigateur s'engage à ne pas
   l'évincer. */
function CarteStockage({ etat, persistant }) {
  const ou = etat && etat.ok
    ? (etat.ou === 'indexeddb' ? 'IndexedDB (sans plafond de 5 Mo)' : 'stockage local du navigateur (plafonné à ~5 Mo)')
    : null;
  const r = etat && !etat.ok ? (RAISONS_STOCKAGE[etat.raison] || RAISONS_STOCKAGE.stockage) : null;
  return (
    <Card className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers size={16} style={{ color: INK_SOFT }} />
        <span className="text-sm font-semibold" style={{ fontFamily: F_DISPLAY }}>Enregistrement sur ce poste</span>
      </div>
      {r ? (
        <p className="text-xs mb-3 rounded-lg px-2.5 py-2"
          style={{ color: texteLisibleSur(NON_ACQUIS), backgroundColor: NON_ACQUIS, printColorAdjust: 'exact' }}>
          <strong>{r.titre}.</strong> {r.detail}
        </p>
      ) : (
        <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Les données consolidées sont écrites à chaque modification, puis relues pour vérifier
          qu'elles sont bien là. Une écriture qui échoue n'est plus passée sous silence.
        </p>
      )}
      <dl className="text-xs" style={{ color: INK_SOFT }}>
        <div className="flex justify-between gap-3 py-1" style={{ borderTop: `1px solid ${BORDER}` }}>
          <dt>Dernière écriture</dt>
          <dd style={{ color: INK }}>
            {!etat ? 'aucune depuis l\'ouverture'
              : etat.ok ? `réussie à ${new Date(etat.quand).toLocaleTimeString('fr-FR')}`
                : `échouée à ${new Date(etat.quand).toLocaleTimeString('fr-FR')}`}
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-1" style={{ borderTop: `1px solid ${BORDER}` }}>
          <dt>Emplacement</dt>
          <dd className="text-right" style={{ color: INK }}>{ou || 'aucun — rien n\'est conservé'}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1" style={{ borderTop: `1px solid ${BORDER}` }}>
          <dt>Taille du bloc</dt>
          <dd style={{ color: INK }}>{tailleLisible(etat && etat.taille)}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1" style={{ borderTop: `1px solid ${BORDER}` }}>
          <dt>Conservation garantie</dt>
          <dd className="text-right" style={{ color: INK }}>
            {persistant === true ? 'oui, accordée par le navigateur'
              : persistant === false ? 'non — le navigateur peut effacer sous pression disque'
                : 'inconnue sur ce navigateur'}
          </dd>
        </div>
      </dl>
      {persistant === false && (
        <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
          Un poste réglé pour effacer les données de site à la fermeture les effacera malgré cet
          enregistrement. Un export régulier reste la seule sauvegarde qui ne dépend pas du navigateur.
        </p>
      )}
    </Card>
  );
}

/* ==================== Tableau de bord ==================== */
/* `unite` vient de ManagerApp et non d'un useState local : les onglets sont
   montés conditionnellement, un état local d'écran ne survit pas à un
   aller-retour et le choix « pourcentage » repassait en « nombre » tout seul. */
function TableauDeBord({ donnees, lignes, periode, setPeriode, unite, setUnite, contexte, bandeau, onOuvrirPersonne, onOuvrirCrises }) {
  const [etatOuvert, setEtatOuvert] = useState(null);
  /* Replié quand des prioritaires occupent déjà l'écran, déplié sinon :
     la liste doit rester le sujet principal de la page. */
  const [autresOuverts, setAutresOuverts] = useState(false);

  /* Une ligne survit dès que l'une des deux séries a un point sur la période —
     `mesures` était jusqu'ici jamais filtré, une ligne en mesure brute
     (occurrences, minutes, suivi continu promu en objectif) affichait tout son
     historique quelle que soit la période choisie, avant d'être jetée juste en
     dessous faute de `points`. */
  /* Le contexte partagé resserre l'écran sur une personne ou une classe. Sans
     lui, cet écran était une liste plate de tous les objectifs de tout le
     monde, sans aucun filtre : à quinze personnes et dix objectifs, la seule
     façon de répondre à « où en est cette personne » était de changer d'écran. */
  const dansLeContexte = (initiales) => {
    if (contexte.personne && initiales !== contexte.personne) return false;
    if (contexte.classe) {
      const p = (donnees.personnes || []).find((x) => x.initials === initiales);
      if (!p || p.classeId !== contexte.classe) return false;
    }
    return true;
  };
  const recentes = lignes
    .filter((l) => dansLeContexte(l.initials))
    .map((l) => filtrerLignePeriode(l, periode))
    .filter((l) => l.points.length > 0 || l.mesures.length > 0);
  /* Deux listes distinctes plutôt qu'un titre qui bascule. Auparavant, dès
     qu'un objectif prioritaire existait sur la période, les autres
     disparaissaient et l'intitulé changeait tout seul : d'un appareil à
     l'autre, selon les séances importées, le même écran s'appelait tantôt
     « Objectifs prioritaires » tantôt « Objectifs travaillés » sans que rien
     ne l'explique. Les deux groupes sont désormais toujours nommés. */
  const rang = { bientot: 0, plateau: 1, en_cours: 2, dormant: 3, acquis: 4, mesure: 5, non_acquis: 6 };
  const parEtat = (a, b) => rang[a.etat] - rang[b.etat];
  const prioritaires = recentes.filter((l) => l.prioritaire).sort(parEtat);
  const autres = recentes.filter((l) => !l.prioritaire).sort(parEtat);

  const crises = (donnees.crises || []).filter((c) => (c.kind || 'crise') === 'crise'
    && dansLeContexte(((donnees._idVersInitiales || {})[c.source] || {})[c.studentId]));
  const recentesCrises = crises.filter((c) => dansPeriode(c.date, periode));

  /* Période de référence : celle réglée dans le sélecteur si elle l'est, sinon
     la précédente de même durée — le repli d'origine, désormais calculé par
     periodeComparee plutôt qu'ici en double. */
  const reference = periodeComparee(periode) || periodeComparee({ ...periode, comparer: { mode: 'precedente' } });
  const precedentes = reference ? crises.filter((c) => dansPeriode(c.date, reference)) : [];
  const tendance = precedentes.length
    ? Math.round(((recentesCrises.length - precedentes.length) / precedentes.length) * 100)
    : null;

  const compter = (l) => {
    const m = new Map();
    l.forEach((v) => m.set(v, (m.get(v) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const topComportement = compter(recentesCrises.flatMap((c) => c.comportementTags || []))[0];
  const topAntecedent = compter(recentesCrises.flatMap((c) => c.antecedentTags || []))[0];
  const notees = recentesCrises.filter((c) => c.intensite);
  const intensiteMoy = notees.length
    ? Math.round((notees.reduce((a, c) => a + c.intensite, 0) / notees.length) * 10) / 10
    : null;
  /* Compté sur `recentes`, comme tout le reste de l'écran. Sur `lignes` brut,
     les sept pastilles et leur liste dépliée ignoraient le sélecteur de
     période posé juste au-dessus d'elles : à sept jours, les pastilles
     annonçaient cent objectifs quand la liste en dessous en montrait
     cinquante, et cliquer une pastille ouvrait des objectifs absents de cette
     liste. */
  const compte = (e) => recentes.filter((l) => l.etat === e).length;
  /* Nombre de cotations d'une ligne, quelle que soit la série qui les porte :
     un objectif suivi en mesure brute (occurrences, minutes) n'a pas de
     `points` et s'affichait « 0 séance » alors qu'il en portait des dizaines. */
  const nbCotations = (l) => l.points.length + l.mesures.length;

  /* Sans séance, il n'y a pas d'objectif à situer — mais un import de relevés
     de suivi seuls n'est pas un import raté : le dire, plutôt que de renvoyer
     vers un import qui vient d'avoir lieu. */
  if (!donnees.seances.length) {
    const avecReleves = (donnees.suivi || []).length + (donnees.stabilite || []).length > 0;
    return (
      <Empty>
        {avecReleves
          ? 'Aucune séance importée : le tableau de bord suit les objectifs cotés. Les relevés de suivi continu se lisent dans Personnes accompagnées.'
          : "Importez une sauvegarde DatABA depuis l'onglet Gestion pour commencer."}
      </Empty>
    );
  }

  return (
    <div>
      <SelecteurPeriode periode={periode} setPeriode={setPeriode} avecComparaison collant bandeau={bandeau} />

      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>Vue d'ensemble</span>
        <BasculeUnite unite={unite} setUnite={setUnite} />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Card>
          <div className="flex items-center gap-1.5 mb-3">
            <Target size={14} style={{ color: INK_SOFT }} />
            <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>Objectifs suivis</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['acquis', 'bientot', 'plateau', 'en_cours', 'dormant', 'mesure', 'non_acquis'].map((e) => {
              const n = compte(e);
              const tot = recentes.length || 1;
              const on = etatOuvert === e;
              return (
                <button key={e} onClick={() => setEtatOuvert(on ? null : e)} disabled={!n}
                  className="min-w-[74px] px-2.5 py-1.5 text-center disabled:opacity-40"
                  style={{ borderBottom: `2px solid ${on ? ETATS[e].color : 'transparent'}` }}>
                  <div className="text-xl font-semibold" style={{ fontFamily: F_MONO, color: ETATS[e].color }}>
                    {unite === 'pct' ? `${Math.round((n / tot) * 100)} %` : n}
                  </div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>{ETATS[e].court}</div>
                </button>
              );
            })}
          </div>

          {etatOuvert && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
                {ETATS[etatOuvert].label} — appuyez sur une ligne pour ouvrir la fiche
              </div>
              <div className="space-y-1.5">
                {recentes.filter((l) => l.etat === etatOuvert).map((l, i) => (
                  <button key={i} onClick={() => onOuvrirPersonne(l.initials, l.objectif)}
                    className="w-full text-left rounded-xl px-3 py-2 flex items-start justify-between gap-2"
                    style={{ backgroundColor: PAPER }}>
                    <span className="text-sm min-w-0 break-words">
                      <span className="font-semibold" style={{ fontFamily: F_DISPLAY }}>{nomAffiche(donnees, l.initials)}</span>
                      {' · '}{libelleAffiche(donnees, l.initials, l.objectif)}
                    </span>
                    <span className="text-xs shrink-0" style={{ fontFamily: F_MONO, color: ETATS[etatOuvert].color }}>
                      {l.origineSuivi
                        ? `${nbCotations(l)} journée${nbCotations(l) !== 1 ? 's' : ''}`
                        : `${nbCotations(l)} séance${nbCotations(l) !== 1 ? 's' : ''}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <button onClick={onOuvrirCrises} className="rounded-2xl border p-4 text-left"
          style={{ borderColor: BORDER, backgroundColor: CARD }}>
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle size={14} style={{ color: INK_SOFT }} />
            <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>Crises · {libellePeriode(periode)}</span>
            <span className="text-xs ml-auto" style={{ color: INK }}>voir les graphiques →</span>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-xl font-semibold" style={{ fontFamily: F_MONO }}>{recentesCrises.length}</span>
            {tendance != null && (
              <span className="text-xs" style={{ color: tendance > 0 ? NON_ACQUIS : tendance < 0 ? ACQUIS : INK_SOFT }}>
                {tendance > 0 ? '+' : ''}{tendance} % vs {libelleComparaison(periode) || 'période précédente'}
              </span>
            )}
          </div>
          {intensiteMoy != null && (
            <div className="text-xs" style={{ color: INK_SOFT }}>
              Intensité moyenne : <strong style={{ color: INTENSITES[Math.round(intensiteMoy)].color }}>{intensiteMoy} / 3</strong>
              {' '}sur {notees.length} crise{notees.length !== 1 ? 's' : ''} notée{notees.length !== 1 ? 's' : ''}
            </div>
          )}
          {topComportement && (
            <div className="text-xs" style={{ color: INK_SOFT }}>
              Comportement : <strong style={{ color: INK }}>{topComportement[0]}</strong>{' '}
              ({unite === 'pct' ? `${Math.round((topComportement[1] / (recentesCrises.length || 1)) * 100)} %` : topComportement[1]})
            </div>
          )}
          {topAntecedent && (
            <div className="text-xs" style={{ color: INK_SOFT }}>
              Antécédent : <strong style={{ color: INK }}>{topAntecedent[0]}</strong>{' '}
              ({unite === 'pct' ? `${Math.round((topAntecedent[1] / (recentesCrises.length || 1)) * 100)} %` : topAntecedent[1]})
            </div>
          )}
          {!recentesCrises.length && <p className="text-xs" style={{ color: INK_SOFT }}>Aucune crise sur la période.</p>}
        </button>
      </div>

      {recentes.length === 0 ? (
        <Empty>Aucun objectif coté sur cette période.</Empty>
      ) : (
        <>
          {prioritaires.length > 0 && (
            <>
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>
                Objectifs prioritaires — appuyez pour ouvrir la fiche
              </div>
              <LigneObjectifs lignes={prioritaires} donnees={donnees} onOuvrir={onOuvrirPersonne} />
            </>
          )}

          {autres.length > 0 && (() => {
            /* Sans prioritaires au-dessus, cette liste est le contenu principal
               de la page : elle reste dépliée quoi qu'il arrive. */
            const repliable = prioritaires.length > 0;
            const ouverte = !repliable || autresOuverts;
            return (
              <>
                <button onClick={() => repliable && setAutresOuverts((v) => !v)}
                  className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5 w-full text-left"
                  style={{ color: INK_SOFT, marginTop: repliable ? '1.25rem' : 0, cursor: repliable ? 'pointer' : 'default' }}>
                  {repliable ? 'Autres objectifs travaillés' : 'Objectifs travaillés'} ({autres.length})
                  {repliable && <span style={{ fontFamily: F_MONO }}>{ouverte ? '▾' : '▸'}</span>}
                  {!repliable && <span className="normal-case">— appuyez pour ouvrir la fiche</span>}
                </button>
                {ouverte && <LigneObjectifs lignes={autres} donnees={donnees} onOuvrir={onOuvrirPersonne} />}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

/* Liste d'objectifs du tableau de bord. Extraite pour que les deux groupes —
   prioritaires et autres — partagent exactement le même rendu. */
function LigneObjectifs({ lignes, donnees, onOuvrir }) {
  return (
    <div className="space-y-1.5">
      {lignes.map((l, i) => {
        /* Une ligne en mesure brute (occurrences, minutes, suivi continu promu
           en objectif) n'a pas de `points` : c'est `mesures` qui porte sa
           courbe, sans la borne [0, 100] qui n'a pas de sens hors pourcentage.
           `origineSuivi` compte en journées, pas en séances. */
        const serie = l.points.length ? l.points : l.mesures;
        const enPourcent = !!l.points.length;
        const nUnite = l.origineSuivi ? 'journée' : 'séance';
        return (
          <button key={`${l.initials}|${l.objectif}|${i}`} onClick={() => onOuvrir(l.initials, l.objectif)}
            className="w-full rounded-xl border px-3.5 py-3 flex items-center gap-3 text-left"
            style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <div className="min-w-0 flex-1">
              <div className="text-sm break-words">
                <span className="font-semibold" style={{ fontFamily: F_DISPLAY }}>{nomAffiche(donnees, l.initials)}</span>
                {' · '}{libelleAffiche(donnees, l.initials, l.objectif)}
              </div>
              <div className="text-xs" style={{ color: INK_SOFT }}>
                {serie.length} {nUnite}{serie.length !== 1 ? 's' : ''}
                {libelleSeuil(l) && ` · ${libelleSeuil(l)}`}
                {l.etat === 'bientot' && ` · ${l.streak}/${l.needed}`}
                {l.etat === 'plateau' && ` · moyenne ${l.moyenne} %`}
              </div>
            </div>
            <MiniGraphe points={serie} couleur={ETATS[l.etat].color} enPourcent={enPourcent} />
            <span className="text-xs font-medium px-2 py-1 rounded-lg shrink-0"
              style={{ backgroundColor: ETATS[l.etat].color, color: texteLisibleSur(ETATS[l.etat].color), fontFamily: F_DISPLAY }}>
              {ETATS[l.etat].court}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ==================== Accord inter-observateurs ==================== */
function ioaPourEntree(obj, ea, eb) {
  if (!ea || !eb) return null;
  const t = obj.type;
  const code = (x) => (x && typeof x === 'object' ? x.code : x);

  if (t === 'trials') {
    const n = Math.max((ea.trials || []).length, (eb.trials || []).length);
    let pts = 0, acc = 0;
    for (let i = 0; i < n; i++) {
      const a = code((ea.trials || [])[i]);
      const b = code((eb.trials || [])[i]);
      if (!a && !b) continue;
      pts += 1;
      if (a === b) acc += 1;
    }
    return pts ? { points: pts, accords: acc } : null;
  }
  if (t === 'probe') {
    const a = ea.guidance != null ? ea.guidance : ea.value;
    const b = eb.guidance != null ? eb.guidance : eb.value;
    if (a == null && b == null) return null;
    return { points: 1, accords: a === b ? 1 : 0 };
  }
  if (t === 'chaining') {
    const steps = (obj.config && obj.config.steps) || [];
    let pts = 0, acc = 0;
    steps.forEach((st) => {
      const a = (ea.steps || {})[st.id];
      const b = (eb.steps || {})[st.id];
      if (!a && !b) return;
      pts += 1;
      if (a === b) acc += 1;
    });
    return pts ? { points: pts, accords: acc } : null;
  }
  if (t === 'balance') {
    const steps = (obj.config && obj.config.steps) || [];
    const ta = Array.isArray(ea.trials) ? ea.trials : [{ steps: ea.steps || {} }];
    const tb = Array.isArray(eb.trials) ? eb.trials : [{ steps: eb.steps || {} }];
    const n = Math.max(ta.length, tb.length);
    let pts = 0, acc = 0;
    for (let i = 0; i < n; i++) {
      steps.forEach((st) => {
        const a = ((ta[i] || {}).steps || {})[st.id];
        const b = ((tb[i] || {}).steps || {})[st.id];
        if (!(a && a.outcome) && !(b && b.outcome)) return;
        pts += 1;
        if ((a && a.outcome) === (b && b.outcome)) acc += 1;
      });
    }
    return pts ? { points: pts, accords: acc } : null;
  }
  if (t === 'interval') {
    const cles = new Set([...Object.keys(ea.marks || {}), ...Object.keys(eb.marks || {})]);
    let pts = 0, acc = 0;
    cles.forEach((k) => { pts += 1; if ((ea.marks || {})[k] === (eb.marks || {})[k]) acc += 1; });
    return pts ? { points: pts, accords: acc } : null;
  }
  const prop = (a, b) => (!a && !b ? null : { points: 1, accords: Math.min(a, b) / Math.max(a, b), proportionnel: true });
  if (t === 'occurrence') return prop(ea.count || 0, eb.count || 0);
  if (t === 'timer') return prop(ea.elapsedMs || 0, eb.elapsedMs || 0);
  if (t === 'latency') {
    const moy = (l) => (l && l.length ? l.reduce((x, y) => x + y, 0) / l.length : 0);
    return prop(moy(ea.latencies), moy(eb.latencies));
  }
  return null;
}

/* Apparie les séances marquées « deux observateurs en parallèle » du même
   jour. Le regroupement se fait sur le NOM de l'atelier, jamais sur
   `atelierId` : cet identifiant est propre à chaque tablette (`_ateliers` est
   indexé par source), si bien que deux intervenants qui cotent le même
   atelier depuis deux tablettes portent deux identifiants différents et
   tombaient chacun dans leur paquet — aucune paire ne sortait jamais. Prend
   `donnees` plutôt que `donnees.seances` pour résoudre ce nom via
   `nomAtelier`. */
function trouverPaires(donnees) {
  const cand = (donnees.seances || []).filter((s) => s.doubleCotation);
  const parJour = new Map();
  cand.forEach((s) => {
    /* Même résolution qu'à l'affichage : une séance libre et une séance
       Équilibre du même jour ne sont pas la même situation d'observation et
       n'ont pas à s'apparier, ce que le repli commun « libre » permettait. */
    const cle = `${new Date(s.date).toLocaleDateString('fr-FR')}|${libelleSeance(donnees, s)}`;
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle).push(s);
  });
  const paires = [];
  parJour.forEach((l, cle) => {
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length; j++) {
        if (l[i].source === l[j].source) continue;
        paires.push({ cle, jour: cle.split('|')[0], a: l[i], b: l[j] });
      }
    }
  });
  return paires;
}

function comparerPaire(paire, donnees) {
  const lignes = [];
  const ini = (sess, sid) => ((donnees._idVersInitiales || {})[sess.source] || {})[sid] || '?';
  (paire.a.studentIds || []).forEach((sidA) => {
    const initiales = ini(paire.a, sidA);
    const sidB = (paire.b.studentIds || []).find((id) => ini(paire.b, id) === initiales);
    if (!sidB) return;
    (paire.a.selectedObjectives[sidA] || []).forEach((oidA) => {
      const objA = (paire.a.objectiveSnapshot || {})[oidA];
      if (!objA) return;
      const oidB = (paire.b.selectedObjectives[sidB] || []).find((o) => ((paire.b.objectiveSnapshot || {})[o] || {}).name === objA.name);
      if (!oidB) return;
      const r = ioaPourEntree(objA, (paire.a.data[sidA] || {})[oidA], (paire.b.data[sidB] || {})[oidB]);
      if (!r) return;
      lignes.push({ initials: initiales, objectif: objA.name, ...r, pct: Math.round((r.accords / r.points) * 100) });
    });
  });
  const points = lignes.reduce((a, l) => a + l.points, 0);
  const accords = lignes.reduce((a, l) => a + l.accords, 0);
  return { lignes, points, pct: points ? Math.round((accords / points) * 100) : null };
}

/* ==================== Séances ====================
   Deux usages distincts sur le même écran : parcourir ce qui a été importé
   (et retirer ce qui n'aurait pas dû l'être), et vérifier l'accord entre deux
   observateurs. */
/* Les six réglages de cet écran vivent dans ManagerApp (`vueSeances`) : ils
   étaient locaux, donc détruits au moindre changement d'onglet. Vérifier une
   paire d'observateurs, aller lire une fiche et revenir imposait de refaire la
   recherche, le tri, les déplis et le choix de la paire.
   Les accesseurs ci-dessous gardent le corps du composant inchangé. */
function SeancesScreen({ donnees, onSupprimerSeance, densite, vue, setVue, periode, setPeriode, contexte, bandeau, onOuvrirPersonne }) {
  const majVue = (champs) => setVue({ ...vue, ...champs });
  const { recherche, tri, toutes, groupesOuverts, ouverte, paire: choisie } = vue;
  const setChoisie = (v) => majVue({ paire: v });
  const setOuverte = (v) => majVue({ ouverte: v });
  const setRecherche = (v) => majVue({ recherche: v });
  const setToutes = (v) => majVue({ toutes: v });
  const setGroupesOuverts = (f) => majVue({ groupesOuverts: typeof f === 'function' ? f(groupesOuverts) : f });
  /* Le tri est « par jour » d'office : à dix séances par jour, une liste à plat
     déborde vite. « Par date » a disparu — le regroupement par jour en tient
     lieu, avec le même ordre antéchronologique. Les groupes ouverts sont vidés
     en changeant de tri (une clé de semaine ne veut rien dire pour un
     regroupement par mois) mais surtout pas en changeant de période : une clé
     absente est inoffensive, et les vider annulerait le dépli à chaque
     ajustement du sélecteur. */
  const changerTri = (k) => setVue({ ...vue, tri: k, groupesOuverts: [] });

  const LOT = 25;

  const seances = donnees.seances.map((s) => {
    let cotations = 0;
    (s.studentIds || []).forEach((sid) => {
      ((s.selectedObjectives || {})[sid] || []).forEach((oid) => {
        const obj = (s.objectiveSnapshot || {})[oid];
        const entry = (s.data || {})[sid] && s.data[sid][oid];
        /* `valeurCotation` et non `objectiveScoreValue` : ce dernier ignore
           l'occurrence et l'intervalle, si bien que le compte annoncé était
           inférieur d'un bon tiers au nombre de cotations réellement saisies,
           sur toutes les séances à la fois — et que le tri « Par cotations »
           reléguait en fin de liste les séances les plus denses dans ces deux
           modes. */
        if (obj && entry && valeurCotation(obj, entry, guidancesDe(donnees, s.source)) != null) cotations += 1;
      });
    });
    const table = (donnees._idVersInitiales || {})[s.source] || {};
    const initiales = (s.studentIds || []).map((sid) => table[sid]).filter(Boolean);
    return { ...s, cotations, initiales };
  });

  const q = recherche.trim().toLowerCase();
  /* Trois filtres, dans cet ordre : la période partagée avec les autres écrans,
     la personne du contexte, puis la recherche libre. Cet écran était le seul
     écran de lecture à ignorer la période — se restreindre dans le temps y
     supposait de taper une date au clavier dans le champ de recherche. */
  const filtrees = seances.filter((s) => {
    if (!dansPeriode(s.date, periode)) return false;
    if (contexte.personne && !s.initiales.includes(contexte.personne)) return false;
    if (contexte.classe && !s.initiales.some((i) => {
      const p = (donnees.personnes || []).find((x) => x.initials === i);
      return p && p.classeId === contexte.classe;
    })) return false;
    if (!q) return true;
    const champs = [
      new Date(s.date).toLocaleDateString('fr-FR'),
      s.source || '',
      /* `libelleSeance` : chercher « libre » ou « équilibre » ne rendait rien,
         les deux natures étant résolues en « Hors atelier » comme n'importe
         quelle séance sans atelier. */
      libelleSeance(donnees, s),
      ...s.initiales.map((i) => nomAffiche(donnees, i)),
    ].join(' ').toLowerCase();
    return champs.includes(q);
  }).sort((a, b) => {
    if (tri === 'cotations') return b.cotations - a.cotations;
    if (tri === 'jour' || tri === 'semaine' || tri === 'mois') {
      const ka = cleAgregation(a.date, tri);
      const kb = cleAgregation(b.date, tri);
      /* Groupes du plus récent au plus ancien, séances du plus récent au plus
         ancien dans chaque groupe : même ordre que le tri par date, juste
         entrecoupé d'en-têtes. */
      if (ka !== kb) return kb - ka;
      return new Date(b.date) - new Date(a.date);
    }
    return new Date(b.date) - new Date(a.date);
  });

  const groupe = tri === 'jour' || tri === 'semaine' || tri === 'mois';
  /* Groupée, la pagination porte sur des tranches — pas sur des séances : à
     dix séances par jour et tout replié, plafonner à 25 séances aurait coupé
     des journées entières derrière « afficher les autres » sans dire
     lesquelles. À plat (tri par cotations), elle reste ce qu'elle a toujours
     été. */
  const groupesTous = groupe
    ? (() => {
        const m = new Map();
        filtrees.forEach((s) => {
          const k = cleAgregation(s.date, tri);
          if (!m.has(k)) m.set(k, []);
          m.get(k).push(s);
        });
        return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
      })()
    : null;
  const groupes = groupe ? (toutes ? groupesTous : groupesTous.slice(0, LOT)) : null;
  const affichees = groupe ? groupesTous.flatMap(([, ss]) => ss) : (toutes ? filtrees : filtrees.slice(0, LOT));
  const resteAAfficher = groupe ? groupesTous.length - groupesTous.slice(0, LOT).length : filtrees.length - LOT;

  const paires = trouverPaires(donnees);
  const res = choisie ? comparerPaire(choisie, donnees) : null;
  const couleur = res && res.pct != null ? (res.pct >= 80 ? ACQUIS : res.pct >= 60 ? EN_COURS : NON_ACQUIS) : INK_SOFT;

  if (!donnees.seances.length) return <Empty>Aucune séance importée.</Empty>;

  return (
    <div>
      <SelecteurPeriode periode={periode} setPeriode={setPeriode} collant bandeau={bandeau} />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une date, une personne, un atelier…"
          className="flex-1 min-w-[220px] rounded-xl border px-3 py-2.5 text-sm bg-transparent"
          style={{ borderColor: BORDER, color: INK }} />
        <div className="flex gap-1.5 flex-wrap">
          <Chip label="Par jour" on={tri === 'jour'} onClick={() => changerTri('jour')} />
          <Chip label="Par semaine" on={tri === 'semaine'} onClick={() => changerTri('semaine')} />
          <Chip label="Par mois" on={tri === 'mois'} onClick={() => changerTri('mois')} />
          <Chip label="Par cotations" on={tri === 'cotations'} onClick={() => changerTri('cotations')} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>
          {filtrees.length} séance{filtrees.length !== 1 ? 's' : ''}
          {/* « sur N » dès qu'un des trois filtres retire quelque chose, et non
              plus seulement sur la recherche : avec la période et le contexte,
              des séances disparaissaient de la liste sans que rien ne le dise. */}
          {filtrees.length !== seances.length && ` sur ${seances.length}`} — appuyez pour voir le détail
        </span>
        {groupes && (
          <Btn variant="ghost" className="text-xs py-1 ml-auto"
            onClick={() => setGroupesOuverts(groupesOuverts.length ? [] : groupesTous.map(([k]) => k))}>
            {groupesOuverts.length ? 'Tout replier' : 'Tout déplier'}
          </Btn>
        )}
      </div>

      <div className="mb-4">
        {groupes ? groupes.map(([k, ss]) => {
          const ouvert = groupesOuverts.includes(k);
          return (
            <div key={k} className="mb-3 last:mb-0">
              <button
                onClick={() => setGroupesOuverts((cur) => (ouvert ? cur.filter((x) => x !== k) : [...cur, k]))}
                className="w-full flex items-center gap-1.5 text-xs uppercase tracking-wide mb-1.5 text-left"
                style={{ color: INK_SOFT, fontFamily: F_MONO }}
                aria-expanded={ouvert}
              >
                <ChevronDown size={13} className="shrink-0"
                  style={{ transform: ouvert ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                {etiquetteAgregation(k, tri)}
                <span className="font-normal normal-case">· {ss.length} séance{ss.length !== 1 ? 's' : ''}</span>
              </button>
              {ouvert && (
                <div className={densite === 'compact' ? 'space-y-1' : 'space-y-1.5'}>
                  {ss.map((s) => (
                    <DetailSeance key={s.id} seance={s} donnees={donnees} densite={densite}
                      ouverte={ouverte === s.id}
                      onBasculer={() => setOuverte(ouverte === s.id ? null : s.id)}
                      onSupprimer={() => onSupprimerSeance(s)}
                      onOuvrirPersonne={onOuvrirPersonne} />
                  ))}
                </div>
              )}
            </div>
          );
        }) : (
          <div className={densite === 'compact' ? 'space-y-1' : 'space-y-1.5'}>
            {affichees.map((s) => (
              <DetailSeance key={s.id} seance={s} donnees={donnees} densite={densite}
                ouverte={ouverte === s.id}
                onBasculer={() => setOuverte(ouverte === s.id ? null : s.id)}
                onSupprimer={() => onSupprimerSeance(s)}
                onOuvrirPersonne={onOuvrirPersonne} />
            ))}
          </div>
        )}
        {!affichees.length && <Empty>Aucune séance ne correspond à cette recherche.</Empty>}
      </div>

      {/* Groupée, la pagination porte sur des tranches — replier les tranches
         affichées ne fait pas remonter les suivantes. À plat, elle porte sur
         des séances, comme avant. */}
      {resteAAfficher > 0 && (
        <Btn variant="outline" onClick={() => setToutes((v) => !v)} className="text-sm mb-6">
          {toutes
            ? (groupe ? `N'afficher que les ${LOT} premières tranches` : `N'afficher que les ${LOT} premières`)
            : (groupe ? `Afficher les ${resteAAfficher} autres tranches` : `Afficher les ${resteAAfficher} autres`)}
        </Btn>
      )}

      <div className="text-xs uppercase tracking-wide mb-2 mt-6" style={{ color: INK_SOFT }}>Accord inter-observateurs</div>
      {paires.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: INK_SOFT }}>
            Aucune paire détectée. Pour qu'une paire apparaisse, les deux intervenants doivent avoir
            coché <strong>« Deux observateurs en parallèle »</strong> dans DatABA, sur la même séance
            et le même jour, chacun sur son appareil.
          </p>
        </Card>
      ) : (
        /* Sélection de la paire à gauche, comparaison à droite : le travail
           est comparatif — choisir une paire, en lire l'accord — même
           disposition que la fiche personne. */
        <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
          <div className="lg:w-72 shrink-0 space-y-1.5">
            {paires.map((p, i) => (
              <button key={i} onClick={() => setChoisie(p)}
                className="w-full text-left rounded-xl border px-3.5 py-3"
                style={{ borderColor: choisie === p ? ACCENT : BORDER, backgroundColor: choisie === p ? ACCENT_WASH : CARD }}>
                <div className="text-sm font-medium">{p.jour}</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>{p.a.source} · {p.b.source}</div>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            {!res ? (
              <Empty>Choisissez une paire pour voir l'accord.</Empty>
            ) : (
              <>
                <Card className="mb-3">
                  <div className="text-4xl font-semibold" style={{ fontFamily: F_MONO, color: couleur }}>
                    {res.pct != null ? `${res.pct} %` : '—'}
                  </div>
                  <div className="text-sm mt-1" style={{ color: INK_SOFT }}>
                    d'accord sur <span style={{ fontFamily: F_MONO }}>{res.points}</span> point{res.points !== 1 ? 's' : ''} comparé{res.points !== 1 ? 's' : ''}
                  </div>
                  <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
                    Un accord d'au moins 80 % est l'usage courant pour considérer des relevés fiables.
                  </p>
                </Card>
                <div className="space-y-1.5">
                  {res.lignes.slice().sort((a, b) => a.pct - b.pct).map((l, i) => (
                    <div key={i} className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2" style={{ borderColor: BORDER, backgroundColor: CARD }}>
                      <div className="min-w-0">
                        <div className="text-sm break-words">
                          <span className="font-semibold" style={{ fontFamily: F_DISPLAY }}>{l.initials}</span> · {l.objectif}
                        </div>
                        <div className="text-xs" style={{ color: INK_SOFT }}>
                          {l.proportionnel ? 'accord proportionnel' : `${Math.round(l.accords)}/${l.points}`}
                        </div>
                      </div>
                      <span className="text-sm font-semibold shrink-0" style={{ fontFamily: F_MONO, color: l.pct >= 80 ? ACQUIS : l.pct >= 60 ? EN_COURS : NON_ACQUIS }}>
                        {l.pct} %
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Une séance dans la liste, dépliable sur son détail complet.
   Les cotations ne sont pas modifiables ici : la tablette reste la source, et
   un réimport de la même séance rétablirait de toute façon ses valeurs. */
function DetailSeance({ seance, donnees, ouverte, onBasculer, onSupprimer, densite, onOuvrirPersonne }) {
  const table = (donnees._idVersInitiales || {})[seance.source] || {};
  const intervenant = ((donnees._intervenants || {})[seance.source] || {})[seance.intervenantId];
  const dureeMin = seance.endedAt && seance.startedAt
    ? Math.round(Math.max(0, seance.endedAt - seance.startedAt) / 60000) : null;
  const compact = densite === 'compact';

  return (
    <div className="rounded-xl border" style={{ borderColor: ouverte ? INK : BORDER, backgroundColor: CARD }}>
      <button onClick={onBasculer} className={`w-full flex items-center justify-between gap-3 text-left ${compact ? 'px-3 py-1.5' : 'px-3.5 py-3'}`}>
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {new Date(seance.date).toLocaleDateString('fr-FR')}
            {seance.doubleCotation && (
              <span className="text-xs ml-2 px-1.5 py-0.5 rounded border" style={{ borderColor: BORDER, color: INK_SOFT }}>double cotation</span>
            )}
          </div>
          {!compact && (
            <div className="text-xs break-words" style={{ color: INK_SOFT }}>
              {seance.source} · {libelleSeance(donnees, seance)}
              {seance.initiales.length > 0 && ` · ${seance.initiales.map((i) => nomAffiche(donnees, i)).join(', ')}`}
            </div>
          )}
        </div>
        <span className="text-sm shrink-0 flex items-center gap-2" style={{ fontFamily: F_MONO, color: INK }}>
          {seance.cotations}
          <span style={{ color: INK_SOFT }}>{ouverte ? '▾' : '▸'}</span>
        </span>
      </button>

      {ouverte && (
        <div className="px-3.5 pb-3.5 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="text-xs mb-3 mt-2" style={{ color: INK_SOFT }}>
            {intervenant && <>Intervenant : <strong style={{ color: INK }}>{intervenant}</strong> · </>}
            {dureeMin != null && <>Durée : <strong style={{ color: INK }}>{dureeMin} min</strong> · </>}
            {/* Les trois natures de DatABA, et non les deux valeurs de `mode` :
                une séance libre est un `mode: 'atelier'` sans atelier, et
                s'annonçait donc « atelier » ici. */}
            Nature : {seance.mode === 'balance' ? 'Équilibre' : seance.atelierId ? 'Atelier' : 'Séance libre'}
          </div>

          {(seance.studentIds || []).map((sid) => {
            const ini = table[sid];
            const objectifs = (seance.selectedObjectives || {})[sid] || [];
            const note = (seance.notes || {})[sid];
            return (
              <div key={sid} className="mb-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: PAPER }}>
                {/* Sortie de cul-de-sac : cet écran listait les personnes d'une
                    séance sans qu'aucune ne mène à sa fiche — il fallait retenir
                    des initiales, changer d'onglet et la retrouver à la main. */}
                {ini ? (
                  <button onClick={() => onOuvrirPersonne && onOuvrirPersonne(ini, null)}
                    className="text-sm font-semibold mb-1.5 text-left"
                    style={{ fontFamily: F_DISPLAY, color: ACCENT }}>
                    {nomAffiche(donnees, ini)}
                  </button>
                ) : (
                  <div className="text-sm font-semibold mb-1.5" style={{ fontFamily: F_DISPLAY }}>Personne inconnue</div>
                )}
                {objectifs.length === 0 ? (
                  <div className="text-xs" style={{ color: INK_SOFT }}>Aucun objectif sélectionné.</div>
                ) : objectifs.map((oid) => {
                  const obj = (seance.objectiveSnapshot || {})[oid];
                  if (!obj) return null;
                  const entry = (seance.data || {})[sid] && seance.data[sid][oid];
                  /* `valeurCotation` et non `objectiveScoreValue` : ce dernier
                     rend null pour l'occurrence et l'intervalle, qui
                     s'affichaient donc « non coté » — plus d'une cotation sur
                     trois, dont tous les comportements problèmes comptés à
                     l'occurrence. La valeur est rendue avec son unité : un
                     compteur à douze n'est pas un score de douze pour cent. */
                  const m = valeurCotation(obj, entry, guidancesDe(donnees, seance.source));
                  /* Compteur et chrono d'appoint : saisis en séance sur
                     n'importe quel mode, ils n'arrivaient nulle part ici. À
                     côté de la cotation, jamais à sa place — ce n'est pas un
                     score. */
                  const appoint = libelleAppoint(mesuresAppoint(entry));
                  return (
                    <div key={oid} className="flex items-baseline justify-between gap-2 text-xs py-0.5">
                      <span className="min-w-0 break-words">
                        {ini ? libelleAffiche(donnees, ini, obj.name) : obj.name}
                        <span style={{ color: INK_SOFT }}> · {TYPES_COTATION[obj.type] || obj.type}</span>
                        {/* Pour Probe, la guidance est une option du formulaire, pas un mode
                            imposé : la cotation 1/0 reste la voie par défaut. Le dire évite de
                            lire un score à 0 % comme un échec de guidance qui n'a jamais existé. */}
                        {obj.type === 'probe' && (
                          <span style={{ color: INK_SOFT }}> ({obj.config && obj.config.useGuidance ? 'guidance' : '1/0'})</span>
                        )}
                        {obj.type === 'probe' && entry && libelleCreneauProbe(entry.creneau) && (
                          <span style={{ color: INK_SOFT }}> · {libelleCreneauProbe(entry.creneau)}</span>
                        )}
                        {appoint && <span style={{ color: INK_SOFT }}> · {appoint}</span>}
                      </span>
                      <span className="shrink-0" style={{ fontFamily: F_MONO, color: m == null ? INK_SOFT : INK }}>
                        {m == null ? 'non coté' : `${m.valeur} ${m.unite}`}
                      </span>
                    </div>
                  );
                })}
                {note && (
                  <div className="text-xs mt-1.5 pt-1.5 whitespace-pre-wrap" style={{ color: INK_SOFT, borderTop: `1px solid ${BORDER}` }}>
                    {note}
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={onSupprimer} className="flex items-center gap-1.5 text-xs mt-1" style={{ color: NON_ACQUIS }}>
            <Trash2 size={13} /> Retirer cette séance de l'analyse
          </button>
        </div>
      )}
    </div>
  );
}

/* ==================== Crises ====================
   Chaque répartition se lit en effectifs ou en pourcentage. Les crises sans
   catégorie cochée n'apparaissent dans aucune barre : c'est voulu, une barre
   « non renseigné » masquerait le fait qu'il manque de la saisie. */
const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/* Palette des séries : la catégorielle, comme côté DatABA (« les séries
   prennent la palette catégorielle »). Fixe entre les deux thèmes. */
const PALETTE_SERIES = [CAT_INDIGO, CAT_CORAL, CAT_AMBER, CAT_TEAL, CAT_VIOLET, CAT_CYAN, CAT_LILAC, CAT_SLATE];
const SERIES_MAX = 6;   // au-delà, le graphique devient illisible

/* Comment découper les crises en séries. Certaines dimensions admettent
   plusieurs valeurs par crise : elle compte alors dans chaque série
   concernée, et le total empilé dépasse volontairement le nombre de crises. */
const SEGMENTATIONS = [
  { k: 'aucune', label: 'Aucune', multi: false },
  { k: 'intensite', label: 'Intensité', multi: false },
  { k: 'personne', label: 'Personne', multi: false },
  { k: 'atelier', label: 'Atelier', multi: false },
  { k: 'antecedent', label: 'Antécédent', multi: true },
  { k: 'comportement', label: 'Comportement', multi: true },
  { k: 'consequence', label: 'Conséquence', multi: true },
  { k: 'fonction', label: 'Fonction supposée', multi: true },
];

const FONCTIONS = {
  attention: 'Attention', echappement: 'Échappement', tangible: 'Tangible',
  sensoriel: 'Sensoriel', indetermine: 'Indéterminée',
};

/* Valeurs de segmentation d'une crise : toujours une liste, même pour les
   dimensions à valeur unique, pour un traitement uniforme. */
function valeursSegment(donnees, crise, segmentation) {
  switch (segmentation) {
    case 'intensite':
      return crise.intensite ? [`${crise.intensite} · ${INTENSITES[crise.intensite].label}`] : [];
    case 'personne': {
      const ini = ((donnees._idVersInitiales || {})[crise.source] || {})[crise.studentId];
      return ini ? [nomAffiche(donnees, ini)] : [];
    }
    case 'atelier':
      return [nomAtelier(donnees, crise.source, crise.atelierId)];
    case 'antecedent':
      return crise.antecedentTags || [];
    case 'comportement':
      return crise.comportementTags || [];
    case 'consequence':
      return crise.consequenceTags || [];
    case 'fonction':
      return crise.fonction ? [FONCTIONS[crise.fonction] || crise.fonction] : [];
    default:
      return ['Total'];
  }
}

/* Chronologie des crises, découpée en séries.

   Une tranche existe dès qu'elle contient un jour observé (`jours`, produit
   par joursObserves), même sans aucune crise : ce zéro-là est une information,
   et l'omettre biaisait la lecture deux fois — la tendance ne se calculait que
   sur les tranches où il s'était passé quelque chose, et l'axe mentait sur le
   temps écoulé en collant deux semaines non consécutives. Une tranche sans
   aucun jour observé (vacances, absence prolongée) n'est en revanche pas
   créée : elle sortirait du calcul comme un zéro qu'elle n'est pas.

   `jours` absent (appel historique) → repli sur l'ancien comportement, une
   tranche par tranche portant une crise.

   « mesure » vaut 'nombre' (chaque crise pèse 1) ou 'duree' (chaque crise pèse
   ses minutes) : une semaine peut compter peu de crises mais très longues. */
function chronologieCrises(donnees, crises, granularite, segmentation, mesure = 'nombre', jours = null) {
  const paquets = new Map();
  const totaux = new Map();
  const poids = (c) => (mesure === 'duree' ? Math.round((c.durationMs || 0) / 60000) : 1);

  /* Les tranches observées d'abord : elles fixent le squelette de l'axe, les
     crises ne font ensuite que le remplir. */
  if (jours) {
    jours.forEach((j) => {
      const cle = cleAgregation(`${j}T12:00:00`, granularite);
      if (!paquets.has(cle)) paquets.set(cle, {});
    });
  }

  crises.forEach((c) => {
    const cle = cleAgregation(c.date, granularite);
    if (!paquets.has(cle)) paquets.set(cle, {});
    const bucket = paquets.get(cle);
    const p = poids(c);
    valeursSegment(donnees, c, segmentation).forEach((v) => {
      bucket[v] = (bucket[v] || 0) + p;
      totaux.set(v, (totaux.get(v) || 0) + p);
    });
  });

  /* On ne garde que les séries les plus représentées ; le reste est regroupé,
     sinon la légende devient illisible. */
  const classees = Array.from(totaux.entries()).sort((a, b) => b[1] - a[1]);
  const gardees = classees.slice(0, SERIES_MAX).map(([v]) => v);
  const regroupe = classees.length > SERIES_MAX;
  const series = regroupe ? [...gardees, 'Autres'] : gardees;

  const donneesGraphe = Array.from(paquets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cle, bucket]) => {
      const ligne = { label: etiquetteAgregation(cle, granularite) };
      series.forEach((v) => { ligne[v] = 0; });
      Object.entries(bucket).forEach(([v, n]) => {
        const cible = gardees.includes(v) ? v : 'Autres';
        ligne[cible] = (ligne[cible] || 0) + n;
      });
      /* Total de la tranche : c'est lui que lisent les courbes superposées.
         Une lecture par série serait illisible (jusqu'à six séries). */
      ligne._total = series.reduce((a, v) => a + (ligne[v] || 0), 0);
      return ligne;
    });

  return { donnees: donneesGraphe, series, regroupe };
}

/* Blocs composant un bilan de crise. Ils sont listés ici une seule fois : le
   même rendu sert à l'écran, à l'export PDF depuis l'onglet Crises, et au
   bilan inclus dans le rapport d'une personne. Sans cette mise en commun, la
   version imprimée et la version affichée divergeraient à la première
   modification. */
const BLOCS_CRISE = [
  { k: 'chronologie', label: 'Évolution dans le temps' },
  { k: 'synthese', label: 'Enregistrements et durées' },
  { k: 'intensite', label: 'Occurrences par intensité' },
  { k: 'jour', label: 'Jour de la semaine' },
  { k: 'atelier', label: 'Atelier' },
  { k: 'antecedent', label: 'Antécédents' },
  { k: 'comportement', label: 'Comportements' },
  { k: 'consequence', label: 'Conséquences' },
  { k: 'fonction', label: 'Fonctions supposées' },
];
const TOUS_LES_BLOCS = BLOCS_CRISE.map((b) => b.k);

const configCriseVide = () => ({
  personnes: [],
  type: 'crise',
  segmentation: 'intensite',
  forme: 'barres',
  mesure: 'nombre',
  unite: 'nombre',
  blocs: TOUS_LES_BLOCS,
  /* Lectures superposées à la chronologie. Vide par défaut : le graphique
     s'ouvre sur ses données. Un bilan enregistré avant ce réglage n'a pas la
     clé — d'où les `config.courbes || []` à la lecture. */
  courbes: [],
});

/* Barres horizontales : les intitulés sont longs, un axe vertical les
   tronquerait. */
/* Frise d'une journée de suivi continu : une piste horizontale, un segment
   par état, proportionnel à sa durée réelle — remplace la liste
   d'horodatages, où un critère tenu cinq minutes et un autre tenu trois
   heures se lisaient à l'identique. Grammaire reprise de FriseJournee côté
   DatABA (src/App.jsx), adaptée à une journée passée : pas de « maintenant »
   à qui accrocher le dernier segment, donc une largeur nominale plutôt qu'une
   extension jusqu'à l'heure courante. Un segment non borné (`ms: null`) est
   rendu en hachures, jamais en aplat : sa largeur est arbitraire, sa couleur
   ne doit pas laisser croire à une durée mesurée. */
const DUREE_NOMINALE_MS = 30 * 60000;
function FriseSuivi({ segments, hauteur = 22 }) {
  if (!segments.length) return null;
  const heure = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const finDe = (seg) => (seg.fin != null ? seg.fin : seg.debut + DUREE_NOMINALE_MS);
  const debut = segments[0].debut;
  const finVisible = finDe(segments[segments.length - 1]);
  const duree = Math.max(1, finVisible - debut);
  const heures = [];
  const premiere = new Date(debut);
  premiere.setMinutes(0, 0, 0);
  for (let h = premiere.getTime() + 3600000; h < finVisible; h += 3600000) heures.push(h);
  return (
    <div>
      <div className="relative rounded-lg overflow-hidden flex" style={{ height: hauteur, backgroundColor: PAPER }}>
        {segments.map((seg, i) => {
          const largeur = ((finDe(seg) - seg.debut) / duree) * 100;
          const titre = `${seg.meta.l} — ${heure(seg.debut)}${seg.fin != null ? ` à ${heure(seg.fin)}` : ' (durée inconnue)'}`;
          return (
            <span key={i} title={titre} style={seg.ms != null
              ? { width: `${largeur}%`, backgroundColor: seg.meta.color }
              : {
                width: `${largeur}%`,
                border: `1px dashed ${seg.meta.color}`,
                backgroundImage: `repeating-linear-gradient(45deg, ${seg.meta.color}, ${seg.meta.color} 3px, transparent 3px, transparent 7px)`,
              }} />
          );
        })}
        {/* Repères horaires en teinte de page, pas en blanc fixe : un blanc
            en dur se fond dans un segment de couleur pâle — déjà le cas côté
            DatABA. */}
        {heures.map((h) => (
          <span key={h} title={heure(h)} className="absolute top-0 bottom-0 w-px"
            style={{ left: `${((h - debut) / duree) * 100}%`, backgroundColor: `color-mix(in srgb, ${PAPER} 70%, transparent)` }} />
        ))}
      </div>
      <div className="flex justify-between text-xs mt-1" style={{ color: INK_SOFT, fontFamily: F_MONO }}>
        <span>{heure(debut)}</span>
        <span>{heure(finVisible)}</span>
      </div>
    </div>
  );
}

function BarresCrise({ titre, donnees: d, couleur, note, valeur, suffixe }) {
  if (!d.length || d.every((x) => !x.n)) return null;
  const max = Math.max(...d.map((x) => x.n)) || 1;
  return (
    <Card className="mb-3">
      <div className="text-xs uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>{titre}</div>
      {note && <p className="text-xs mb-2" style={{ color: INK_SOFT }}>{note}</p>}
      <div className="space-y-2 mt-2">
        {d.map((x, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="min-w-0 break-words pr-2">{x.label}</span>
              <span className="shrink-0" style={{ fontFamily: F_MONO, color: INK_SOFT }}>
                {valeur(x.n)}{suffixe}
              </span>
            </div>
            <div className="h-2 rounded-full" style={{ backgroundColor: PAPER }}>
              <div style={{ width: `${(x.n / max) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: x.couleur || couleur }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* Corps du bilan : tout ce qui va de la chronologie aux conséquences, dans
   l'ordre de l'onglet. « config.blocs » décide de ce qui apparaît. */
function BlocsCrise({ donnees, crises, periode, config, refChrono, onForme, onBasculerCourbe }) {
  /* Agrandissement de la chronologie, en modale (GrapheAgrandi) — état local,
     propre à ce bloc : contrairement aux objectifs (plusieurs cartes, une
     seule agrandie à la fois, coordonnée par PersonnesScreen), il n'y a ici
     qu'un seul graphique candidat, pas besoin de le faire remonter.
     `onForme`/`onBasculerCourbe` sont optionnels : BilanCrises (rapport
     imprimé) rend ce même composant sur une configuration figée, sans
     bouton pour la modifier — la modale y reste utilisable en lecture,
     simplement sans les contrôles qui n'ont pas de sens hors de l'écran
     Crises. */
  const [agrandi, setAgrandi] = useState(false);
  const refChronoAgrandi = useRef(null);
  const actif = (k) => (config.blocs || TOUS_LES_BLOCS).includes(k);
  const gran = periode.granularite || 'semaine';
  /* Jours observés bornés à la période affichée : joursObserves balaie tout
     l'historique, alors que `crises` arrive déjà filtré. Sans ce filtre l'axe
     s'étendrait au-delà de la période choisie. Mémoïsé : le balayage porte sur
     toutes les séances, crises et relevés. Le filtre par personne suit celui
     du bilan — une seule personne à la fois depuis le lot précédent. */
  const jours = useMemo(() => {
    const cible = (config.personnes || [])[0] || null;
    return new Set(Array.from(joursObserves(donnees, cible))
      .filter((j) => dansPeriode(`${j}T12:00:00`, periode)));
  }, [donnees.seances, donnees.crises, donnees.suivi, donnees.stabilite,
    donnees._idVersInitiales, config.personnes, periode]);
  const chrono = chronologieCrises(donnees, crises, gran, config.segmentation, config.mesure, jours);

  /* Lectures superposées à la chronologie : elles portent sur le total de
     chaque tranche (`_total`), jamais série par série — jusqu'à six séries,
     quatre courbes chacune serait illisible. */
  const totaux = chrono.donnees.map((d) => d._total);
  const courbesActives = config.courbes || [];
  const chronoTendance = courbesActives.includes('tendance') ? tendanceLineaire(totaux) : null;
  const chronoMobile = courbesActives.includes('mobile') ? moyenneMobile(totaux) : null;
  const chronoMoyenne = courbesActives.includes('moyenne') ? moyenneDe(totaux) : null;
  const chronoMediane = courbesActives.includes('mediane') ? medianeDe(totaux) : null;
  const donneesChrono = chrono.donnees.map((d, i) => ({
    ...d,
    Tendance: chronoTendance ? chronoTendance[i] : null,
    'Moyenne mobile': chronoMobile ? chronoMobile[i] : null,
  }));

  /* Le graphique lui-même, posé dans une variable plutôt qu'écrit deux fois :
     la version compacte de l'écran et la version agrandie de la modale
     l'utilisent telle quelle, à une hauteur de conteneur différente — la
     seule chose qui doit varier entre les deux. Réécrire ce ComposedChart
     une seconde fois pour la modale est exactement le risque de divergence
     que CLAUDE.md documente pour ce composant. */
  const grapheChronoEl = (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={donneesChrono} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid stroke={BORDER} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={34} />
        <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: INK, fontFamily: F_BODY, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {chronoMoyenne != null && (
          <ReferenceLine y={chronoMoyenne} stroke={INK_SOFT} strokeDasharray="2 3" strokeWidth={1.5}
            label={{ value: `moy. ${chronoMoyenne}`, position: 'insideTopLeft', fontSize: 10, fill: INK_SOFT }} />
        )}
        {chronoMediane != null && (
          <ReferenceLine y={chronoMediane} stroke={INK_SOFT} strokeDasharray="6 3" strokeWidth={1.5}
            label={{ value: `méd. ${chronoMediane}`, position: 'insideBottomLeft', fontSize: 10, fill: INK_SOFT }} />
        )}
        {config.forme === 'courbes'
          ? chrono.series.map((nom, i) => (
            <Line key={nom} type="monotone" dataKey={nom} stroke={PALETTE_SERIES[i % PALETTE_SERIES.length]}
              strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          ))
          : chrono.series.map((nom, i) => (
            <Bar key={nom} dataKey={nom} stackId="crises" fill={PALETTE_SERIES[i % PALETTE_SERIES.length]}
              radius={i === chrono.series.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
          ))}
        {/* Encre du thème et pointillés, jamais PALETTE_SERIES :
            elle est déjà prise par les séries de ce graphique, et
            les barres n'étant pas en encre le contraste tient.
            C'est l'inverse du choix fait dans `Graphique`, où la
            série occupe le bleu et les lectures prennent violet et
            ambre : une superposition doit contraster avec les
            séries de SON graphique, et les deux n'ont pas les
            mêmes. Ne pas « harmoniser » les deux endroits. */}
        {chronoTendance && <Line type="linear" dataKey="Tendance" stroke={INK} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
        {chronoMobile && <Line type="monotone" dataKey="Moyenne mobile" stroke={INK_SOFT} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  );

  const minutesDe = (c) => Math.round((c.durationMs || 0) / 60000);
  const chronometrees = crises.filter((c) => (c.durationMs || 0) > 0);
  const dureeTotale = crises.reduce((a, c) => a + minutesDe(c), 0);
  const dureeMoyenne = chronometrees.length
    ? Math.round(chronometrees.reduce((a, c) => a + minutesDe(c), 0) / chronometrees.length) : 0;
  const dureeMax = chronometrees.length ? Math.max(...chronometrees.map(minutesDe)) : 0;

  /* Période de comparaison : mêmes filtres (crisesRetenues), autre fenêtre.
     Rejoue les mêmes calculs de synthèse pour fournir la référence à Ecart —
     aucune nouvelle prop, BlocsCrise reçoit déjà donnees/config/periode. */
  const referencePeriode = periodeComparee(periode);
  const crisesRef = referencePeriode ? crisesRetenues(donnees, config, referencePeriode) : null;
  const chronometreesRef = crisesRef ? crisesRef.filter((c) => (c.durationMs || 0) > 0) : [];
  const noteesRef = crisesRef ? crisesRef.filter((c) => c.intensite).length : null;
  const dureeTotaleRef = crisesRef ? crisesRef.reduce((a, c) => a + minutesDe(c), 0) : null;
  const dureeMoyenneRef = chronometreesRef.length
    ? Math.round(chronometreesRef.reduce((a, c) => a + minutesDe(c), 0) / chronometreesRef.length) : null;
  const dureeMaxRef = chronometreesRef.length ? Math.max(...chronometreesRef.map(minutesDe)) : null;

  const compter = (valeurs) => {
    const m = new Map();
    valeurs.forEach((v) => m.set(v, (m.get(v) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const total = crises.length || 1;
  const valeur = (n) => (config.unite === 'pct' ? Math.round((n / total) * 100) : n);
  const suffixe = config.unite === 'pct' ? ' %' : '';

  const parIntensite = [1, 2, 3].map((n) => ({
    label: `${n} · ${INTENSITES[n].label}`,
    n: crises.filter((c) => c.intensite === n).length,
    couleur: INTENSITES[n].color,
  }));
  const notees = crises.filter((c) => c.intensite).length;
  const parJour = JOURS_SEMAINE.map((j) => ({
    label: j,
    n: crises.filter((c) => new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'long' }) === j).length,
  }));
  const enListe = (paires) => paires.map(([label, n]) => ({ label, n }));
  const parAtelier = compter(crises.map((c) => nomAtelier(donnees, c.source, c.atelierId)));
  const parAntecedent = compter(crises.flatMap((c) => c.antecedentTags || []));
  const parComportement = compter(crises.flatMap((c) => c.comportementTags || []));
  const parConsequence = compter(crises.flatMap((c) => c.consequenceTags || []));
  const parFonction = compter(crises.map((c) => (c.fonction ? (FONCTIONS[c.fonction] || c.fonction) : null)).filter(Boolean));

  return (
    <>
      {/* Bandeau de synthèse : une ligne, lisible sans lire les blocs qui
         suivent. Vit ici et non dans CrisesScreen — c'est ce qui le fait
         apparaître tel quel sur le document imprimé et dans le bilan joint à
         un rapport, sans seconde version qui finirait par diverger. */}
      {referencePeriode && crisesRef && (
        <p className="text-sm mb-3">
          <span style={{ fontFamily: F_MONO, fontWeight: 600 }}>{crises.length}</span> crise{crises.length !== 1 ? 's' : ''}
          {' '}contre <span style={{ fontFamily: F_MONO }}>{crisesRef.length}</span> sur {libelleComparaison(periode)}
          {' · '}<Ecart valeur={crises.length} reference={crisesRef.length} hausseFavorable={false} />
        </p>
      )}

      {actif('chronologie') && (
        <Card className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>Évolution dans le temps</div>
            {chrono.donnees.length > 0 && (
              <Btn variant="ghost" className="text-xs py-1 no-print" onClick={() => setAgrandi(true)}>Agrandir</Btn>
            )}
          </div>
          {chrono.donnees.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: INK_SOFT }}>Aucun enregistrement sur cette période.</p>
          ) : (
            <>
              {/* Un seul ComposedChart pour les deux formes : Recharts refuse
                  une <Line> de lecture dans un BarChart, et la branche
                  LineChart/BarChart ne différait que par le mark de ses
                  séries. Voir `grapheChronoEl` ci-dessus : cette même
                  instance sert aussi à la version agrandie, plus bas. */}
              <div style={{ height: 300 }} ref={refChrono}>{grapheChronoEl}</div>
              <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
                {config.mesure === 'duree' ? 'Minutes cumulées' : 'Nombre d’enregistrements'}, regroupé par {gran === 'jour' ? 'jour' : gran === 'mois' ? 'mois' : 'semaine'}.
                {chrono.regroupe && ' Les séries les moins fréquentes sont réunies sous « Autres ».'}
                {(SEGMENTATIONS.find((sg) => sg.k === config.segmentation) || {}).multi &&
                  " Un même enregistrement peut porter plusieurs valeurs : le total empilé dépasse alors le nombre d'enregistrements."}
                {config.mesure === 'duree' && " Une observation ABC n'a pas de durée : elle pèse zéro dans cette vue."}
                {' '}Une période sans crise compte pour zéro dès qu'elle porte une trace de la personne ;
                une période sans aucune trace — vacances, absence — n'apparaît pas, faute de pouvoir
                la distinguer d'un vrai zéro.
                {(chronoTendance || chronoMobile || chronoMoyenne != null || chronoMediane != null)
                  && " Les lectures superposées portent sur le total de chaque période, toutes séries confondues."}
              </p>
            </>
          )}
        </Card>
      )}

      {agrandi && (
        <GrapheAgrandi
          titre="Évolution des crises dans le temps"
          sousTitre={libellePeriode(periode)}
          styleOptions={onForme ? [{ k: 'barres', label: 'Barres' }, { k: 'courbes', label: 'Courbes' }] : null}
          style={config.forme} onStyle={onForme}
          courbes={onBasculerCourbe ? (config.courbes || []) : null} onBasculerCourbe={onBasculerCourbe}
          onExporterPng={() => exporterGraphePng(refChronoAgrandi.current, `crises-${nomSain(libellePeriode(periode))}.png`)}
          onFermer={() => setAgrandi(false)}>
          <div ref={refChronoAgrandi} style={{ height: '70vh' }}>{grapheChronoEl}</div>
        </GrapheAgrandi>
      )}

      {actif('synthese') && (
        <Card className="mb-3">
          <div className="flex flex-wrap items-baseline gap-4">
            <span>
              <span className="text-2xl font-semibold" style={{ fontFamily: F_MONO }}>{crises.length}</span>
              <span className="text-xs ml-1.5" style={{ color: INK_SOFT }}>
                enregistrement{crises.length !== 1 ? 's' : ''} sur {libellePeriode(periode)}
              </span>
              {referencePeriode && crisesRef && (
                <Ecart className="ml-1.5" valeur={crises.length} reference={crisesRef.length} hausseFavorable={false} />
              )}
            </span>
            {notees > 0 && (
              <span className="text-xs" style={{ color: INK_SOFT }}>
                dont <span style={{ fontFamily: F_MONO }}>{notees}</span> avec une intensité renseignée
                {referencePeriode && crisesRef && (
                  <Ecart className="ml-1.5" valeur={notees} reference={noteesRef} hausseFavorable={false} />
                )}
              </span>
            )}
          </div>
          {chronometrees.length > 0 && (
            <div className="flex flex-wrap gap-5 mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div>
                <div className="text-xl font-semibold" style={{ fontFamily: F_MONO, color: CRISE }}>{dureeTotale} min</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>durée cumulée</div>
                {referencePeriode && crisesRef && (
                  <Ecart valeur={dureeTotale} reference={dureeTotaleRef} unite=" min" hausseFavorable={false} />
                )}
              </div>
              <div>
                <div className="text-xl font-semibold" style={{ fontFamily: F_MONO }}>{dureeMoyenne} min</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>
                  en moyenne ({chronometrees.length}/{crises.length} chronométrée{chronometrees.length !== 1 ? 's' : ''})
                </div>
                {referencePeriode && crisesRef && (
                  <Ecart valeur={dureeMoyenne} reference={dureeMoyenneRef} unite=" min" hausseFavorable={false} />
                )}
              </div>
              <div>
                <div className="text-xl font-semibold" style={{ fontFamily: F_MONO }}>{dureeMax} min</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>la plus longue</div>
                {referencePeriode && crisesRef && (
                  <Ecart valeur={dureeMax} reference={dureeMaxRef} unite=" min" hausseFavorable={false} />
                )}
              </div>
            </div>
          )}
          {chronometrees.length === 0 && crises.length > 0 && (
            <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
              Aucune durée relevée sur cette période — les observations ABC n'en portent pas,
              et une crise n'en a que si le chronomètre a été lancé dans DatABA.
            </p>
          )}
        </Card>
      )}

      {actif('intensite') && (
        <BarresCrise titre="Occurrences par intensité" donnees={parIntensite} valeur={valeur} suffixe={suffixe}
          note={notees < crises.length ? `${crises.length - notees} enregistrement(s) sans intensité renseignée, non comptés ici.` : null} />
      )}
      {actif('jour') && <BarresCrise titre="Répartition par jour de la semaine" donnees={parJour} couleur={INK} valeur={valeur} suffixe={suffixe} />}
      {actif('atelier') && <BarresCrise titre="Répartition par atelier" donnees={enListe(parAtelier)} couleur={INK} valeur={valeur} suffixe={suffixe} />}
      {actif('antecedent') && <BarresCrise titre="Antécédents" donnees={enListe(parAntecedent)} couleur={CRISE} valeur={valeur} suffixe={suffixe} />}
      {actif('comportement') && <BarresCrise titre="Comportements" donnees={enListe(parComportement)} couleur={CRISE} valeur={valeur} suffixe={suffixe} />}
      {actif('consequence') && <BarresCrise titre="Conséquences" donnees={enListe(parConsequence)} couleur={CRISE} valeur={valeur} suffixe={suffixe} />}
      {actif('fonction') && <BarresCrise titre="Fonctions supposées" donnees={enListe(parFonction)} couleur={INK} valeur={valeur} suffixe={suffixe} />}
    </>
  );
}

/* Filtre commun à l'écran et au rapport : sans lui, le bilan inclus dans un
   document ne porterait pas exactement sur les mêmes enregistrements que
   celui qui a servi à le composer. */
function crisesRetenues(donnees, config, periode) {
  const iniDe = (c) => ((donnees._idVersInitiales || {})[c.source] || {})[c.studentId];
  return (donnees.crises || [])
    .filter((c) => (config.type === 'tout' || (c.kind || 'crise') === config.type))
    .filter((c) => !(config.personnes || []).length || config.personnes.includes(iniDe(c)))
    .filter((c) => dansPeriode(c.date, periode));
}

/* `config` vient de ManagerApp, pour la même raison que `unite` du tableau de
   bord : l'onglet est monté conditionnellement, et tout un bilan réglé —
   personne, type, segmentation, blocs — repartait de zéro au moindre passage
   par un autre onglet. */
function CrisesScreen({ donnees, periode, setPeriode, config, setConfig, contexte, setContexte, bandeau,
  composition, onValiderBilan, onAnnulerBilan, rapportEnCours, onJoindreAuRapport }) {
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const refChrono = useRef(null);
  const refZone = useRef(null);

  const maj = (champs) => setConfig((c) => ({ ...c, ...champs }));

  /* La personne regardée vient désormais du contexte partagé — la même que sur
     la fiche, les séances et Explorer. `config.personnes` reste le support :
     c'est lui que `BlocsCrise`, `BilanCrisesRapport` et un bilan enregistré
     dans `donnees.rapports` attendent, et le vider ici casserait le document
     composé. Il est donc tenu à jour depuis le contexte plutôt que saisi deux
     fois. Le tableau ne porte jamais plus d'une personne : un croisement de
     plusieurs se lisait comme un profil collectif alors que rien n'agrège
     leurs crises entre elles. */
  useEffect(() => {
    setConfig((c) => ({ ...c, personnes: contexte.personne ? [contexte.personne] : [] }));
  }, [contexte.personne]);

  /* Reprise d'un bilan déjà composé : on repart de ses réglages exacts plutôt
     que des réglages par défaut, sinon revenir le modifier le reconstruirait
     de zéro. Un bilan enregistré avant le passage à une personne à la fois
     peut porter plusieurs initiales dans `personnes` : normalisé à la
     première pour que l'écran n'affiche jamais un état qu'il ne sait plus
     produire. */
  useEffect(() => {
    if (!composition || !composition.config) return;
    const c = composition.config;
    const personnes = (c.personnes || []).length ? [c.personnes[0]] : [];
    setConfig({ ...c, personnes });
    /* Le contexte suit le bilan qu'on rouvre, sans quoi l'effet de
       synchronisation ci-dessus le remettrait aussitôt sur la personne
       courante et le bilan changerait de sujet en se rouvrant. */
    setContexte((ctx) => ({ ...ctx, personne: personnes[0] || null }));
  }, [composition && composition.jeton]);

  const retenues = crisesRetenues(donnees, config, periode);
  const basculerBloc = (k) => setConfig((c) => ({
    ...c,
    blocs: (c.blocs || []).includes(k) ? c.blocs.filter((x) => x !== k) : [...(c.blocs || []), k],
  }));

  const resumeReglages = [
    (config.personnes || []).length ? config.personnes.map((i) => nomAffiche(donnees, i)).join(', ') : 'Toutes les personnes',
    config.type === 'crise' ? 'Crises' : config.type === 'abc' ? 'Observations ABC' : 'Crises et observations',
    `par ${(periode.granularite || 'semaine') === 'jour' ? 'jour' : (periode.granularite || 'semaine') === 'mois' ? 'mois' : 'semaine'}`,
    `découpé par ${(SEGMENTATIONS.find((sg) => sg.k === config.segmentation) || {}).label.toLowerCase()}`,
    config.mesure === 'duree' ? 'durée cumulée en minutes' : 'nombre d’enregistrements',
  ].join(' · ');

  /* Même intention que `resumeGraphePersonnes` côté PersonnesScreen : dire
     dans la bande collante repliée quel type de graphique et quelles
     courbes sont en vigueur, sans avoir à déplier pour le savoir. */
  const resumeGrapheCrises = (config.forme === 'courbes' ? 'Courbes' : 'Barres')
    + ((config.courbes || []).length
      ? ` · ${config.courbes.length} lecture${config.courbes.length > 1 ? 's' : ''} superposée${config.courbes.length > 1 ? 's' : ''}`
      : '');

  if (!(donnees.crises || []).length) {
    return <Empty>Aucune crise ni observation importée.</Empty>;
  }

  return (
    <div>
      {composition && (
        /* Bandeau de composition : on est venu du rapport, il faut pouvoir y
           retourner sans se demander comment. */
        <Card className="mb-3 no-print" style={{ borderColor: INK, borderWidth: 2 }}>
          <div className="text-sm font-semibold mb-1" style={{ fontFamily: F_DISPLAY }}>
            Bilan de crise pour {nomAffiche(donnees, composition.personne)}
          </div>
          <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Réglez ci-dessous ce que doit contenir le bilan, puis validez : il sera repris
            dans le rapport, à la suite des objectifs.
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => onValiderBilan(config)} className="text-sm">
              <Check size={15} /> Valider et revenir au rapport
            </Btn>
            <Btn variant="ghost" onClick={onAnnulerBilan} className="text-sm">Annuler</Btn>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
        <div className="flex gap-1.5">
          {[
            { k: 'crise', l: 'Crises' },
            { k: 'abc', l: 'Observations' },
            { k: 'tout', l: 'Les deux' },
          ].map((o) => (
            <Chip key={o.k} label={`${o.l} (${(donnees.crises || []).filter((c) => o.k === 'tout' || (c.kind || 'crise') === o.k).length})`}
              on={config.type === o.k} onClick={() => maj({ type: o.k })} />
          ))}
        </div>
        <div className="ml-auto"><BasculeUnite unite={config.unite} setUnite={(u) => maj({ unite: u })} /></div>
      </div>

      {donnees.personnes.length > 0 && (
        /* Une personne à la fois : un croisement de plusieurs personnes se
           lisait comme un profil collectif alors que rien n'agrège vraiment
           leurs crises entre elles. Un appui remplace la sélection ; « Toutes
           les personnes » reste la remise à zéro. */
        <div className="flex flex-wrap gap-1.5 mb-3 no-print">
          <Chip label="Toutes les personnes" on={!(config.personnes || []).length}
            onClick={() => setContexte({ ...contexte, personne: null })} />
          {donnees.personnes.map((p) => (
            <Chip key={p.initials} label={nomAffiche(donnees, p.initials)}
              on={(config.personnes || []).includes(p.initials)}
              onClick={() => setContexte({ ...contexte,
                personne: (config.personnes || []).includes(p.initials) ? null : p.initials })} />
          ))}
        </div>
      )}

      {/* Type de graphique et courbes de tendance vivent dans le panneau
         collant, même endroit et même mécanique que sur l'écran Personnes
         (voir SelecteurPeriode) — le reste des réglages du bilan (mesure,
         segmentation, contenu) reste dans la carte « Réglages du bilan »
         ci-dessous, propre à cet écran.
         Posé en enfant direct du conteneur de l'écran, sans div
         intermédiaire : un `sticky` ne se déplace que dans les limites de
         son parent, et un wrapper serré autour de lui a exactement sa
         hauteur — la bande restait alors figée dans le flux, sans jamais
         suivre le défilement. Le `no-print` que portait ce wrapper est déjà
         sur la racine collante de SelecteurPeriode. */}
      <SelecteurPeriode periode={periode} setPeriode={setPeriode} avecGranularite avecComparaison collant
        bandeau={bandeau}
        resumeExtra={resumeGrapheCrises}
        extra={(
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Type de graphique</span>
              <Chip label="Barres" on={config.forme === 'barres'} onClick={() => maj({ forme: 'barres' })} />
              <Chip label="Courbes" on={config.forme === 'courbes'} onClick={() => maj({ forme: 'courbes' })} />
            </div>
            {/* Cumulables : chacune bascule indépendamment des autres. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Superposer</span>
              {COURBES_LECTURE.map((c) => (
                <Chip key={c.k} label={c.label} on={(config.courbes || []).includes(c.k)}
                  onClick={() => maj({ courbes: (config.courbes || []).includes(c.k)
                    ? config.courbes.filter((x) => x !== c.k)
                    : [...(config.courbes || []), c.k] })} />
              ))}
            </div>
          </div>
        )} />

      <Card className="mb-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>Réglages du bilan</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Btn variant="outline" className="text-xs py-1.5"
              onClick={() => exporterGraphePng(refChrono.current, `crises-${nomSain(libellePeriode(periode))}.png`)}>
              <Download size={13} /> PNG du graphique
            </Btn>
            <Btn variant="outline" className="text-xs py-1.5" onClick={() => imprimerZone(refZone.current)}>
              <Printer size={13} /> PDF du bilan
            </Btn>
            {/* Absent quand on est déjà venu composer ce bilan depuis le
               rapport : le bandeau ci-dessus tient déjà ce rôle, une seconde
               façon de faire la même chose finirait par diverger. Un rapport
               d'objectifs porte sur une personne, jamais sur « toutes » — le
               bouton le dit plutôt que de joindre au hasard la première de
               la liste. */}
            {!composition && (
              <Btn variant="outline" className="text-xs py-1.5"
                onClick={() => onJoindreAuRapport(config)}
                disabled={!(config.personnes || []).length}
                title={(config.personnes || []).length ? undefined : 'Filtrez sur une personne pour joindre ce bilan à un rapport.'}>
                <FileText size={13} /> {rapportEnCours && rapportEnCours.bilanCrises ? 'Remplacer le bilan du rapport' : 'Joindre à un rapport'}
              </Btn>
            )}
            <Btn variant="ghost" className="text-xs py-1.5" onClick={() => setReglagesOuverts((v) => !v)}>
              {reglagesOuverts ? 'Replier' : 'Modifier'}
            </Btn>
          </div>
        </div>

        {reglagesOuverts && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Mesurer</span>
              <Chip label="Nombre" on={config.mesure === 'nombre'} onClick={() => maj({ mesure: 'nombre' })} />
              <Chip label="Durée cumulée (min)" on={config.mesure === 'duree'} onClick={() => maj({ mesure: 'duree' })} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Découper par</span>
              {SEGMENTATIONS.map((sg) => (
                <Chip key={sg.k} label={sg.label} on={config.segmentation === sg.k} onClick={() => maj({ segmentation: sg.k })} />
              ))}
            </div>

            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>
              Contenu du bilan — décochez ce qui n'a pas à figurer dans le document
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BLOCS_CRISE.map((b) => (
                <Chip key={b.k} label={b.label} on={(config.blocs || []).includes(b.k)} onClick={() => basculerBloc(b.k)} />
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Btn variant="ghost" className="text-xs py-1" onClick={() => maj({ blocs: TOUS_LES_BLOCS })}>Tout inclure</Btn>
              <Btn variant="ghost" className="text-xs py-1" onClick={() => maj({ blocs: ['chronologie', 'synthese'] })}>Le minimum</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Zone exportée en PDF : le bilan tel qu'il est réglé, précédé de son
          titre et du rappel des réglages. F_DOC sur le conteneur, comme celui
          du rapport : un bilan imprimé seul depuis cet onglet doit sortir
          dans le même registre institutionnel qu'un bilan joint à un
          rapport — pas une seconde typographie selon la porte de sortie. */}
      <div ref={refZone} style={{ fontFamily: F_DOC }}>
        <div className="print-only" style={{ marginBottom: '0.75rem' }}>
          <div className="text-lg font-semibold">
            Bilan des crises — {libellePeriode(periode)}
          </div>
          <div className="text-xs" style={{ color: INK_SOFT }}>{resumeReglages}</div>
        </div>

        {retenues.length === 0 ? (
          <Empty>Aucun enregistrement sur cette période avec ces filtres.</Empty>
        ) : (
          <BlocsCrise donnees={donnees} crises={retenues} periode={periode} config={config} refChrono={refChrono}
            onForme={(f) => maj({ forme: f })}
            onBasculerCourbe={(k) => maj({ courbes: (config.courbes || []).includes(k)
              ? config.courbes.filter((x) => x !== k)
              : [...(config.courbes || []), k] })} />
        )}
      </div>
    </div>
  );
}

/* ==================== Personnes ==================== */
/* Aperçu des crises dans la fiche personne : occurrences seules, avec la
   tendance de la période. Volontairement dépouillé — il sert à repérer qu'il
   se passe quelque chose, l'analyse se fait dans l'onglet Crises, où il
   renvoie d'un appui. */
function ApercuCrises({ donnees, personne, crises, periode, granularite, onOuvrir }) {
  const vraies = crises.filter((c) => (c.kind || 'crise') === 'crise');

  /* Même règle que la chronologie de l'onglet Crises : une tranche existe dès
     qu'un jour y porte une trace de la personne, avec ou sans crise. Sans ce
     squelette, l'aperçu et le graphique détaillé afficheraient deux tendances
     différentes sur les mêmes données. */
  const paquets = new Map();
  Array.from(joursObserves(donnees, personne))
    .filter((j) => dansPeriode(`${j}T12:00:00`, periode))
    .forEach((j) => paquets.set(cleAgregation(`${j}T12:00:00`, granularite), 0));
  vraies.forEach((c) => {
    const k = cleAgregation(c.date, granularite);
    paquets.set(k, (paquets.get(k) || 0) + 1);
  });
  const ordonnes = Array.from(paquets.entries()).sort((a, b) => a[0] - b[0]);
  const valeurs = ordonnes.map(([, n]) => n);
  const tendance = tendanceLineaire(valeurs);
  const points = ordonnes.map(([k, n], i) => ({
    label: etiquetteAgregation(k, granularite),
    Crises: n,
    Tendance: tendance ? tendance[i] : null,
  }));

  const sens = sensTendance(valeurs);

  if (!vraies.length) return null;

  return (
    <button onClick={onOuvrir} className="w-full text-left rounded-2xl border p-4 mb-4"
      style={{ borderColor: BORDER, backgroundColor: CARD }}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} style={{ color: INK_SOFT }} />
        <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>Crises sur la période</span>
        <span className="text-sm font-semibold ml-1" style={{ fontFamily: F_MONO, color: CRISE }}>{vraies.length}</span>
        {sens && (
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: sens === 'en hausse' ? `${NON_ACQUIS}18` : `${ACQUIS}18`, color: sens === 'en hausse' ? NON_ACQUIS : ACQUIS }}>
            {sens}
          </span>
        )}
        <span className="text-xs ml-auto" style={{ color: INK }}>analyser →</span>
      </div>
      <div style={{ height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={34} />
            <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: INK, fontFamily: F_BODY, fontSize: 12 }} />
            <Bar dataKey="Crises" fill={CRISE} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            {tendance && <Line type="linear" dataKey="Tendance" stroke={INK} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs mt-1" style={{ color: INK_SOFT }}>
        Occurrences par {granularite === 'jour' ? 'jour' : granularite === 'mois' ? 'mois' : 'semaine'}
        {tendance && ', ligne pointillée : tendance'}. Les observations ABC ne sont pas comptées.
        Une période sans crise compte pour zéro dès qu'elle porte une trace de la personne ;
        une période sans aucune trace — vacances, absence — n'apparaît pas.
      </p>
    </button>
  );
}

/* Une courbe d'objectif et ses trois commandes : replier (pour se concentrer
   sur les autres), agrandir (une courbe dense est illisible à 220 px), et
   exporter en image (pour coller dans un compte rendu sans passer par une
   capture d'écran). */
function CarteObjectif({ ligne, donnees, personne, style, courbes, deplie, pourPdf, agrandi, surligne,
  onBasculerDeplie, onBasculerPdf, onAgrandir, onStyle, onBasculerCourbe }) {
  const refGraphe = useRef(null);
  const refGrapheAgrandi = useRef(null);
  const libelle = libelleAffiche(donnees, ligne.initials, ligne.objectif);
  const code = codeEflDe(donnees, ligne.objectif);

  /* Deux régimes d'affichage. Les objectifs cotés en pourcentage gardent leur
     courbe de séances et leur seuil. Ceux suivis en mesure brute passent par
     la moyenne par jour : sans ça, un jour à trois cotations déformerait la
     courbe et la tendance. */
  const enMesure = !ligne.points.length && (ligne.mesures || []).length > 0;
  const journalieres = enMesure ? moyennesParJour(ligne.mesures) : [];
  const evolution = enMesure ? evolutionMoyenne(journalieres) : null;
  const courbe = enMesure ? journalieres : ligne.points;
  const moyenne = journalieres.length
    ? Math.round((journalieres.reduce((a, j) => a + j.value, 0) / journalieres.length) * 10) / 10 : null;

  /* Une hausse de latence — ou d'un critère de suivi continu réglé « au plus »
     (un comportement-problème à faire baisser) — n'est pas un progrès : la
     couleur suit le sens de l'objectif, pas le signe du pourcentage.
     `ligne.sens` prime quand un seuil explicite l'a fixé ; à défaut, repli sur
     l'ancienne règle, qui ne connaissait que la latence. */
  const hausseFavorableUnite = ligne.sens ? ligne.sens !== 'max' : ligne.unite !== 's';
  const favorable = evolution && evolution.pct != null && evolution.pct !== 0
    ? ((evolution.pct > 0) === hausseFavorableUnite)
    : null;

  return (
    /* Repliée par défaut (vue bilan) : seul l'en-tête sort, une ligne par
       objectif. Ce qui part au document dépend de la case à cocher — pas du
       dépli, qui ne concerne que l'écran (voir lancerPdf côté
       PersonnesScreen, qui déplie les objectifs cochés juste avant
       d'imprimer). La modale d'agrandissement (GrapheAgrandi) est un frère
       de la carte, pas un enfant : elle a sa propre classe no-print et n'a
       pas à hériter du style de bordure surligné.
       `data-objectif` et `scrollMarginTop` : ancre du défilement direct
       depuis le Tableau de bord (voir l'effet de scroll de PersonnesScreen)
       — la marge compense la bande collante du sélecteur de période,
       repliée au moment de l'arrivée, sans quoi la carte visée se retrouve
       cachée derrière elle. */
    <>
    <Card data-objectif={ligne.objectif} className={pourPdf ? '' : 'no-print'}
      style={{ scrollMarginTop: '4.5rem', ...(surligne ? { borderColor: INK, borderWidth: 2 } : null) }}>
      <div className="flex items-start gap-2.5">
        <button onClick={onBasculerPdf} title={pourPdf ? 'Retirer du PDF' : 'Inclure dans le PDF'}
          className="w-5 h-5 mt-0.5 rounded border flex items-center justify-center shrink-0 text-xs no-print"
          style={{ borderColor: pourPdf ? ACCENT : BORDER, backgroundColor: pourPdf ? ACCENT : 'transparent', color: ACCENT_INK }}>
          {pourPdf ? '✓' : ''}
        </button>
        <button onClick={onBasculerDeplie} className="flex-1 min-w-0 flex items-start justify-between gap-3 text-left">
          <div className="min-w-0">
            <div className="text-sm font-medium break-words">
              {code && (
                <span className="text-xs mr-1.5 px-1.5 py-0.5 rounded"
                  style={{ fontFamily: F_MONO, backgroundColor: PAPER, color: INK_SOFT, border: `1px solid ${BORDER}` }}>
                  {code}
                </span>
              )}
              {libelle}
            </div>
            {deplie && (
              <div className="text-xs" style={{ color: INK_SOFT }}>
                {enMesure ? (
                  <>
                    {journalieres.length} jour{journalieres.length !== 1 ? 's' : ''} de relevé
                    {moyenne != null && ` · ${moyenne} ${ligne.unite} par jour en moyenne`}
                    {libelleSeuil(ligne) && ` · ${libelleSeuil(ligne)}`}
                  </>
                ) : (
                  <>
                    {ligne.points.length} séance{ligne.points.length !== 1 ? 's' : ''}
                    {libelleSeuil(ligne) && ` · ${libelleSeuil(ligne)}`}
                  </>
                )}
              </div>
            )}
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-lg shrink-0"
            style={{ backgroundColor: ETATS[ligne.etat].color, color: texteLisibleSur(ETATS[ligne.etat].color), fontFamily: F_DISPLAY }}>
            {deplie ? ETATS[ligne.etat].label : ETATS[ligne.etat].court}
          </span>
        </button>
      </div>

      {deplie && enMesure && (
        <div className="rounded-xl px-3 py-2 mt-2 mb-2" style={{ backgroundColor: PAPER }}>
          {evolution ? (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-lg font-semibold" style={{ fontFamily: F_MONO, color: favorable === null ? INK : favorable ? ACQUIS : NON_ACQUIS }}>
                  {evolution.pct != null
                    ? `${evolution.pct > 0 ? '+' : ''}${evolution.pct} %`
                    : `${evolution.depart} → ${evolution.arrivee} ${ligne.unite}`}
                </span>
                <span className="text-xs" style={{ color: INK_SOFT }}>
                  {evolution.pct != null && `de ${evolution.depart} à ${evolution.arrivee} ${ligne.unite} · `}
                  sur {evolution.jours} jours de relevé
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: INK_SOFT }}>
                Évolution de la moyenne quotidienne, lue sur la tendance de la période et non sur le
                premier et le dernier jour.
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: INK_SOFT }}>
              Moins de {MIN_JOURS_EVOLUTION} jours de relevé : une progression chiffrée ne voudrait rien dire ici.
            </p>
          )}
        </div>
      )}

      {deplie && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 mt-2 no-print">
          <Btn variant="ghost" onClick={onBasculerDeplie} className="text-xs py-1">
            Replier
          </Btn>
          {courbe.length > 0 && (
            <>
              <Btn variant="ghost" onClick={onAgrandir} className="text-xs py-1">
                {agrandi ? 'Réduire' : 'Agrandir'}
              </Btn>
              <Btn variant="ghost" className="text-xs py-1"
                onClick={() => exporterGraphePng(refGraphe.current, `${nomSain(nomAffiche(donnees, personne))}-${nomSain(libelle)}.png`)}>
                <Download size={13} /> PNG
              </Btn>
            </>
          )}
        </div>
      )}

      {deplie && (courbe.length ? (
        <div ref={refGraphe}>
          {/* Le seuil se trace aussi sur une série de mesures brutes, dès lors
              qu'un critère s'y applique — c'est le cas du comptage
              d'occurrences. `ligne.threshold` est déjà nul quand aucun
              critère ne vaut pour cette série. */}
          <Graphique points={courbe} style={style} courbes={courbes} seuil={ligne.threshold}
            hauteur={surligne ? 300 : 220} phases={ligne.phaseHistory}
            unite={enMesure ? ligne.unite : '%'} />
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: INK_SOFT }}>Aucune donnée sur cette période.</p>
      ))}
    </Card>

    {/* Agrandir n'ouvre plus une version plus haute de la même carte : la
       modale reprend le graphique en grand avec ses contrôles (type de
       graphique, courbes superposées, export PNG) — tout ce qui est
       disponible sur la carte, pas seulement plus de place. */}
    {agrandi && courbe.length > 0 && (
      <GrapheAgrandi
        titre={`${nomAffiche(donnees, personne)} · ${libelle}`}
        sousTitre={libelleSeuil(ligne) || undefined}
        styleOptions={STYLES_GRAPHIQUE} style={style} onStyle={onStyle}
        courbes={courbes} onBasculerCourbe={onBasculerCourbe}
        onExporterPng={() => exporterGraphePng(refGrapheAgrandi.current, `${nomSain(nomAffiche(donnees, personne))}-${nomSain(libelle)}.png`)}
        onFermer={onAgrandir}>
        <div ref={refGrapheAgrandi}>
          <Graphique points={courbe} style={style} courbes={courbes} seuil={ligne.threshold}
            hauteur="70vh" phases={ligne.phaseHistory} unite={enMesure ? ligne.unite : '%'} />
        </div>
      </GrapheAgrandi>
    )}
    </>
  );
}

/* `graphe` ({ style, courbes }) vient de ManagerApp : les onglets sont montés
   conditionnellement, un réglage d'affichage posé en état local repart de sa
   valeur initiale à chaque aller-retour — même raison que `unite` du tableau
   de bord et `config` du bilan de crise. */
/* Unités qu'un critère de suivi continu peut apporter comme objectif, jour par
   jour. Un compteur n'a pas ce choix — il compte toujours ses appuis, voir
   UNITES_OBJECTIF_SUIVI et lignesSuiviContinu. */
const UNITES_CHOIX_CRITERE = [
  { k: 'part', label: 'Part du temps borné (%)' },
  { k: 'minutes', label: 'Minutes cumulées' },
  { k: 'episodes', label: "Nombre d'épisodes" },
];

/* Réglage « compte comme un objectif » d'un critère ou d'un compteur — pose ou
   efface une entrée de `donnees.objectifsSuivi`. `uniteChoix` absent = un
   compteur : rien à choisir, son unité est toujours le nombre d'appuis. */
function ReglageObjectifSuivi({ reglage, uniteChoix, onChange }) {
  const actif = !!(reglage && reglage.actif);
  const unite = (reglage && reglage.unite) || (uniteChoix ? uniteChoix[0].k : 'occurrences');
  const seuilPose = reglage && reglage.seuil != null;
  const seuil = seuilPose ? reglage.seuil : '';
  const jours = (reglage && reglage.jours) || 1;
  const sens = (reglage && reglage.sens) || 'min';
  const maj = (patch) => onChange({ actif, unite, seuil: seuilPose ? reglage.seuil : null, jours, sens, ...patch });

  return (
    <div className="mt-2 pt-2 space-y-2" style={{ borderTop: `1px solid ${BORDER}` }}>
      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: INK_SOFT }}>
        <input type="checkbox" checked={actif} onChange={(e) => maj({ actif: e.target.checked })} />
        Compte comme un objectif — apparaît au Tableau de bord et dans le bilan des objectifs
      </label>
      {actif && (
        <div className="flex flex-wrap items-end gap-2 pl-5">
          {uniteChoix && (
            <div>
              <div className="text-xs mb-1" style={{ color: INK_SOFT }}>Valeur retenue chaque jour</div>
              <select value={unite} onChange={(e) => maj({ unite: e.target.value })}
                className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: BORDER, color: INK }}>
                {uniteChoix.map((u) => <option key={u.k} value={u.k}>{u.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <div className="text-xs mb-1" style={{ color: INK_SOFT }}>Seuil (optionnel)</div>
            <input type="number" value={seuil} placeholder="aucun"
              onChange={(e) => maj({ seuil: e.target.value === '' ? null : Number(e.target.value) })}
              className="w-20 rounded-lg border px-2 py-1 text-xs" style={{ borderColor: BORDER, color: INK, fontFamily: F_MONO }} />
          </div>
          {seuilPose && (
            <>
              <div>
                <div className="text-xs mb-1" style={{ color: INK_SOFT }}>Jours consécutifs</div>
                <input type="number" min={1} value={jours}
                  onChange={(e) => maj({ jours: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-16 rounded-lg border px-2 py-1 text-xs" style={{ borderColor: BORDER, color: INK, fontFamily: F_MONO }} />
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: INK_SOFT }}>Sens</div>
                <select value={sens} onChange={(e) => maj({ sens: e.target.value })}
                  className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: BORDER, color: INK }}>
                  <option value="min">Au moins</option>
                  <option value="max">Au plus</option>
                </select>
              </div>
            </>
          )}
        </div>
      )}
      {actif && !seuilPose && (
        <p className="text-xs pl-5" style={{ color: INK_SOFT }}>
          Sans seuil, l'objectif reste « Suivi en mesure », lu à son évolution.
        </p>
      )}
    </div>
  );
}

/* Une série choisie dans un graphique, avec sa couleur, un bouton par option.
   La couleur affichée est celle propre à l'option (identité de la donnée), la
   bordure suit la sélection (règle de l'Accent Seul) — même patron que les
   boutons de journée de la frise. */
function SelecteurSeries({ options, selection, onToggle, nomOption, max = SERIES_MAX }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selection.includes(o.valeur);
        const desactive = !on && selection.length >= max;
        const c = o.type === 'compteur' ? o.couleur : o.meta.color;
        return (
          <button key={o.valeur} type="button" disabled={desactive} onClick={() => onToggle(o.valeur)}
            className="rounded-lg px-2.5 py-1.5 text-xs border flex items-center gap-1.5 disabled:opacity-40"
            style={{ borderColor: on ? ACCENT : BORDER, backgroundColor: on ? ACCENT_WASH : 'transparent', color: on ? ACCENT : INK_SOFT }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
            {nomOption(o)}
          </button>
        );
      })}
      {selection.length >= max && (
        <span className="text-xs self-center" style={{ color: INK_SOFT }}>{max} séries maximum</span>
      )}
    </div>
  );
}

/* Couleur effective de chaque série d'un graphique : celle de l'option, sauf
   collision avec une couleur déjà prise dans la même sélection — deux séries
   de la même teinte seraient indiscernables. `items` porte déjà l'id interne
   (`s0`, `c1`, …) qui sert de clé de donnée Recharts, indépendant de la clé
   `critere:`/`compteur:` utilisée pour le réglage d'objectif. */
function couleursSeries(items) {
  const utilisees = new Set();
  const couleurs = {};
  items.forEach(({ id, couleurNaturelle }) => {
    let c = couleurNaturelle;
    if (utilisees.has(c)) c = PALETTE_SERIES.find((p) => !utilisees.has(p)) || CAT_SLATE;
    utilisees.add(c);
    couleurs[id] = c;
  });
  return couleurs;
}

/* Une tendance par série sélectionnée, calculée sur les seules tranches où
   CETTE série est connue — chaque série a son propre support, un trou n'est
   jamais comblé par la valeur d'une autre. Rendu aligné sur `donneesGraphe`
   (même longueur, `null` hors support) pour un simple dataKey Recharts.

   Avec exactement deux séries, le croisement redevient significatif : calculé
   sur leur support COMMUN (comparer deux droites ajustées sur des supports
   différents ferait dire à leur rencontre une chose qu'aucune des deux ne
   dit), et seulement rendu s'il tombe dans la période observée — rien n'est
   prolongé au-delà du dernier point. Au-delà de deux séries, aucun croisement
   n'est annoncé : il faudrait choisir laquelle des paires commenter. */
function ajusterTendances(donneesGraphe, ids) {
  const fits = {};
  let trancheCroisement = null;

  if (ids.length === 2) {
    const [k0, k1] = ids;
    const communes = [];
    donneesGraphe.forEach((d, i) => { if (d[k0] != null && d[k1] != null) communes.push(i); });
    const fit0 = tendanceLineaire(communes.map((i) => donneesGraphe[i][k0]));
    const fit1 = tendanceLineaire(communes.map((i) => donneesGraphe[i][k1]));
    if (fit0 && fit1) {
      fits[k0] = new Array(donneesGraphe.length).fill(null);
      fits[k1] = new Array(donneesGraphe.length).fill(null);
      communes.forEach((i, j) => { fits[k0][i] = fit0[j]; fits[k1][i] = fit1[j]; });
      const croisement = croisementTendances(fit0, fit1);
      if (croisement) trancheCroisement = donneesGraphe[communes[Math.round(croisement.index)]] || null;
    }
    return { fits, trancheCroisement };
  }

  ids.forEach((k) => {
    const idx = [];
    donneesGraphe.forEach((d, i) => { if (d[k] != null) idx.push(i); });
    const fit = tendanceLineaire(idx.map((i) => donneesGraphe[i][k]));
    if (fit) {
      fits[k] = new Array(donneesGraphe.length).fill(null);
      idx.forEach((i, j) => { fits[k][i] = fit[j]; });
    }
  });
  return { fits, trancheCroisement: null };
}

/* Texte sous un graphique de suivi : ce que dit le repère de croisement (ou
   son absence), commun aux deux graphiques de SuiviContinuVue. */
function texteTendances(series, fits, croisement) {
  if (series.length < 2) {
    return 'Superposez une seconde série pour comparer deux tendances et faire apparaître un repère de croisement.';
  }
  if (series.length === 2) {
    if (!fits[series[0].id] || !fits[series[1].id]) {
      return 'Les tendances demandent au moins trois tranches où les deux séries sont connues.';
    }
    if (croisement) return null;
    return 'Les deux tendances ne se croisent pas sur la période affichée ; elles ne sont pas prolongées au-delà.';
  }
  return "Le repère de croisement n'apparaît qu'à deux séries affichées ; au-delà, chaque tendance reste tracée seule.";
}

/* ==================== Suivi continu d'une personne ====================
   Trois lectures des mêmes relevés, exclusives à l'écran : la frise d'une
   journée avec la répartition sur la période, le graphique du suivi continu
   (N critères, chacun avec sa tendance) et celui des compteurs d'occurrence —
   deux natures de données, deux graphiques agrandissables et exportables,
   plutôt qu'un seul contraint à cohabiter.

   Composant à part plutôt que bloc de rendu dans PersonnesScreen : il lui faut
   son propre état (mode, sélection de séries, journée affichée), qu'une IIFE
   dans un rendu ne peut pas porter. Monté avec `key={personne}` : changer de
   personne repart d'un état neuf, sans effet de remise à zéro. */
function SuiviContinuVue({ donnees, personne, periode, lignes, onObjectifSuivi }) {
  const [mode, setMode] = useState('frise');
  /* Journée affichée dans la frise. null = pas de choix explicite, la dernière
     journée cotée sert de défaut — dérivé au moment du rendu, pas par un
     effet, pour que le choix survive à un changement de période tant que la
     journée y reste. */
  const [jourChoisi, setJourChoisi] = useState(null);
  /* Séries choisies dans chacun des deux graphiques — critères de suivi et
     compteurs d'occurrence sont deux natures de données, deux graphiques
     indépendants. Vides tant que rien n'a été choisi : la valeur effective se
     dérive au rendu (voir plus bas), sur le même principe que hausseEff avant
     elle. */
  const [selectionSuivi, setSelectionSuivi] = useState([]);
  const [selectionCompteurs, setSelectionCompteurs] = useState([]);
  const [mesureSuivi, setMesureSuivi] = useState('duree');
  const [uniteSuivi, setUniteSuivi] = useState('pct');
  /* Une tendance par série affichée, pas une lecture superposée globale : ce
     n'est donc pas COURBES_LECTURE, un simple interrupteur suffit par
     graphique. */
  const [tendancesSuivi, setTendancesSuivi] = useState(true);
  const [tendancesCompteurs, setTendancesCompteurs] = useState(true);
  const [styleSuivi, setStyleSuivi] = useState('lignes');
  const [styleCompteurs, setStyleCompteurs] = useState('lignes');
  const [agrandiSuivi, setAgrandiSuivi] = useState(false);
  const [agrandiCompteurs, setAgrandiCompteurs] = useState(false);
  const refGrapheSuivi = useRef(null);
  const refGrapheSuiviAgrandi = useRef(null);
  const refGrapheCompteurs = useRef(null);
  const refGrapheCompteursAgrandi = useRef(null);
  /* Clé de la série dont le réglage d'objectif est ouvert — un seul foyer à
     la fois, comme `agrandi` ailleurs dans l'application. */
  const [reglageOuvert, setReglageOuvert] = useState(null);

  const tousReleves = suiviDePersonne(donnees, personne);
  const releves = tousReleves.filter((r) => dansPeriode(r.timestamp, periode));
  const referencePeriode = periodeComparee(periode);
  const relevesRef = referencePeriode ? tousReleves.filter((r) => dansPeriode(r.timestamp, referencePeriode)) : [];

  /* Les appuis de compteur d'occurrence vivent dans la même table que les
     relevés d'état mais n'en sont pas : ils se comptent, ils ne durent pas.
     Deux flux séparés jusqu'au bout, réunis seulement dans le graphique. */
  const tousCompteurs = compteursDePersonne(donnees, personne);
  const relevesCompteur = tousCompteurs.filter((r) => dansPeriode(r.timestamp, periode));
  const compteursRef = referencePeriode ? tousCompteurs.filter((r) => dansPeriode(r.timestamp, referencePeriode)) : [];

  if (!releves.length && !relevesCompteur.length) {
    return <Empty>Aucun relevé de suivi continu sur la période.</Empty>;
  }

  /* Une carte par axe : le nombre d'axes n'est pas borné côté DatABA. */
  const parAxeMap = (liste) => {
    const m = new Map();
    liste.forEach((r) => {
      if (!m.has(r.nomAxe)) m.set(r.nomAxe, []);
      m.get(r.nomAxe).push(r);
    });
    return m;
  };
  const parAxe = parAxeMap(releves);
  const parAxeRef = parAxeMap(relevesRef);

  /* Regroupement par identifiant et non par nom : deux compteurs peuvent
     porter le même intitulé sur deux tablettes différentes. */
  const parCompteurMap = (liste) => {
    const m = new Map();
    liste.forEach((r) => {
      if (!m.has(r.compteurId)) m.set(r.compteurId, { compteurId: r.compteurId, nom: r.nomCompteur, releves: [] });
      m.get(r.compteurId).releves.push(r);
    });
    return m;
  };
  const parCompteur = parCompteurMap(relevesCompteur);
  const parCompteurRef = parCompteurMap(compteursRef);

  /* Journées cotées sur la période, la plus récente en tête : c'est parmi
     elles que se choisit la frise. Le choix explicite est ignoré s'il ne fait
     plus partie de la période affichée. Une journée où seul un compteur a
     servi en fait partie — elle n'aura pas de frise, mais elle a bien un
     total. */
  const jours = Array.from(new Set([...releves, ...relevesCompteur].map((r) => jourLocal(r.timestamp))))
    .filter(Boolean).sort().reverse();
  const jourAffiche = jourChoisi && jours.includes(jourChoisi) ? jourChoisi : jours[0];
  const iJour = jours.indexOf(jourAffiche);
  const minutes = (ms) => Math.round(ms / 60000);
  const libelleJour = (j, court) => new Date(`${j}T12:00:00`).toLocaleDateString('fr-FR',
    court ? { weekday: 'short', day: '2-digit', month: '2-digit' }
      : { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });

  /* --- Options de série, communes aux deux graphiques --- */
  const segments = segmentsSuivi(releves);
  const gran = periode.granularite || 'jour';

  /* Un critère ne figure dans les menus que s'il a au moins un segment borné :
     un critère qu'on ne peut ni cumuler ni compter n'aurait pas de courbe. */
  const optionsMap = new Map();
  segments.forEach((s) => {
    if (s.ms == null) return;
    const k = cleSerieSuivi(s.nomAxe, s.cle);
    if (!optionsMap.has(k)) {
      optionsMap.set(k, { valeur: `critere:${k}`, type: 'critere', k, nomAxe: s.nomAxe, cle: s.cle, meta: s.meta });
    }
  });
  const optionsCriteres = Array.from(optionsMap.values());
  const optionsCompteurs = Array.from(parCompteur.values()).map((c, i) => ({
    valeur: `compteur:${c.compteurId}`,
    type: 'compteur',
    k: cleSerieCompteur(c.compteurId),
    compteurId: c.compteurId,
    nom: c.nom,
    /* Un compteur n'a pas de couleur côté DatABA : il prend la palette
       catégorielle des séries, comme les chronologies de crise. */
    couleur: PALETTE_SERIES[i % PALETTE_SERIES.length],
  }));
  const axesDesOptions = Array.from(new Set(optionsCriteres.map((o) => o.nomAxe)));
  const nomCritere = (o) => (o.type === 'compteur' ? o.nom
    : (o.meta === CRITERE_INCONNU_SUIVI ? `${o.meta.l} (${o.cle})` : o.meta.l));
  const nomSerie = (o) => (o.type === 'compteur' || axesDesOptions.length <= 1
    ? nomCritere(o) : `${nomCritere(o)} · ${o.nomAxe}`);

  /* Le sens attendu d'une hausse, pour colorer les écarts de la répartition et
     des compteurs, vient du réglage d'objectif quand il en existe un avec un
     seuil — c'est lui qui sait si la hausse est voulue. Sans réglage, ou sans
     seuil, une hausse reste neutre-favorable faute d'en savoir plus. */
  const reglageDe = (cleSerie) => (donnees.objectifsSuivi || {})[cleObjectifSuivi(personne, cleSerie)];
  const favorablePour = (cleSerie) => {
    const r = reglageDe(cleSerie);
    if (!r || !r.actif || r.seuil == null) return true;
    return r.sens !== 'max';
  };

  /* --- Graphique du suivi continu --- */
  const valideSuivi = (v) => optionsCriteres.some((o) => o.valeur === v);
  const selectionSuiviEff = selectionSuivi.some(valideSuivi)
    ? selectionSuivi.filter(valideSuivi)
    : optionsCriteres.slice(0, 2).map((o) => o.valeur);
  const onToggleSuivi = (v) => setSelectionSuivi(
    selectionSuiviEff.includes(v) ? selectionSuiviEff.filter((x) => x !== v) : [...selectionSuiviEff, v].slice(0, SERIES_MAX)
  );
  const seriesSuivi = selectionSuiviEff
    .map((v) => optionsCriteres.find((o) => o.valeur === v))
    .filter(Boolean)
    .map((o, i) => ({ ...o, id: `s${i}`, couleurNaturelle: o.meta.color }));
  const couleursSuivi = couleursSeries(seriesSuivi);
  const suffixeSuivi = uniteSuivi === 'pct' ? ' %' : (mesureSuivi === 'occurrences' ? '' : ' min');
  const tranchesSuivi = chronologieSuivi(segments, gran, mesureSuivi);
  /* Une tranche où l'axe du critère n'a rien de borné laisse un trou, pas un
     zéro : le critère n'y était pas à zéro, il n'y a rien eu d'observé sur son
     axe. */
  const donneesGrapheSuivi = tranchesSuivi.map((t) => {
    const row = { label: t.label };
    seriesSuivi.forEach((s) => {
      const v = t.series[s.k];
      row[s.id] = v ? (uniteSuivi === 'pct' ? v.part : v.valeur)
        : (Object.values(t.series).some((x) => x.nomAxe === s.nomAxe) ? 0 : null);
    });
    return row;
  });
  const { fits: fitsSuivi, trancheCroisement: croisementSuivi } = ajusterTendances(donneesGrapheSuivi, seriesSuivi.map((s) => s.id));
  if (tendancesSuivi) {
    seriesSuivi.forEach((s) => {
      donneesGrapheSuivi.forEach((row, i) => { row[`t_${s.id}`] = fitsSuivi[s.id] ? fitsSuivi[s.id][i] : null; });
    });
  }
  const texteSuivi = tendancesSuivi ? texteTendances(seriesSuivi, fitsSuivi, croisementSuivi) : null;

  const grapheSuiviEl = (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={donneesGrapheSuivi} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
        <CartesianGrid stroke={BORDER} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
        <YAxis domain={uniteSuivi === 'pct' ? [0, 100] : undefined} allowDecimals={false}
          tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: INK, fontFamily: F_BODY, fontSize: 12 }}
          formatter={(v, n) => [`${v}${suffixeSuivi}`, n]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {croisementSuivi && <ReferenceLine x={croisementSuivi.label} stroke={INK_SOFT} strokeDasharray="3 3" />}
        {seriesSuivi.map((s) => (
          styleSuivi === 'barres' ? (
            <Bar key={s.id} dataKey={s.id} name={nomSerie(s)} fill={couleursSuivi[s.id]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ) : (
            <Line key={s.id} dataKey={s.id} name={nomSerie(s)} stroke={couleursSuivi[s.id]}
              strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          )
        ))}
        {/* Tendances : même couleur que leur série, en pointillé fin — c'est ce
            qui les rattache à l'une ou à l'autre. Avec plusieurs séries, une
            couleur de contraste unique ne dirait plus de laquelle chaque
            droite parle. */}
        {tendancesSuivi && seriesSuivi.map((s) => fitsSuivi[s.id] && (
          <Line key={`t-${s.id}`} dataKey={`t_${s.id}`} name={`Tendance · ${nomCritere(s)}`} stroke={couleursSuivi[s.id]}
            strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );

  /* --- Graphique des compteurs d'occurrence --- */
  const valideCompteur = (v) => optionsCompteurs.some((o) => o.valeur === v);
  const selectionCompteursEff = selectionCompteurs.some(valideCompteur)
    ? selectionCompteurs.filter(valideCompteur)
    : optionsCompteurs.slice(0, SERIES_MAX).map((o) => o.valeur);
  const onToggleCompteurs = (v) => setSelectionCompteurs(
    selectionCompteursEff.includes(v) ? selectionCompteursEff.filter((x) => x !== v) : [...selectionCompteursEff, v].slice(0, SERIES_MAX)
  );
  const seriesCompteurs = selectionCompteursEff
    .map((v) => optionsCompteurs.find((o) => o.valeur === v))
    .filter(Boolean)
    .map((o, i) => ({ ...o, id: `c${i}`, couleurNaturelle: o.couleur }));
  const couleursCompteurs = couleursSeries(seriesCompteurs);
  const tranchesCompteurs = chronologieCompteurs(relevesCompteur, gran);
  const donneesGrapheCompteurs = tranchesCompteurs.map((t) => {
    const row = { label: t.label };
    seriesCompteurs.forEach((s) => { const v = t.series[s.k]; row[s.id] = v ? v.valeur : 0; });
    return row;
  });
  const { fits: fitsCompteurs, trancheCroisement: croisementCompteurs } = ajusterTendances(donneesGrapheCompteurs, seriesCompteurs.map((s) => s.id));
  if (tendancesCompteurs) {
    seriesCompteurs.forEach((s) => {
      donneesGrapheCompteurs.forEach((row, i) => { row[`t_${s.id}`] = fitsCompteurs[s.id] ? fitsCompteurs[s.id][i] : null; });
    });
  }
  const texteCompteurs = tendancesCompteurs ? texteTendances(seriesCompteurs, fitsCompteurs, croisementCompteurs) : null;

  const grapheCompteursEl = (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={donneesGrapheCompteurs} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
        <CartesianGrid stroke={BORDER} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: INK, fontFamily: F_BODY, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {croisementCompteurs && <ReferenceLine x={croisementCompteurs.label} stroke={INK_SOFT} strokeDasharray="3 3" />}
        {seriesCompteurs.map((s) => (
          styleCompteurs === 'barres' ? (
            <Bar key={s.id} dataKey={s.id} name={s.nom} fill={couleursCompteurs[s.id]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ) : (
            <Line key={s.id} dataKey={s.id} name={s.nom} stroke={couleursCompteurs[s.id]}
              strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          )
        ))}
        {tendancesCompteurs && seriesCompteurs.map((s) => fitsCompteurs[s.id] && (
          <Line key={`t-${s.id}`} dataKey={`t_${s.id}`} name={`Tendance · ${s.nom}`} stroke={couleursCompteurs[s.id]}
            strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );

  const nomFichier = (suffixe) => `${nomSain(nomAffiche(donnees, personne))}-${suffixe}.png`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <Chip label="Frise du jour" on={mode === 'frise'} onClick={() => setMode('frise')} />
        <Chip label="Graphique" on={mode === 'graphique'} onClick={() => setMode('graphique')} />
      </div>

      <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
        Les durées ci-dessous excluent les relevés jamais bornés par une clôture ou un
        changement d'état : une durée pas encore connue n'entre pas dans un pourcentage.
      </p>

      {mode === 'frise' && (
        <>
          {/* Une pastille par jour coté devenait illisible dès quelques
              semaines de relevés : la ligne ci-dessous tient la même
              information quelle que soit la quantité de données, et ne
              propose que des journées réellement cotées. */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Btn variant="outline" className="text-xs px-2 py-1.5"
              disabled={iJour >= jours.length - 1}
              onClick={() => setJourChoisi(jours[iJour + 1])} title="Journée cotée précédente">
              <ChevronLeft size={14} />
            </Btn>
            <select value={jourAffiche} onChange={(e) => setJourChoisi(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-xs"
              style={{ borderColor: BORDER, color: INK, fontFamily: F_MONO }}>
              {jours.map((j) => <option key={j} value={j}>{libelleJour(j, false)}</option>)}
            </select>
            <Btn variant="outline" className="text-xs px-2 py-1.5"
              disabled={iJour <= 0}
              onClick={() => setJourChoisi(jours[iJour - 1])} title="Journée cotée suivante">
              <ChevronRight size={14} />
            </Btn>
            <span className="text-xs" style={{ color: INK_SOFT }}>
              {jours.length} journée{jours.length !== 1 ? 's' : ''} cotée{jours.length !== 1 ? 's' : ''} sur la période
            </span>
          </div>

          <div className="space-y-4">
            {Array.from(parAxe.entries()).map(([nomAxeVal, rs]) => {
              const rsJour = rs.filter((r) => jourLocal(r.timestamp) === jourAffiche)
                .slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              const segmentsJour = segmentsJournee(rsJour);
              const repar = repartitionCriteres(segmentsSuivi(rs));
              const reparRef = referencePeriode ? repartitionCriteres(segmentsSuivi(parAxeRef.get(nomAxeVal) || [])) : null;
              return (
                <Card key={nomAxeVal}>
                  <div className="text-sm font-semibold mb-2" style={{ fontFamily: F_DISPLAY }}>
                    {nomAxeVal} <span className="font-normal text-xs" style={{ color: INK_SOFT }}>· {rs.length} relevé{rs.length !== 1 ? 's' : ''} sur la période</span>
                  </div>

                  {segmentsJour.length > 0 ? (
                    <div className="mb-4"><FriseSuivi segments={segmentsJour} /></div>
                  ) : (
                    <div className="text-xs mb-4" style={{ color: INK_SOFT }}>Rien de coté ce jour-là sur cet axe.</div>
                  )}

                  <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>
                    Sur la période{referencePeriode ? ` · écart vs ${libelleComparaison(periode)}` : ''}
                  </div>
                  <div className="space-y-1.5">
                    {repar.lignes.map((l) => {
                      const ref = reparRef ? reparRef.lignes.find((x) => x.cle === l.cle) : null;
                      const cleSerie = `critere:${cleSerieSuivi(nomAxeVal, l.cle)}`;
                      const cleReg = cleObjectifSuivi(personne, cleSerie);
                      const reglage = reglageDe(cleSerie);
                      const favorable = favorablePour(cleSerie);
                      const ouvert = reglageOuvert === cleReg;
                      const ligneObjectif = (lignes || []).find((x) => x.cleSuivi === cleReg);
                      return (
                        <div key={String(l.cle)}>
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs rounded-lg px-2.5 py-1.5" style={{ backgroundColor: PAPER }}>
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.meta.color }} />
                              <span className="truncate">
                                {l.meta === CRITERE_INCONNU_SUIVI ? `${l.meta.l} (${l.cle})` : l.meta.l}
                              </span>
                              {ligneObjectif && (
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded shrink-0"
                                  style={{ backgroundColor: ETATS[ligneObjectif.etat].color, color: texteLisibleSur(ETATS[ligneObjectif.etat].color), fontFamily: F_DISPLAY }}
                                  title="Compte comme un objectif">
                                  {ETATS[ligneObjectif.etat].court}
                                </span>
                              )}
                            </span>
                            {/* Durée et occurrences côte à côte : un critère peut
                                peser peu de temps en revenant souvent. Chacun avec
                                sa part et son écart, pour lire la même période sous
                                les deux angles. */}
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0" style={{ fontFamily: F_MONO }}>
                              <span className="flex items-center gap-1.5">
                                <span>{minutes(l.ms)} min</span>
                                {referencePeriode && <Ecart valeur={minutes(l.ms)} reference={ref ? minutes(ref.ms) : null} unite=" min" hausseFavorable={favorable} />}
                                {l.part != null && <span style={{ color: INK_SOFT }}>{l.part} %</span>}
                                {referencePeriode && l.part != null && <Ecart valeur={l.part} reference={ref ? ref.part : null} unite=" pts" hausseFavorable={favorable} />}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span>{l.n} occ.</span>
                                {referencePeriode && <Ecart valeur={l.n} reference={ref ? ref.n : null} hausseFavorable={favorable} />}
                                {l.partN != null && <span style={{ color: INK_SOFT }}>{l.partN} %</span>}
                                {referencePeriode && l.partN != null && <Ecart valeur={l.partN} reference={ref ? ref.partN : null} unite=" pts" hausseFavorable={favorable} />}
                              </span>
                              {onObjectifSuivi && (
                                <button type="button" onClick={() => setReglageOuvert(ouvert ? null : cleReg)}
                                  className="underline decoration-dotted" style={{ color: INK_SOFT, fontFamily: F_BODY }}>
                                  {reglage && reglage.actif ? 'Objectif' : 'Compte comme un objectif ?'}
                                </button>
                              )}
                            </span>
                          </div>
                          {ouvert && onObjectifSuivi && (
                            <ReglageObjectifSuivi reglage={reglage} uniteChoix={UNITES_CHOIX_CRITERE}
                              onChange={(v) => onObjectifSuivi(cleReg, v)} />
                          )}
                        </div>
                      );
                    })}
                    {repar.nonBornes > 0 && (
                      <div className="text-xs" style={{ color: INK_SOFT }}>
                        {repar.nonBornes} relevé{repar.nonBornes !== 1 ? 's' : ''} sans durée connue, exclu{repar.nonBornes !== 1 ? 's' : ''} de ces chiffres.
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}

            {/* Compteurs d'occurrence : pas de frise, un appui n'a pas de
                largeur. Trois chiffres qui se lisent seuls — le total de la
                période, celui de la journée affichée pour rester en phase avec
                les frises ci-dessus, et le nombre de journées d'usage, sans
                lequel une hausse du total ne se distingue pas d'un simple
                surcroît de jours cotés. */}
            {Array.from(parCompteur.values()).map((c) => {
              const total = c.releves.length;
              const ref = parCompteurRef.get(c.compteurId);
              const duJour = c.releves.filter((r) => jourLocal(r.timestamp) === jourAffiche).length;
              const journees = new Set(c.releves.map((r) => jourLocal(r.timestamp))).size;
              const cleSerie = `compteur:${c.compteurId}`;
              const cleReg = cleObjectifSuivi(personne, cleSerie);
              const reglage = reglageDe(cleSerie);
              const favorable = favorablePour(cleSerie);
              const ouvert = reglageOuvert === cleReg;
              const ligneObjectif = (lignes || []).find((x) => x.cleSuivi === cleReg);
              return (
                <Card key={`compteur-${c.compteurId}`}>
                  <div className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ fontFamily: F_DISPLAY }}>
                    {c.nom} <span className="font-normal text-xs" style={{ color: INK_SOFT }}>· compteur d'occurrence</span>
                    {ligneObjectif && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: ETATS[ligneObjectif.etat].color, color: texteLisibleSur(ETATS[ligneObjectif.etat].color) }}
                        title="Compte comme un objectif">
                        {ETATS[ligneObjectif.etat].court}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" style={{ fontFamily: F_MONO }}>
                    <span className="flex items-center gap-1.5">
                      <span>{total} occ. sur la période</span>
                      {referencePeriode && <Ecart valeur={total} reference={ref ? ref.releves.length : 0} hausseFavorable={favorable} />}
                    </span>
                    <span style={{ color: INK_SOFT }}>
                      {duJour} le {libelleJour(jourAffiche, true)}
                    </span>
                    <span style={{ color: INK_SOFT }}>
                      {journees} journée{journees !== 1 ? 's' : ''} d'usage
                    </span>
                    {onObjectifSuivi && (
                      <button type="button" onClick={() => setReglageOuvert(ouvert ? null : cleReg)}
                        className="underline decoration-dotted" style={{ color: INK_SOFT, fontFamily: F_BODY }}>
                        {reglage && reglage.actif ? 'Objectif' : 'Compte comme un objectif ?'}
                      </button>
                    )}
                  </div>
                  {ouvert && onObjectifSuivi && (
                    <ReglageObjectifSuivi reglage={reglage} uniteChoix={null}
                      onChange={(v) => onObjectifSuivi(cleReg, v)} />
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {mode === 'graphique' && (
        <div className="space-y-4">
          {optionsCriteres.length > 0 && (
            <Card>
              <div className="text-sm font-semibold mb-2" style={{ fontFamily: F_DISPLAY }}>Suivi continu</div>
              <div className="mb-3">
                <SelecteurSeries options={optionsCriteres} selection={selectionSuiviEff} onToggle={onToggleSuivi} nomOption={nomSerie} />
              </div>

              {seriesSuivi.length === 0 ? (
                <Empty>Choisissez au moins un critère.</Empty>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Mesure</span>
                      <Chip label="Durée" on={mesureSuivi === 'duree'} onClick={() => setMesureSuivi('duree')} />
                      <Chip label="Occurrences" on={mesureSuivi === 'occurrences'} onClick={() => setMesureSuivi('occurrences')} />
                    </div>
                    <BasculeUnite unite={uniteSuivi} setUnite={setUniteSuivi} />
                    <div className="flex items-center gap-1.5">
                      <Chip label="Courbes" on={styleSuivi === 'lignes'} onClick={() => setStyleSuivi('lignes')} />
                      <Chip label="Barres" on={styleSuivi === 'barres'} onClick={() => setStyleSuivi('barres')} />
                    </div>
                    <Chip label="Tendances" on={tendancesSuivi} onClick={() => setTendancesSuivi((v) => !v)} />
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Btn variant="ghost" className="text-xs py-1" onClick={() => setAgrandiSuivi(true)}>Agrandir</Btn>
                      <Btn variant="ghost" className="text-xs py-1"
                        onClick={() => exporterGraphePng(refGrapheSuivi.current, nomFichier('suivi-continu'))}>
                        <Download size={13} /> PNG
                      </Btn>
                    </div>
                  </div>

                  <div style={{ height: 280 }} ref={refGrapheSuivi}>{grapheSuiviEl}</div>

                  <div className="text-xs mt-2 space-y-1" style={{ color: INK_SOFT }}>
                    {texteSuivi && <div>{texteSuivi}</div>}
                    <div>
                      {uniteSuivi === 'pct'
                        ? `Chaque part est calculée sur ${mesureSuivi === 'occurrences' ? 'le nombre de relevés bornés' : 'le temps borné'} de l'axe du critère, dans sa tranche.`
                        : `Chaque point cumule ${mesureSuivi === 'occurrences' ? 'les relevés bornés' : 'les minutes'} du critère sur la tranche.`}
                      {' '}Une tranche sans durée connue n'apparaît pas, et un critère laisse un trou plutôt qu'un zéro quand son axe n'a rien de coté.
                    </div>
                  </div>
                </>
              )}

              {agrandiSuivi && (
                <GrapheAgrandi titre={`${nomAffiche(donnees, personne)} · Suivi continu`} sousTitre={libellePeriode(periode)}
                  styleOptions={[{ k: 'lignes', label: 'Courbes' }, { k: 'barres', label: 'Barres' }]}
                  style={styleSuivi} onStyle={setStyleSuivi} courbes={null} onBasculerCourbe={null}
                  onExporterPng={() => exporterGraphePng(refGrapheSuiviAgrandi.current, nomFichier('suivi-continu'))}
                  onFermer={() => setAgrandiSuivi(false)}>
                  <div ref={refGrapheSuiviAgrandi} style={{ height: '70vh' }}>{grapheSuiviEl}</div>
                </GrapheAgrandi>
              )}
            </Card>
          )}

          {optionsCompteurs.length > 0 && (
            <Card>
              <div className="text-sm font-semibold mb-2" style={{ fontFamily: F_DISPLAY }}>Compteurs d'occurrence</div>
              <div className="mb-3">
                <SelecteurSeries options={optionsCompteurs} selection={selectionCompteursEff} onToggle={onToggleCompteurs} nomOption={(o) => o.nom} />
              </div>

              {seriesCompteurs.length === 0 ? (
                <Empty>Choisissez au moins un compteur.</Empty>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Chip label="Courbes" on={styleCompteurs === 'lignes'} onClick={() => setStyleCompteurs('lignes')} />
                      <Chip label="Barres" on={styleCompteurs === 'barres'} onClick={() => setStyleCompteurs('barres')} />
                    </div>
                    <Chip label="Tendances" on={tendancesCompteurs} onClick={() => setTendancesCompteurs((v) => !v)} />
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Btn variant="ghost" className="text-xs py-1" onClick={() => setAgrandiCompteurs(true)}>Agrandir</Btn>
                      <Btn variant="ghost" className="text-xs py-1"
                        onClick={() => exporterGraphePng(refGrapheCompteurs.current, nomFichier('compteurs'))}>
                        <Download size={13} /> PNG
                      </Btn>
                    </div>
                  </div>

                  <div style={{ height: 280 }} ref={refGrapheCompteurs}>{grapheCompteursEl}</div>

                  <div className="text-xs mt-2 space-y-1" style={{ color: INK_SOFT }}>
                    {texteCompteurs && <div>{texteCompteurs}</div>}
                    <div>Chaque point compte les appuis du compteur sur la tranche ; n'avoir pas appuyé vaut bien zéro.</div>
                  </div>
                </>
              )}

              {agrandiCompteurs && (
                <GrapheAgrandi titre={`${nomAffiche(donnees, personne)} · Compteurs d'occurrence`} sousTitre={libellePeriode(periode)}
                  styleOptions={[{ k: 'lignes', label: 'Courbes' }, { k: 'barres', label: 'Barres' }]}
                  style={styleCompteurs} onStyle={setStyleCompteurs} courbes={null} onBasculerCourbe={null}
                  onExporterPng={() => exporterGraphePng(refGrapheCompteursAgrandi.current, nomFichier('compteurs'))}
                  onFermer={() => setAgrandiCompteurs(false)}>
                  <div ref={refGrapheCompteursAgrandi} style={{ height: '70vh' }}>{grapheCompteursEl}</div>
                </GrapheAgrandi>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function PersonnesScreen({ donnees, lignes, focus, setFocus, contexte, setContexte, bandeau, periode, setPeriode, graphe, setGraphe, vue, setVue, onRapport, onRapportCrises, onOuvrirCrises, onObjectifSuivi }) {
  const style = graphe.style;
  const courbes = graphe.courbes;
  const setStyle = (k) => setGraphe((g) => ({ ...g, style: k }));
  const basculerCourbe = (k) => setGraphe((g) => ({
    ...g,
    courbes: g.courbes.includes(k) ? g.courbes.filter((x) => x !== k) : [...g.courbes, k],
  }));
  /* Résumé affiché dans la bande collante repliée du sélecteur de période,
     pour dire quel réglage de graphique est en vigueur sans avoir à
     déplier — même intention que `resumeReglages` côté CrisesScreen. */
  const resumeGraphePersonnes = `${(STYLES_GRAPHIQUE.find((g) => g.k === style) || {}).label || ''}`
    + (courbes.length ? ` · ${courbes.length} lecture${courbes.length > 1 ? 's' : ''} superposée${courbes.length > 1 ? 's' : ''}` : '');
  /* Objectifs dont la courbe est dépliée, et celui qu'on a agrandi. Repérés
     par leur nom : les identifiants d'objectif changent d'une tablette à
     l'autre, le nom est ce qui reste stable côté consolidation. Vue Objectifs
     et Bilan fusionnées : on arrive replié (une ligne de bilan par objectif),
     déplier fait apparaître le graphique — c'est l'inverse de l'ancien
     `masques` (ce qui était replié), gardé nommé dans son sens positif
     maintenant que c'est le cas par défaut. */
  const [deplies, setDeplies] = useState([]);
  /* Sélection pour le PDF, indépendante du dépli à l'écran : cocher décide de
     ce qui part dans le document, déplier ne concerne que la lecture. Stocke
     ce qui est EXCLU (comme `masques` avant elle) : par défaut, rien n'est
     exclu, tout part au document — même défaut que l'ancien bouton PDF
     unique, qui exportait tout ce qui restait affiché. */
  const [nonRetenusPdf, setNonRetenusPdf] = useState([]);
  const [agrandi, setAgrandi] = useState(null);
  /* La classe filtrée vient du contexte partagé : elle était locale, donc
     repassée à « Toutes » au premier aller-retour vers un autre écran. */
  const classeFiltre = contexte.classe;
  /* Après un clic sur le bouton PDF, il faut attendre que les objectifs
     cochés (potentiellement repliés à l'écran) aient fini de se déplier et de
     peindre leur graphique avant d'imprimer — sinon la zone ciblée capture
     des cartes encore vides. Un effet plutôt qu'un appel direct : il ne se
     déclenche qu'après le rendu qui suit le dépli. */
  const [impressionEnAttente, setImpressionEnAttente] = useState(false);
  const refObjectifs = useRef(null);
  /* Objectif vers lequel défiler après un clic depuis le Tableau de bord —
     posé par les deux effets qui déplient l'objectif ciblé, consommé par
     l'effet de défilement plus bas une fois ce dépli passé par un rendu.
     Même mécanique en deux temps que `impressionEnAttente` juste au-dessus,
     pour la même raison : au moment où ces effets s'exécutent, le DOM
     affiche encore l'état d'avant, la carte visée n'existe pas encore. */
  const [scrollCible, setScrollCible] = useState(null);
  /* Export du détail des cotations (JSON format Manager) de la personne et
     de la période affichées. `exportDetail` porte le paquet déjà construit
     et son nom de fichier, en attente d'une clé de chiffrement — même
     mécanique à deux temps que l'export de GestionScreen (chiffré ou en
     clair après confirmation explicite), gardée ici plutôt que dupliquée :
     seuls `construirePaquetExport` et `encryptJSON`, déjà partagés, font le
     travail ; ce qui est propre à cet écran tient dans ces deux états. */
  const [exportDetail, setExportDetail] = useState(null);
  const [cleExportDetail, setCleExportDetail] = useState('');

  /* Calculées avant le retour anticipé plus bas : les effets qui suivent
     doivent être appelés à chaque rendu, sans quoi l'ordre des hooks change
     selon qu'une personne existe ou non. */
  /* La personne vient du contexte partagé — la même que sur Crises, Séances et
     Explorer. Le repli sur la première de la liste reste : cet écran ne sait
     rien afficher sans sujet, contrairement aux autres, où « toutes les
     personnes » est un état légitime. */
  const personne = contexte.personne
    || (donnees.personnes.length ? donnees.personnes[0].initials : null);
  const objectifOuvert = focus && focus.objectif;

  /* Le repli est écrit dans le contexte, sinon le bandeau annoncerait
     « toutes les personnes » au-dessus d'une fiche qui en montre une seule —
     et quitter cet écran pour Crises repartirait sur « toutes » sans que rien
     ne l'ait demandé. */
  useEffect(() => {
    if (!contexte.personne && personne) setContexte({ ...contexte, personne });
  }, [contexte.personne, personne]);

  /* Changer de personne remet la vue à plat : un objectif déplié chez l'une
     n'a pas de raison de l'être chez l'autre, même s'il porte le même nom.
     Si on arrive avec un objectif précis en cible (clic depuis le Tableau de
     bord), il part déplié plutôt que noyé dans le bilan. */
  useEffect(() => {
    setDeplies(objectifOuvert ? [objectifOuvert] : []);
    setAgrandi(null);
    setNonRetenusPdf([]);
    /* L'état du suivi continu (journée affichée, critères comparés) n'est pas
       remis à zéro ici : SuiviContinuVue est monté avec `key={personne}` et
       repart neuf de lui-même. */
    /* Amener directement sur l'objectif visé, sans exiger un défilement
       manuel : la sous-vue passe à « Bilan des objectifs » (seule à
       afficher les cartes) et le défilement est demandé pour le rendu qui
       suivra le dépli ci-dessus. */
    if (objectifOuvert) { setVue('objectifs'); setScrollCible(objectifOuvert); }
  }, [personne]);

  /* Navigation vers un objectif précis sans changement de personne (rare,
     mais possible) : le déplier en plus de ce qui l'est déjà, sans toucher au
     reste — contrairement à l'effet ci-dessus, qui repart de zéro. */
  useEffect(() => {
    if (!objectifOuvert) return;
    setDeplies((cur) => (cur.includes(objectifOuvert) ? cur : [...cur, objectifOuvert]));
    setVue('objectifs');
    setScrollCible(objectifOuvert);
  }, [objectifOuvert]);

  /* Défilement direct vers la carte visée : consomme `scrollCible` posé par
     les deux effets ci-dessus, une fois que `deplies` (donc le DOM de la
     carte) a eu un rendu qui suit son dépli — `refObjectifs` peut encore
     valoir `null` juste après un changement de sous-vue, d'où la garde. Les
     objectifs ne sont identifiés que par leur nom (voir plus haut) : mêmes
     `data-objectif` posés sur chaque `<CarteObjectif>`. */
  useEffect(() => {
    if (!scrollCible || !refObjectifs.current) return;
    const cible = Array.from(refObjectifs.current.querySelectorAll('[data-objectif]'))
      .find((el) => el.dataset.objectif === scrollCible);
    if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollCible(null);
  }, [scrollCible, deplies]);

  /* Le clic sur PDF déplie d'abord les objectifs cochés (setDeplies), puis
     demande l'impression via ce drapeau : l'effet ne se déclenche qu'après
     le rendu qui suit ce dépli, quand les courbes fraîchement ouvertes ont
     eu leur premier passage de rendu — window.print() a besoin d'un DOM déjà
     peint, pas d'un futur commit. */
  useEffect(() => {
    if (!impressionEnAttente) return;
    setImpressionEnAttente(false);
    imprimerZone(refObjectifs.current);
  }, [impressionEnAttente, deplies]);

  if (!donnees.personnes.length) return <Empty>Importez une sauvegarde pour commencer.</Empty>;

  /* Export du détail des cotations, au niveau de l'essai/étape/intervalle —
     personne et période affichées, en format Manager (réimportable par un
     autre poste) ou CSV (tableur). PRODUCT.md : aucune donnée sensible ne
     quitte le poste sans export explicite et chiffré — le JSON suit donc le
     même garde-fou que l'export complet de GestionScreen (chiffré, ou en
     clair après confirmation explicite) ; le CSV, destiné à un tableur
     local, suit le patron déjà en vigueur pour les autres exports CSV de
     l'application (jamais chiffré, comme eux). */
  const nomFichierDetail = (ext) => `${nomSain(nomAffiche(donnees, personne))}-${nomSain(libellePeriode(periode))}.${ext}`;
  function exporterDetailJson(chiffre) {
    const paquet = construirePaquetExport(donnees, [personne], periode);
    const nom = `manager-${nomFichierDetail('json')}`;
    if (!chiffre) {
      telechargerFichier(new Blob([JSON.stringify(paquet, null, 2)], { type: 'application/json' }), nom);
      return;
    }
    setExportDetail({ paquet, nom });
  }
  async function confirmerExportDetailChiffre() {
    if (cleExportDetail.length < 4) return;
    const env = await encryptJSON(exportDetail.paquet, cleExportDetail);
    telechargerFichier(new Blob([JSON.stringify(env)], { type: 'application/json' }), exportDetail.nom);
    setExportDetail(null);
    setCleExportDetail('');
  }
  function exporterDetailCsv() {
    const detail = detailCotationsPersonne(donnees, personne, periode);
    /* Les deux dernières colonnes sont les mesures d'appoint de la cotation —
       mêmes cellules que l'export CSV de DatABA, vides tant que rien n'a été
       validé. Elles valent pour la cotation entière et non pour l'essai : les
       lignes d'une même cotation les répètent. */
    const enTete = ['Date', 'Séance', 'Atelier', 'Intervenant', 'Objectif', 'Code', 'Type', 'Unité', 'Repère', 'Valeur',
      "Compteur d'appoint", "Chrono d'appoint (s)"];
    const rangees = detail.map((l) => [
      new Date(l.date).toLocaleDateString('fr-FR'), l.seanceId, l.atelier, l.intervenant,
      l.objectif, l.code, l.type, l.unite, l.repere, l.valeur,
      l.compteurAppoint, l.chronoAppoint,
    ]);
    telechargerCsv(enTete, rangees, `detail-${nomFichierDetail('csv')}`);
  }

  const siennes = lignes
    .filter((l) => l.initials === personne)
    .map((l) => filtrerLignePeriode(l, periode));

  /* Même construction que `siennes`, sur la période de comparaison réglée
     dans le sélecteur — sert au radar, pour opposer deux moments plutôt que
     de montrer une seule photo. */
  const referencePeriode = periodeComparee(periode);
  const siennesRef = referencePeriode
    ? lignes.filter((l) => l.initials === personne).map((l) => filtrerLignePeriode(l, referencePeriode))
    : [];

  const crisesPersonne = (donnees.crises || []).filter((c) => {
    if (!c.studentId) return false;
    const ini = ((donnees._idVersInitiales || {})[c.source] || {})[c.studentId];
    return ini === personne && dansPeriode(c.date, periode);
  });

  const gran = periode.granularite || 'semaine';
  const paquets = new Map();
  const touche = (k) => {
    if (!paquets.has(k)) paquets.set(k, { somme: 0, n: 0, crises: 0 });
    return paquets.get(k);
  };
  siennes.forEach((l) => l.points.forEach((pt) => { const e = touche(cleAgregation(pt.date, gran)); e.somme += pt.value; e.n += 1; }));
  crisesPersonne.forEach((c) => { touche(cleAgregation(c.date, gran)).crises += 1; });
  const croisement = Array.from(paquets.entries()).sort((a, b) => a[0] - b[0]).map(([k, e]) => ({
    label: etiquetteAgregation(k, gran),
    autonomie: e.n ? Math.round(e.somme / e.n) : null,
    crises: e.crises,
  }));

  const compte = (e) => siennes.filter((l) => l.etat === e).length;
  const compteRef = (e) => siennesRef.filter((l) => l.etat === e).length;

  /* Filtre par classe : la liste de personnes se resserre, mais un choix qui
     viderait la liste (classe supprimée entre-temps, par exemple) est ignoré
     plutôt que de laisser l'écran vide sans explication. */
  const personnesFiltrees = classeFiltre
    ? donnees.personnes.filter((p) => p.classeId === classeFiltre)
    : donnees.personnes;
  const listePersonnes = personnesFiltrees.length ? personnesFiltrees : donnees.personnes;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
      {/* Colonne de gauche : liste des personnes, verticale — le travail est
         comparatif (choisir qui regarder), la fiche de droite fait le reste.
         Reste en flux normal sous lg : un poste étroit garde la liste au-dessus. */}
      <div className="lg:w-64 shrink-0 no-print">
        {/* Le filtre par classe a rejoint le bandeau de contexte, en haut : il
            vaut maintenant pour tous les écrans à la fois, et le garder ici en
            double aurait donné deux contrôles pour un même réglage. */}
        <div className="flex lg:flex-col flex-wrap gap-2">
          {listePersonnes.map((p) => (
            <button key={p.initials} onClick={() => { setContexte({ ...contexte, personne: p.initials }); setFocus(null); }}
              className="rounded-xl px-4 py-2.5 border font-semibold text-sm lg:text-left"
              style={{ fontFamily: F_DISPLAY, borderColor: personne === p.initials ? ACCENT : BORDER,
                backgroundColor: personne === p.initials ? ACCENT_WASH : 'transparent', color: personne === p.initials ? ACCENT : INK_SOFT }}>
              {nomAffiche(donnees, p.initials)}
              {nomClasseDe(donnees, p.initials) && (
                <span className="ml-1.5 font-normal" style={{ color: personne === p.initials ? ACCENT : INK_SOFT, opacity: 0.75 }}>
                  · {nomClasseDe(donnees, p.initials)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Colonne de droite : la fiche de la personne sélectionnée. */}
      <div className="flex-1 min-w-0">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[
          { k: 'objectifs', l: 'Bilan des objectifs', icone: TrendingUp },
          { k: 'radar', l: 'Radar', icone: RadarIcon },
          { k: 'crises', l: 'Crises', icone: AlertTriangle },
          { k: 'suivi', l: 'Suivi continu', icone: Layers },
          { k: 'croisement', l: 'Croisement', icone: Activity },
        ].map((v) => {
          const Icone = v.icone;
          return (
            <button key={v.k} onClick={() => setVue(v.k)}
              className="rounded-lg px-3 py-1.5 text-xs border flex items-center gap-1.5"
              style={{ borderColor: vue === v.k ? ACCENT : BORDER, backgroundColor: vue === v.k ? ACCENT : 'transparent', color: vue === v.k ? ACCENT_INK : INK_SOFT }}>
              <Icone size={13} /> {v.l}
            </button>
          );
        })}
      </div>

      {/* Type de graphique et courbes de tendance ne concernent que le bilan
         des objectifs : passés à `extra` seulement dans cette sous-vue,
         plutôt que rendus (et donc collants) sous les quatre autres, où ils
         ne s'appliquent pas. */}
      <SelecteurPeriode periode={periode} setPeriode={setPeriode} avecGranularite={vue === 'croisement' || vue === 'suivi'}
        avecComparaison collant bandeau={bandeau}
        comparaisonUtile={vue === 'objectifs' || vue === 'suivi' || vue === 'radar'}
        resumeExtra={vue === 'objectifs' ? resumeGraphePersonnes : null}
        extra={vue === 'objectifs' && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Type de graphique</span>
              {STYLES_GRAPHIQUE.map((g) => <Chip key={g.k} label={g.label} on={style === g.k} onClick={() => setStyle(g.k)} />)}
            </div>
            {/* Lectures superposables, cumulables : chacune bascule seule. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Superposer</span>
              {COURBES_LECTURE.map((c) => (
                <Chip key={c.k} label={c.label} on={courbes.includes(c.k)} onClick={() => basculerCourbe(c.k)} />
              ))}
            </div>
            {courbes.length > 0 && (
              <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
                Ces lectures demandent au moins trois points cotés.
              </p>
            )}
          </div>
        )} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Btn onClick={() => onRapport(personne, siennes.map((l) => l.objectif))} className="text-sm">
          Générer un rapport
        </Btn>
        <Btn variant="outline" onClick={() => onRapportCrises(personne)} className="text-sm">
          <AlertTriangle size={14} /> Rapport de crise
        </Btn>
        <Btn variant="outline" onClick={() => exporterDetailJson(true)} className="text-sm">
          <Download size={14} /> Détail des cotations (Manager)
        </Btn>
        <Btn variant="ghost" onClick={() => {
          if (window.confirm("Exporter sans chiffrement ?\n\nLe fichier sera lisible par quiconque y a accès.")) exporterDetailJson(false);
        }} className="text-sm">
          Sans chiffrement
        </Btn>
        <Btn variant="outline" onClick={exporterDetailCsv} className="text-sm">
          <Download size={14} /> Détail des cotations (CSV)
        </Btn>
        <span className="text-xs" style={{ color: INK_SOFT }}>Reprend cette personne et cette période.</span>
      </div>

      {exportDetail && (
        /* Même mécanique que l'export chiffré de GestionScreen, propre à
           cet écran (voir la déclaration d'état plus haut) : le paquet est
           déjà construit, il ne manque que la clé. */
        <div className="mb-4 rounded-xl border p-3 max-w-md no-print" style={{ borderColor: BORDER, backgroundColor: PAPER }}>
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Mot de passe protégeant ce fichier</div>
          <input type="password" value={cleExportDetail} autoFocus onChange={(e) => setCleExportDetail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmerExportDetailChiffre(); }}
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent mb-2" style={{ borderColor: BORDER, color: INK }} />
          <div className="flex gap-2">
            <Btn onClick={confirmerExportDetailChiffre} disabled={cleExportDetail.length < 4} className="flex-1 text-sm">
              Chiffrer et télécharger
            </Btn>
            <Btn variant="ghost" onClick={() => { setExportDetail(null); setCleExportDetail(''); }} className="text-sm">Annuler</Btn>
          </div>
        </div>
      )}

      {vue === 'objectifs' && (() => {
        const retenusPdf = siennes.filter((l) => !nonRetenusPdf.includes(l.objectif));
        const basculerDeplie = (nom) => setDeplies((cur) => (cur.includes(nom) ? cur.filter((x) => x !== nom) : [...cur, nom]));
        const basculerPdf = (nom) => setNonRetenusPdf((cur) => (cur.includes(nom) ? cur.filter((x) => x !== nom) : [...cur, nom]));
        /* Le PDF doit inclure la courbe de chaque objectif coché, même
           replié à l'écran : la sélection est indépendante du dépli. On
           déplie donc d'abord les objectifs retenus qui ne le sont pas déjà,
           puis on imprime — dans un effet, une fois que le rendu qui suit le
           dépli a eu lieu (voir imprimerZone : window.print() a besoin des
           courbes déjà peintes dans le DOM). */
        const lancerPdf = () => {
          setDeplies((cur) => {
            const manquants = retenusPdf.map((l) => l.objectif).filter((nom) => !cur.includes(nom));
            return manquants.length ? [...cur, ...manquants] : cur;
          });
          setImpressionEnAttente(true);
        };
        return (
          <>
            <div className="flex flex-wrap gap-4 mb-4">
              {['acquis', 'bientot', 'plateau', 'en_cours', 'dormant', 'mesure', 'non_acquis'].map((e) => (
                <div key={e} className="min-w-[80px] text-center">
                  <div className="text-xl font-semibold" style={{ fontFamily: F_MONO, color: ETATS[e].color }}>{compte(e)}</div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>{ETATS[e].court}</div>
                  {referencePeriode && (
                    <Ecart valeur={compte(e)} reference={compteRef(e)} hausseFavorable={ETAT_HAUSSE_FAVORABLE[e]} />
                  )}
                </div>
              ))}
            </div>

            {/* Le type de graphique et les courbes de tendance vivent
               désormais dans le panneau collant du sélecteur de période
               ci-dessus (`extra`) — seules les actions propres à cette
               liste restent ici. */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 no-print">
              <Btn variant="outline" className="text-xs py-1.5"
                onClick={lancerPdf} disabled={!retenusPdf.length}>
                <Printer size={13} /> PDF ({retenusPdf.length})
              </Btn>
              {deplies.length > 0 && (
                <Btn variant="ghost" onClick={() => setDeplies([])} className="text-xs py-1.5">
                  Tout replier
                </Btn>
              )}
            </div>

            {siennes.length === 0 ? <Empty>Aucun objectif pour cette personne.</Empty> : (
              /* Zone exportée : seuls les objectifs cochés (case à gauche de
                 chaque carte) en sortent, dans le style choisi — voir
                 lancerPdf ci-dessus pour la mécanique du dépli avant
                 impression. */
              <div ref={refObjectifs}>
                <div className="print-only" style={{ marginBottom: '0.75rem' }}>
                  <div className="text-lg font-semibold" style={{ fontFamily: F_DISPLAY }}>
                    {nomAffiche(donnees, personne)} — {libellePeriode(periode)}
                  </div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>
                    {retenusPdf.length} objectif{retenusPdf.length !== 1 ? 's' : ''} sur {siennes.length}
                  </div>
                </div>

                <div className="space-y-3">
                  {siennes.map((l) => (
                    <CarteObjectif key={l.objectif} ligne={l} donnees={donnees} personne={personne}
                      style={style} courbes={courbes} onStyle={setStyle} onBasculerCourbe={basculerCourbe}
                      deplie={deplies.includes(l.objectif)}
                      pourPdf={!nonRetenusPdf.includes(l.objectif)}
                      agrandi={agrandi === l.objectif}
                      surligne={objectifOuvert === l.objectif}
                      onBasculerDeplie={() => basculerDeplie(l.objectif)}
                      onBasculerPdf={() => basculerPdf(l.objectif)}
                      onAgrandir={() => setAgrandi(agrandi === l.objectif ? null : l.objectif)} />
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {vue === 'radar' && (
        <Card>
          <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
            Dernier résultat de chaque objectif travaillé sur la période — la forme montre d'un coup
            d'œil ce qui est solide et ce qui reste à consolider.
            {referencePeriode && ' Le contour en pointillés reprend la période de comparaison réglée ci-dessus.'}
          </div>
          <RadarObjectifs lignes={siennes} lignesRef={referencePeriode ? siennesRef : null} libelleRef={libelleComparaison(periode)} />
        </Card>
      )}

      {vue === 'crises' && (
        <>
          {/* Ne s'affiche que dans cette sous-vue : elle précédait auparavant
              Objectifs, Radar, Suivi et Croisement sans y avoir de sens. */}
          <ApercuCrises donnees={donnees} personne={personne} crises={crisesPersonne}
            periode={periode} granularite={gran} onOuvrir={() => onOuvrirCrises(personne)} />
          {crisesPersonne.length === 0 ? <Empty>Aucune crise consignée sur la période.</Empty> : (
          <Card>
            <div className="text-sm mb-3">
              <span style={{ fontFamily: F_MONO, fontSize: '1.25rem' }}>{crisesPersonne.length}</span> crise{crisesPersonne.length !== 1 ? 's' : ''} sur la période
            </div>
            <div className="space-y-1.5">
              {crisesPersonne.slice(0, 20).map((c, i) => (
                <div key={i} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: PAPER }}>
                  <div className="text-xs flex items-center gap-2" style={{ color: INK_SOFT }}>
                    <span>{new Date(c.date).toLocaleDateString('fr-FR')} · {Math.round((c.durationMs || 0) / 60000)} min</span>
                    {c.intensite && (
                      <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: INTENSITES[c.intensite].color, color: texteLisibleSur(INTENSITES[c.intensite].color) }}>
                        {c.intensite} · {INTENSITES[c.intensite].label}
                      </span>
                    )}
                  </div>
                  <div className="text-sm">{(c.comportementTags || []).join(' → ') || c.comportement || '—'}</div>
                  {(c.antecedentTags || []).length > 0 && (
                    <div className="text-xs" style={{ color: INK_SOFT }}>Antécédent : {(c.antecedentTags || []).join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
          )}
        </>
      )}

      {vue === 'suivi' && (
        <SuiviContinuVue key={personne} donnees={donnees} personne={personne} periode={periode}
          lignes={lignes} onObjectifSuivi={onObjectifSuivi} />
      )}

      {vue === 'croisement' && (
        croisement.length < 2 ? <Empty>Il faut au moins deux semaines de données pour un croisement lisible.</Empty> : (
          <Card>
            <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
              Par {gran === 'jour' ? 'jour' : gran === 'mois' ? 'mois' : 'semaine'} : autonomie moyenne (courbe) et nombre de crises (barres)
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={croisement} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
                  <CartesianGrid stroke={BORDER} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis yAxisId="g" domain={[0, 100]} tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={40} />
                  <YAxis yAxisId="d" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: INK, fontFamily: F_BODY, fontSize: 12 }} labelFormatter={(l) => l} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="d" dataKey="crises" name="Crises" fill={CRISE} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line yAxisId="g" type="monotone" dataKey="autonomie" name="Autonomie (%)" stroke={ACQUIS} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )
      )}
      </div>
    </div>
  );
}

/* `hausseFavorable` sert à colorer l'écart entre deux périodes (voir Ecart,
   lot socle) : true quand une hausse est le signe attendu d'un progrès, false
   quand c'est l'inverse (crises, intensité). Sans jugement sur les mesures
   neutres, laissées à true par convention plutôt que sans couleur du tout. */
const MESURES = [
  { k: 'cotations', label: 'Nombre de cotations', source: 'cotations', agg: 'compte', hausseFavorable: true },
  { k: 'autonomie', label: "Taux d'autonomie moyen", source: 'cotations', agg: 'moyenne', champ: 'score', suffixe: ' %', hausseFavorable: true },
  { k: 'seances', label: 'Nombre de séances', source: 'cotations', agg: 'distinct', champ: 'seanceId', hausseFavorable: true },
  /* Compteur et chronomètre d'appoint, saisis en séance à côté de la cotation.
     « D'appoint » est dans le libellé et pas seulement dans le commentaire :
     ce que compte le widget est décidé objectif par objectif, si bien qu'une
     somme prise sur une dimension qui mélange les objectifs additionne des
     grandeurs sans rapport. Croisées par Objectif, ou par Personne × Objectif,
     les deux mesures rendent un chiffre homogène. */
  { k: 'compteurAppoint', label: "Compteur d'appoint (somme)", source: 'cotations', agg: 'somme', champ: 'compteurAppoint', hausseFavorable: true },
  { k: 'chronoAppoint', label: "Chronomètre d'appoint (durée cumulée)", source: 'cotations', agg: 'somme', champ: 'chronoAppointMin', suffixe: ' min', hausseFavorable: true },
  { k: 'crises', label: 'Nombre de crises et observations', source: 'crises', agg: 'compte', hausseFavorable: false },
  { k: 'dureeCrises', label: 'Durée totale des crises', source: 'crises', agg: 'somme', champ: 'minutes', suffixe: ' min', hausseFavorable: false },
  { k: 'dureeMoyenneCrise', label: 'Durée moyenne des crises', source: 'crises', agg: 'moyenne', champ: 'minutes', suffixe: ' min', hausseFavorable: false },
  { k: 'intensiteMoyenne', label: 'Intensité moyenne des crises', source: 'crises', agg: 'moyenne', champ: 'intensiteNum', hausseFavorable: false },
  { k: 'suiviDuree', label: 'Suivi continu : durée cumulée par critère', source: 'suivi', agg: 'somme', champ: 'minutes', suffixe: ' min', hausseFavorable: true },
  /* « part » : proportion du total général de la mesure (même case, même
     ligne, même colonne partagent le même dénominateur) — même convention que
     la bascule Nombre/Pourcentage du tableau de bord et des crises, pas une
     part relative à la ligne ou à la colonne. */
  { k: 'suiviPart', label: 'Suivi continu : part du temps borné', source: 'suivi', agg: 'part', champ: 'minutes', suffixe: ' %', hausseFavorable: true },
  /* Les compteurs d'occurrence ont leur propre table de faits : un appui est
     ponctuel, il se compte et ne se cumule pas en durée. */
  { k: 'compteurOccurrences', label: 'Suivi continu : occurrences comptées', source: 'compteurs', agg: 'compte', hausseFavorable: true },
  { k: 'objAcquis', label: "Objectifs acquis (nombre)", source: 'objectifs', agg: 'somme', champ: 'acquis', hausseFavorable: true },
  { k: 'objPartAcquis', label: 'Objectifs acquis (part du total)', source: 'objectifs', agg: 'part', champ: 'acquis', suffixe: ' %', hausseFavorable: true },
  { k: 'autonomieEvolution', label: "Évolution de l'autonomie (première à dernière cotation)", source: 'objectifs', agg: 'moyenne', champ: 'evolution', suffixe: ' pts', hausseFavorable: true },
];

/* `sources`, absent = applicable à toutes les mesures. Présent = liste des
   tables de faits où le champ existe réellement — croiser un objectif avec
   les crises n'a jamais eu de sens (aucune crise ne porte d'objectif), mais
   rien ne l'empêchait avant : la colonne sortait vide sans un mot
   d'explication au-delà de la note générale sous les menus. */
const DIMENSIONS = [
  { k: 'aucune', label: 'Aucune', get: () => 'Total' },
  { k: 'personne', label: 'Personne', get: (f) => f.personne },
  { k: 'atelier', label: 'Atelier', get: (f) => f.atelier, sources: ['cotations', 'crises', 'suivi', 'compteurs'] },
  { k: 'intervenant', label: 'Intervenant', get: (f) => f.intervenant || 'Non renseigné', sources: ['cotations', 'crises', 'suivi', 'compteurs'] },
  { k: 'objectif', label: 'Objectif', get: (f) => f.objectif || '—', sources: ['cotations', 'objectifs'] },
  { k: 'type', label: 'Type', get: (f) => f.type || '—', sources: ['cotations', 'crises', 'objectifs'] },
  { k: 'phase', label: 'Phase', get: (f) => f.phase || '—', sources: ['cotations'] },
  { k: 'intensite', label: 'Intensité', get: (f) => f.intensite || '—', sources: ['crises'] },
  { k: 'axe', label: 'Axe de suivi', get: (f) => f.axe || '—', sources: ['suivi'] },
  { k: 'critere', label: 'Critère de suivi', get: (f) => f.critere || '—', sources: ['suivi'] },
  { k: 'compteur', label: "Compteur d'occurrence", get: (f) => f.compteur || '—', sources: ['compteurs'] },
  /* Geste qui a produit le relevé : pastille, clôture de journée, saisie
     manuelle. Ne concerne que les deux tables de relevés — une cotation de
     séance et une crise ne se font pas à la pastille. */
  { k: 'origineReleve', label: 'Geste de relevé', get: (f) => f.origine || 'Non renseignée', sources: ['suivi', 'compteurs'] },
  { k: 'jour', label: 'Jour de la semaine', get: (f) => new Date(f.date).toLocaleDateString('fr-FR', { weekday: 'long' }) },
  { k: 'semaine', label: 'Semaine', get: (f) => etiquetteAgregation(cleAgregation(f.date, 'semaine'), 'semaine') },
  { k: 'mois', label: 'Mois', get: (f) => etiquetteAgregation(cleAgregation(f.date, 'mois'), 'mois') },
];

/* `total`, optionnel, sert uniquement à `agg: 'part'` : la somme du champ sur
   l'ensemble de la base filtrée, calculée une fois par l'appelant plutôt que
   recalculée à chaque cellule. Sans lui, une mesure « part » ne peut rien
   afficher — mieux vaut une case vide qu'un pourcentage sans dénominateur. */
function agreger(faits, mesure, total) {
  if (mesure.agg === 'part') {
    if (!total || !faits.length) return null;
    const valeurs = faits.map((f) => f[mesure.champ]).filter((v) => v != null);
    if (!valeurs.length) return null;
    return Math.round((valeurs.reduce((a, b) => a + b, 0) / total) * 100);
  }
  if (!faits.length) return null;
  if (mesure.agg === 'compte') return faits.length;
  if (mesure.agg === 'distinct') return new Set(faits.map((f) => f[mesure.champ])).size;
  const valeurs = faits.map((f) => f[mesure.champ]).filter((v) => v != null);
  if (!valeurs.length) return null;
  const somme = valeurs.reduce((a, b) => a + b, 0);
  return mesure.agg === 'somme' ? Math.round(somme) : Math.round(somme / valeurs.length);
}

/* Les trois menus du croisement vivent dans ManagerApp (`croisement`) : ils
   étaient locaux, donc reperdus à chaque sortie d'onglet — et Explorer est
   précisément l'écran qui fabrique une question à laquelle on va répondre
   ailleurs. */
function ExplorerScreen({ donnees, lignes, periode, setPeriode, croisement, setCroisement, bandeau, onOuvrirPersonne }) {
  const ligneDim = croisement.ligne;
  const colonneDim = croisement.colonne;
  const mesureK = croisement.mesure;
  const setLigneDim = (v) => setCroisement({ ...croisement, ligne: v });
  const setColonneDim = (v) => setCroisement({ ...croisement, colonne: v });
  const setMesureK = (v) => setCroisement({ ...croisement, mesure: v });

  const faits = useMemo(
    () => construireFaits(donnees, lignes),
    [donnees.seances, donnees.crises, donnees.suivi, donnees.stabilite, donnees.sources,
      donnees._idVersInitiales, donnees._axesSuivi, donnees.personnes, lignes]
  );
  const mesure = MESURES.find((m) => m.k === mesureK);
  /* Les dimensions qui ne s'appliquent pas à la mesure choisie disparaissent
     des menus plutôt que de proposer un croisement qui sortira vide sans
     rien dire. Si le choix en cours devient inapplicable après un changement
     de mesure, il retombe sur « Aucune » — dérivé au rendu, pas par un effet
     qui rejouerait setLigneDim en boucle. */
  const dimensionsApplicables = DIMENSIONS.filter((d) => !d.sources || d.sources.includes(mesure.source));
  const ligneDimEff = dimensionsApplicables.some((d) => d.k === ligneDim) ? ligneDim : 'aucune';
  const colonneDimEff = dimensionsApplicables.some((d) => d.k === colonneDim) ? colonneDim : 'aucune';
  const dimL = DIMENSIONS.find((d) => d.k === ligneDimEff);
  const dimC = DIMENSIONS.find((d) => d.k === colonneDimEff);

  const base = (faits[mesure.source] || []).filter((f) => dansPeriode(f.date, periode));
  /* Période de comparaison réglée dans le sélecteur (lot socle) : sert à
     l'écart affiché sous chaque case, jamais à la construction du tableau
     lui-même — L et C restent ceux de la période affichée. */
  const referencePeriode = periodeComparee(periode);
  const baseRef = referencePeriode ? (faits[mesure.source] || []).filter((f) => dansPeriode(f.date, referencePeriode)) : [];

  /* Construction du croisement */
  const lignesCles = [];
  const colonnesCles = [];
  const cellules = new Map();
  base.forEach((f) => {
    const l = dimL.get(f);
    const c = dimC.get(f);
    if (!lignesCles.includes(l)) lignesCles.push(l);
    if (!colonnesCles.includes(c)) colonnesCles.push(c);
    const cle = `${l}||${c}`;
    if (!cellules.has(cle)) cellules.set(cle, []);
    cellules.get(cle).push(f);
  });
  const cellulesRef = new Map();
  baseRef.forEach((f) => {
    const cle = `${dimL.get(f)}||${dimC.get(f)}`;
    if (!cellulesRef.has(cle)) cellulesRef.set(cle, []);
    cellulesRef.get(cle).push(f);
  });

  /* Les dimensions temporelles se lisent dans l'ordre du calendrier, pas par
     fréquence d'apparition. */
  const trierTemps = (k, liste) => {
    if (k === 'jour') return JOURS_SEMAINE.filter((j) => liste.includes(j));
    if (k === 'semaine' || k === 'mois') {
      const ordre = new Map();
      base.forEach((f) => {
        const e = DIMENSIONS.find((d) => d.k === k).get(f);
        if (!ordre.has(e)) ordre.set(e, cleAgregation(f.date, k === 'mois' ? 'mois' : 'semaine'));
      });
      return liste.slice().sort((a, b) => ordre.get(a) - ordre.get(b));
    }
    return liste.slice().sort((a, b) => String(a).localeCompare(String(b), 'fr'));
  };
  const L = trierTemps(ligneDimEff, lignesCles);
  const C = trierTemps(colonneDimEff, colonnesCles);

  /* Attributs d'ouverture d'un en-tête vers la fiche, quand la dimension est
     « personne » — la valeur de cellule est alors les initiales elles-mêmes
     (`construireFaits` les pose telles quelles). « Non renseignée » est écarté :
     c'est le repli d'une crise sans personne, il n'y a pas de fiche derrière.
     Rend un objet vide dans tous les autres cas, donc rien de cliquable. */
  const ouvrable = (dim, valeur) => {
    if (dim !== 'personne' || !onOuvrirPersonne) return {};
    if (!valeur || valeur === 'Non renseignée') return {};
    if (!(donnees.personnes || []).some((p) => p.initials === valeur)) return {};
    return {
      role: 'button',
      tabIndex: 0,
      title: 'Ouvrir la fiche',
      onClick: () => onOuvrirPersonne(valeur, null),
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOuvrirPersonne(valeur, null); } },
    };
  };

  /* Dénominateur de `agg: 'part'` : la somme du champ sur toute la base
     filtrée, même convention que la bascule Nombre/Pourcentage ailleurs dans
     l'application — chaque case, chaque total de ligne et de colonne
     rapportés au même total général, jamais à leur propre sous-total. */
  const sommeChamp = (liste) => liste.reduce((a, f) => (f[mesure.champ] != null ? a + f[mesure.champ] : a), 0);
  const totalPart = mesure.agg === 'part' ? sommeChamp(base) : null;
  const totalPartRef = mesure.agg === 'part' ? sommeChamp(baseRef) : null;

  const valeurCellule = (l, c) => agreger(cellules.get(`${l}||${c}`) || [], mesure, totalPart);
  const valeurCelluleRef = (l, c) => agreger(cellulesRef.get(`${l}||${c}`) || [], mesure, totalPartRef);
  const totalLigne = (l) => agreger(base.filter((f) => dimL.get(f) === l), mesure, totalPart);
  const totalColonne = (c) => agreger(base.filter((f) => dimC.get(f) === c), mesure, totalPart);
  const totalGeneral = agreger(base, mesure, totalPart);

  /* Échelle de couleur : repérer d'un coup d'œil les cases fortes */
  const toutes = L.flatMap((l) => C.map((c) => valeurCellule(l, c))).filter((v) => v != null);
  const maxi = toutes.length ? Math.max(...toutes) : 0;

  function exporterCsv() {
    const sep = ';';
    const echapper = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    /* Nomm\u00E9 `lignesCsv` pour ne pas masquer la prop `lignes` (\u00E9tat
       d'acquisition) re\u00E7ue par l'\u00E9cran \u2014 m\u00EAme variable, deux sens diff\u00E9rents,
       source d'erreur si on les confond en relisant plus tard. */
    const enTete = [dimL.label, ...C, 'Total'];
    if (referencePeriode) enTete.push(`\u00C9cart vs ${libelleComparaison(periode)}`);
    const lignesCsv = [enTete.map(echapper).join(sep)];
    L.forEach((l) => {
      const rangee = [l, ...C.map((c) => valeurCellule(l, c)), totalLigne(l)];
      if (referencePeriode) {
        const cur = C.reduce((a, c) => a + (valeurCellule(l, c) || 0), 0);
        const ref = C.reduce((a, c) => a + (valeurCelluleRef(l, c) || 0), 0);
        rangee.push(cur - ref);
      }
      lignesCsv.push(rangee.map(echapper).join(sep));
    });
    lignesCsv.push(['Total', ...C.map((c) => totalColonne(c)), totalGeneral].map(echapper).join(sep));
    const blob = new Blob(['\uFEFF' + lignesCsv.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `croisement-${mesure.k}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* Sans aucune donnée croisable, le croisement n'a rien à montrer — mais le
     lecteur de rapport tableur, lui, reste utilisable : il ne dépend d'aucun
     import. Un import de suivi continu sans séance (voir fusionnerImport)
     suffit désormais à ouvrir l'écran, la table `suivi` ne dépendant pas des
     séances. */
  if (!donnees.seances.length && !(donnees.suivi || []).length && !(donnees.stabilite || []).length) {
    return (
      <div>
        <Empty>Importez une sauvegarde depuis l'onglet Gestion pour explorer les données.</Empty>
        <div className="mt-4"><LecteurExcel /></div>
      </div>
    );
  }

  return (
    <div>
      <Card className="mb-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Mesure</div>
            <select value={mesureK} onChange={(e) => setMesureK(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: INK }}>
              {MESURES.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>En lignes</div>
            <select value={ligneDimEff} onChange={(e) => setLigneDim(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: INK }}>
              {dimensionsApplicables.map((d) => <option key={d.k} value={d.k}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>En colonnes</div>
            <select value={colonneDimEff} onChange={(e) => setColonneDim(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: BORDER, color: INK }}>
              {dimensionsApplicables.map((d) => <option key={d.k} value={d.k}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
          Seules les dimensions qui existent réellement pour la mesure choisie sont proposées :
          un objectif n'a pas d'atelier ni de critère de suivi, une crise n'a pas de phase.
        </p>
      </Card>

      <SelecteurPeriode periode={periode} setPeriode={setPeriode} avecComparaison collant bandeau={bandeau} />

      <Card className="mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>
            {mesure.label} · {libellePeriode(periode)}
            {referencePeriode && ` · écart vs ${libelleComparaison(periode)}`}
          </span>
          <Btn variant="outline" onClick={exporterCsv} disabled={!L.length} className="text-xs py-1.5">
            <Download size={14} /> CSV
          </Btn>
        </div>

        {L.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: INK_SOFT }}>Aucune donnée pour cette combinaison.</p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th className="text-left px-2 py-2 whitespace-nowrap"
                    style={{ borderBottom: `2px solid ${BORDER}`, backgroundColor: CARD, position: 'sticky', top: 0, left: 0, zIndex: 2, color: INK_SOFT }}>
                    {dimL.label}
                  </th>
                  {C.map((c) => (
                    <th key={c} className="text-right px-2 py-2 whitespace-nowrap"
                      {...ouvrable(colonneDimEff, c)}
                      style={{ borderBottom: `2px solid ${BORDER}`, backgroundColor: CARD, position: 'sticky', top: 0,
                        color: ouvrable(colonneDimEff, c).onClick ? ACCENT : INK_SOFT,
                        cursor: ouvrable(colonneDimEff, c).onClick ? 'pointer' : undefined }}>
                      {c}
                    </th>
                  ))}
                  <th className="text-right px-2 py-2 whitespace-nowrap"
                    style={{ borderBottom: `2px solid ${BORDER}`, backgroundColor: CARD, position: 'sticky', top: 0, color: INK }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {L.map((l) => (
                  <tr key={l}>
                    {/* Sortie de cul-de-sac : Explorer fabrique la question
                        (« trois crises pour cette personne cette semaine ») et
                        n'avait aucun moyen d'y donner suite — il fallait retenir
                        des initiales et repartir à la main. L'ouverture est posée
                        sur la cellule et non sur un bouton imbriqué : cet en-tête
                        est `sticky left`, un bouton transparent laisserait le
                        contenu défiler dessous. */}
                    <td className="px-2 py-1.5 whitespace-nowrap font-medium"
                      {...ouvrable(ligneDimEff, l)}
                      style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: CARD, position: 'sticky', left: 0,
                        color: ouvrable(ligneDimEff, l).onClick ? ACCENT : undefined,
                        cursor: ouvrable(ligneDimEff, l).onClick ? 'pointer' : undefined }}>
                      {l}
                    </td>
                    {C.map((c) => {
                      const v = valeurCellule(l, c);
                      const intensite = v != null && maxi ? v / maxi : 0;
                      return (
                        <td key={c} className="px-2 py-1.5 text-right whitespace-nowrap"
                          style={{ borderBottom: `1px solid ${BORDER}`, fontFamily: F_MONO,
                            /* Teinte neutre (l'encre du thème, pas l'accent — une intensité de
                               données n'est pas une sélection) à opacité variable : color-mix plutôt
                               qu'un hex + alpha concaténé, invalide sur un token `var(--…)`. */
                            backgroundColor: v == null ? 'transparent' : `color-mix(in srgb, ${INK} ${Math.round((0.05 + intensite * 0.25) * 100)}%, transparent)` }}>
                          {v == null ? '' : `${v}${mesure.suffixe || ''}`}
                          {referencePeriode && (
                            <div><Ecart valeur={v} reference={valeurCelluleRef(l, c)} unite={mesure.suffixe || ''} hausseFavorable={mesure.hausseFavorable !== false} /></div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap font-semibold"
                      style={{ borderBottom: `1px solid ${BORDER}`, fontFamily: F_MONO }}>
                      {totalLigne(l) == null ? '' : `${totalLigne(l)}${mesure.suffixe || ''}`}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-2 py-2 whitespace-nowrap font-semibold"
                    style={{ borderTop: `2px solid ${BORDER}`, backgroundColor: CARD, position: 'sticky', left: 0 }}>
                    Total
                  </td>
                  {C.map((c) => (
                    <td key={c} className="px-2 py-2 text-right whitespace-nowrap font-semibold"
                      style={{ borderTop: `2px solid ${BORDER}`, fontFamily: F_MONO }}>
                      {totalColonne(c) == null ? '' : `${totalColonne(c)}${mesure.suffixe || ''}`}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right whitespace-nowrap font-semibold"
                    style={{ borderTop: `2px solid ${BORDER}`, fontFamily: F_MONO, color: INK }}>
                    {totalGeneral == null ? '' : `${totalGeneral}${mesure.suffixe || ''}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs mb-4" style={{ color: INK_SOFT }}>
        Une moyenne de moyennes n'est pas une moyenne générale : le total d'une ligne est recalculé
        sur l'ensemble de ses cotations, il ne correspond donc pas à la moyenne des cases affichées.
      </p>

      {/* Le lecteur de rapport tableur vit ici et non dans Gestion : c'est un
          outil de consultation, il a sa place auprès du croisement plutôt
          qu'auprès des réglages. */}
      <LecteurExcel />
    </div>
  );
}

/* ==================== Rapport ==================== */
/* `graphe` séparé de celui de la fiche personne : les deux écrans ont toujours
   eu des choix de style indépendants — le document transmis n'a pas de raison
   de suivre ce qu'on regarde à l'écran. Remonté dans ManagerApp pour la même
   raison que les autres réglages : l'onglet est monté conditionnellement. */
function RapportScreen({ donnees, lignes, selection, setSelection, logo, association, graphe, setGraphe, onLogo, onAssociation, onAlias, onCommentaire, onCodeEfl, onComposerBilan, onEnregistrer, onOuvrirRapport, onSupprimerRapport }) {
  const [avecGraphiques, setAvecGraphiques] = useState(true);
  const style = graphe.style;
  const courbes = graphe.courbes;
  const setStyle = (k) => setGraphe((g) => ({ ...g, style: k }));
  const basculerCourbe = (k) => setGraphe((g) => ({
    ...g,
    courbes: g.courbes.includes(k) ? g.courbes.filter((x) => x !== k) : [...g.courbes, k],
  }));
  const [nomRapport, setNomRapport] = useState('');

  if (!donnees.personnes.length) return <Empty>Importez une sauvegarde pour composer un rapport.</Empty>;

  const personne = selection.personne || donnees.personnes[0].initials;
  const periode = selection.periode || periodeVide();

  const disponibles = lignes.filter((l) => l.initials === personne);
  /* `mesures` n'était pas filtré par la période ici non plus : le document
     imprimé pour un objectif en mesure brute portait tout son historique quel
     que soit le réglage du rapport. Même correction qu'au Tableau de bord et
     à la fiche personne, via filtrerLignePeriode. */
  const retenus = disponibles
    .filter((l) => (selection.objectifs || []).includes(l.objectif))
    .map((l) => filtrerLignePeriode(l, periode));

  const basculer = (objectif) => {
    const cur = selection.objectifs || [];
    setSelection({ ...selection, objectifs: cur.includes(objectif) ? cur.filter((o) => o !== objectif) : [...cur, objectif] });
  };

  function chargerLogo(f) {
    if (!f) return;
    const lecteur = new FileReader();
    lecteur.onload = () => onLogo(lecteur.result);
    lecteur.readAsDataURL(f);
  }

  const aujourdhui = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });


  return (
    <div>
      <Card className="mb-4 no-print">
        <div className="text-sm font-semibold mb-3" style={{ fontFamily: F_DISPLAY }}>Rapports enregistrés</div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input value={nomRapport} onChange={(e) => setNomRapport(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nomRapport.trim()) onEnregistrer(nomRapport); }}
            placeholder="Nom du rapport — ex. Bilan trimestriel L.M."
            className="flex-1 min-w-[220px] rounded-xl border px-3 py-2.5 text-sm bg-transparent"
            style={{ borderColor: BORDER, color: INK }} />
          <Btn onClick={() => onEnregistrer(nomRapport)} disabled={!nomRapport.trim()} className="text-sm">
            Enregistrer
          </Btn>
        </div>

        {(donnees.rapports || []).length === 0 ? (
          <p className="text-xs" style={{ color: INK_SOFT }}>
            Aucun rapport enregistré. Enregistrer conserve la composition — personne, période,
            objectifs retenus et bilan des crises — pour y revenir plus tard.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              {(donnees.rapports || []).map((r) => (
                <div key={r.id} className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: PAPER }}>
                  <button onClick={() => { onOuvrirRapport(r); setNomRapport(r.nom); }} className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-medium break-words">{r.nom}</div>
                    <div className="text-xs" style={{ color: INK_SOFT }}>
                      {nomAffiche(donnees, r.personne)} · {libellePeriode(r.periode)}
                      {' · '}{(r.objectifs || []).length} objectif{(r.objectifs || []).length !== 1 ? 's' : ''}
                      {r.bilanCrises && ' · avec bilan des crises'}
                      {' · modifié le '}{new Date(r.majLe).toLocaleDateString('fr-FR')}
                    </div>
                  </button>
                  <button onClick={() => onSupprimerRapport(r)} className="shrink-0 p-1.5" title="Supprimer ce rapport">
                    <Trash2 size={14} style={{ color: NON_ACQUIS }} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
              Seule la composition est conservée : un rapport rouvert se recalcule sur les cotations
              du moment, il ne fige pas les chiffres du jour où il a été enregistré. Réenregistrer
              sous le même nom remplace l'existant.
            </p>
          </>
        )}
      </Card>

      <Card className="mb-4 no-print">
        <div className="text-sm font-semibold mb-3" style={{ fontFamily: F_DISPLAY }}>Composer le rapport</div>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Association et logo, repris en en-tête</div>
          <input value={association} onChange={(e) => onAssociation(e.target.value)} placeholder="Nom de votre association"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent mb-2" style={{ borderColor: BORDER, color: INK }} />
          <div className="flex items-center gap-3">
            {logo && <img src={logo} alt="" style={{ height: 44, objectFit: 'contain' }} />}
            <input type="file" accept="image/*" onChange={(e) => chargerLogo(e.target.files && e.target.files[0])} className="text-sm" />
            {logo && <Btn variant="ghost" onClick={() => onLogo(null)} className="text-xs py-1.5">Retirer</Btn>}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Personne</div>
          <div className="flex flex-wrap gap-1.5">
            {donnees.personnes.map((p) => (
              <Chip key={p.initials} label={nomAffiche(donnees, p.initials)} on={personne === p.initials}
                onClick={() => setSelection({ ...selection, personne: p.initials, objectifs: [] })} />
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>
            Nom repris dans le document — pour coller aux termes exacts du projet personnalisé
          </div>
          <input value={(donnees.alias.personnes || {})[personne] || ''}
            onChange={(e) => onAlias('personnes', personne, e.target.value)}
            placeholder={`Par défaut : ${personne}`}
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }} />
        </div>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Période couverte par le document</div>
          <SelecteurPeriode periode={periode} setPeriode={(p) => setSelection({ ...selection, periode: p })} />
        </div>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>
            Objectifs à inclure, leur code de curriculum et leur libellé dans le document
          </div>
          <div className="space-y-1.5">
            {disponibles.map((l) => {
              const coche = (selection.objectifs || []).includes(l.objectif);
              return (
                <div key={l.objectif} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ backgroundColor: PAPER }}>
                  <button onClick={() => basculer(l.objectif)}
                    className="w-5 h-5 rounded border flex items-center justify-center shrink-0 text-xs"
                    style={{ borderColor: coche ? ACCENT : BORDER, backgroundColor: coche ? ACCENT : 'transparent', color: ACCENT_INK }}>
                    {coche ? '✓' : ''}
                  </button>
                  <input value={(donnees.codesEfl || {})[l.objectif] || ''}
                    onChange={(e) => onCodeEfl(l.objectif, e.target.value)}
                    placeholder="Code"
                    title="Code de curriculum, repris à côté de l'objectif dans le document"
                    className="w-20 shrink-0 rounded-lg border px-2 py-1.5 text-sm bg-transparent"
                    style={{ borderColor: BORDER, color: INK, fontFamily: F_MONO }} />
                  <input value={(donnees.alias.objectifs || {})[cleAlias(personne, l.objectif)] || ''}
                    onChange={(e) => onAlias('objectifs', cleAlias(personne, l.objectif), e.target.value)}
                    placeholder={l.objectif}
                    className="flex-1 min-w-0 rounded-lg border px-2 py-1.5 text-sm bg-transparent"
                    style={{ borderColor: BORDER, color: INK }} />
                </div>
              );
            })}
          </div>
          <p className="text-xs mt-1.5" style={{ color: INK_SOFT }}>
            Les libellés saisis remplacent l'intitulé de la tablette dans le document, et sont conservés.
            Le code de curriculum est attaché à l'objectif : saisi une fois, il vaut pour toutes les personnes qui le travaillent.
          </p>
        </div>

        <button onClick={() => setAvecGraphiques((v) => !v)} className="flex items-center gap-1.5 text-xs mb-3" style={{ color: INK_SOFT }}>
          <span className="w-9 h-5 rounded-full relative shrink-0" style={{ backgroundColor: avecGraphiques ? INK : BORDER }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white" style={{ left: avecGraphiques ? '1.25rem' : '0.125rem', transition: 'left .15s' }} />
          </span>
          Inclure les graphiques
        </button>
        {avecGraphiques && (
          <>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {STYLES_GRAPHIQUE.map((g) => <Chip key={g.k} label={g.label} on={style === g.k} onClick={() => setStyle(g.k)} />)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Superposer</span>
              {COURBES_LECTURE.map((c) => (
                <Chip key={c.k} label={c.label} on={courbes.includes(c.k)} onClick={() => basculerCourbe(c.k)} />
              ))}
            </div>
          </>
        )}

        {/* Le bilan de crise se compose dans l'onglet Crises, là où se trouvent
            déjà tous les réglages. Y renvoyer évite de les redemander ici sous
            une seconde forme, qui finirait par diverger. */}
        <div className="mb-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: PAPER }}>
          <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
            {selection.bilanCrises
              ? 'Un bilan des crises est joint à ce rapport.'
              : "Aucun bilan des crises n'est joint à ce rapport."}
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" onClick={() => onComposerBilan(personne)} className="text-sm">
              <AlertTriangle size={14} /> {selection.bilanCrises ? 'Modifier le bilan des crises' : 'Composer un bilan des crises'}
            </Btn>
            {selection.bilanCrises && (
              <Btn variant="ghost" onClick={() => setSelection({ ...selection, bilanCrises: null })} className="text-sm">
                Retirer
              </Btn>
            )}
          </div>
        </div>

        <Btn onClick={() => window.print()} disabled={!retenus.length && !selection.bilanCrises} className="w-full">
          <Printer size={16} /> Imprimer ou enregistrer en PDF
        </Btn>
        <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
          Dans la fenêtre d'impression, choisissez votre imprimante, ou « Enregistrer au format PDF »
          pour obtenir un fichier à déposer dans Airmes.
        </p>
      </Card>

      {/* F_DOC sur le conteneur : tout ce qui suit en hérite, sauf les
          valeurs chiffrées et le code de curriculum qui restent en F_MONO —
          un registre institutionnel plutôt que la typographie d'écran, voir
          la constante F_DOC. */}
      <div className="rounded-2xl border p-6" style={{ borderColor: BORDER, backgroundColor: CARD, fontFamily: F_DOC }}>
        <div className="flex items-start justify-between gap-4 pb-4 mb-5" style={{ borderBottom: `2px solid ${INK}` }}>
          <div className="min-w-0">
            <div className="text-lg font-semibold">{association || 'Bilan de suivi'}</div>
            <div className="text-sm" style={{ color: INK_SOFT }}>
              {nomAffiche(donnees, personne)} · période : {libellePeriode(periode)} · établi le {aujourdhui}
            </div>
          </div>
          {logo && <img src={logo} alt="" style={{ height: 56, objectFit: 'contain' }} />}
        </div>

        {retenus.length === 0 ? (
          <p className="text-sm" style={{ color: INK_SOFT }}>
            {selection.bilanCrises ? 'Aucun objectif sélectionné — le document ne contient que le bilan des crises.' : 'Sélectionnez au moins un objectif.'}
          </p>
        ) : (
          retenus.map((l, i) => {
            const cle = cleAlias(personne, l.objectif);
            const dernier = l.points.length ? l.points[l.points.length - 1].value : null;
            const commentaire = (donnees.commentaires || {})[cle] || '';
            /* Un objectif suivi en mesure brute n'a pas de `points` : la
               ligne d'en-tête imprimait « 0 séances sur la période » sur un
               objectif qui en portait trente. Le corps du bloc distingue déjà
               les deux séries plus bas, l'en-tête doit le faire aussi. */
            const enMesureEnTete = !l.points.length && (l.mesures || []).length > 0;
            const nbCotations = l.points.length + (l.mesures || []).length;
            return (
              <div key={i} className="mb-6 pb-5" style={{ breakInside: 'avoid', borderBottom: i < retenus.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="text-base font-semibold min-w-0 break-words">
                    {codeEflDe(donnees, l.objectif) && (
                      <span className="text-xs font-medium mr-2 px-1.5 py-0.5 rounded align-middle"
                        style={{ fontFamily: F_MONO, backgroundColor: PAPER, color: INK_SOFT, border: `1px solid ${BORDER}` }}>
                        {codeEflDe(donnees, l.objectif)}
                      </span>
                    )}
                    {libelleAffiche(donnees, personne, l.objectif)}
                  </div>
                  <span className="text-sm font-semibold shrink-0" style={{ color: ETATS[l.etat].color }}>
                    {ETAT_RAPPORT[l.etat]}
                  </span>
                </div>
                <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
                  {nbCotations} {enMesureEnTete ? 'cotation' : 'séance'}{nbCotations !== 1 ? 's' : ''} sur la période
                  {dernier != null && ` · dernier résultat ${dernier} %`}
                  {libelleCritere(l) && ` · critère ${libelleCritere(l)}`}
                  {l.phase && ` · phase ${l.phase}`}
                </div>

                {(() => {
                  const enMesure = !l.points.length && (l.mesures || []).length > 0;
                  if (!enMesure) {
                    return avecGraphiques && l.points.length > 0 ? (
                      <div className="mb-3"><Graphique points={l.points} style={style} courbes={courbes} seuil={l.threshold} hauteur={180} phases={l.phaseHistory} /></div>
                    ) : null;
                  }
                  const journalieres = moyennesParJour(l.mesures);
                  const ev = evolutionMoyenne(journalieres);
                  const moyenne = journalieres.length
                    ? Math.round((journalieres.reduce((a, j) => a + j.value, 0) / journalieres.length) * 10) / 10 : null;
                  return (
                    <>
                      <div className="text-sm mb-2">
                        {moyenne != null && (
                          <>Moyenne : <strong style={{ fontFamily: F_MONO }}>{moyenne} {l.unite}</strong> par jour de relevé
                          <span style={{ color: INK_SOFT }}> · {journalieres.length} jour{journalieres.length !== 1 ? 's' : ''}</span></>
                        )}
                        {ev && ev.pct != null && (
                          <> · Évolution : <strong style={{ fontFamily: F_MONO }}>{ev.pct > 0 ? '+' : ''}{ev.pct} %</strong>
                          <span style={{ color: INK_SOFT }}> (de {ev.depart} à {ev.arrivee} {l.unite})</span></>
                        )}
                        {ev && ev.pct == null && (
                          <> · Évolution : <strong style={{ fontFamily: F_MONO }}>{ev.depart} → {ev.arrivee} {l.unite}</strong></>
                        )}
                      </div>
                      {avecGraphiques && journalieres.length > 0 && (
                        <div className="mb-3">
                          <Graphique points={journalieres} style={style} courbes={courbes} seuil={null} hauteur={180} unite={l.unite} phases={l.phaseHistory} />
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="text-xs mb-1 no-print" style={{ color: INK_SOFT }}>Commentaire</div>
                <textarea value={commentaire} onChange={(e) => onCommentaire(cle, e.target.value)} rows={3}
                  placeholder="Observations, contexte, suites à donner…"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent no-print"
                  style={{ borderColor: BORDER, color: INK, fontFamily: F_BODY }} />
                {commentaire && <p className="text-sm whitespace-pre-wrap print-only" style={{ color: INK }}>{commentaire}</p>}
              </div>
            );
          })
        )}

        {selection.bilanCrises && (
          <BilanCrises donnees={donnees} config={selection.bilanCrises} periode={periode} />
        )}

        <p className="text-xs mt-6 pt-3" style={{ color: INK_SOFT, borderTop: `1px solid ${BORDER}` }}>
          Document établi à partir des cotations relevées sur DatABA. Les états sont calculés selon le
          critère d'acquisition défini pour chaque objectif.
        </p>
      </div>
    </div>
  );
}

/* ==================== Bilan des crises dans le rapport ====================
   Volontairement mince : tout le rendu vient de BlocsCrise, le même qui sert à
   l'écran. Le bilan imprimé dans un rapport est donc exactement celui qui a
   été composé dans l'onglet Crises, blocs décochés compris. */
function BilanCrises({ donnees, config, periode }) {
  const crises = crisesRetenues(donnees, config, periode);
  const qui = (config.personnes || []).length
    ? config.personnes.map((i) => nomAffiche(donnees, i)).join(', ')
    : 'toutes les personnes';

  return (
    <div className="mt-6 pt-5" style={{ borderTop: `2px solid ${INK}` }}>
      {/* Pas de fontFamily ici : BilanCrises n'est monté que dans le document
          du rapport, elle hérite donc de F_DOC posé sur son conteneur. */}
      <div className="text-base font-semibold mb-1">Bilan des crises</div>
      <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
        {qui} · {libellePeriode(periode)}
      </div>
      {crises.length === 0 ? (
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Aucune crise ni observation consignée sur la période.
        </p>
      ) : (
        <BlocsCrise donnees={donnees} crises={crises} periode={periode} config={config} />
      )}
    </div>
  );
}
/* ==================== Lecture d'un rapport Excel ====================
   Le cadre reçoit deux types de fichiers : la sauvegarde qui alimente
   l'analyse, et le rapport tableur destiné à la lecture. Plutôt que de le
   renvoyer vers Excel, on l'ouvre ici avec le tri et les filtres qu'il en
   attendrait. */
function LecteurExcel() {
  const [classeur, setClasseur] = useState(null);
  const [feuille, setFeuille] = useState(null);
  const [erreur, setErreur] = useState('');
  const [tri, setTri] = useState({ colonne: null, sens: 1 });
  const [filtres, setFiltres] = useState({});
  const [recherche, setRecherche] = useState('');

  async function ouvrir(f) {
    if (!f) return;
    setErreur('');
    setRecherche('');
    setTri({ colonne: null, sens: 'asc' });
    setTri({ colonne: null, sens: 1 });
    setFiltres({});
    setRecherche('');
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      if (!wb.SheetNames.length) { setErreur('Ce classeur ne contient aucune feuille.'); return; }
      setClasseur({ nom: f.name, wb });
      setFeuille(wb.SheetNames[0]);
    } catch (e) {
      setErreur('Fichier illisible. Attendu : un rapport Excel produit par DatABA.');
    }
  }

  const brut = classeur && feuille
    ? XLSX.utils.sheet_to_json(classeur.wb.Sheets[feuille], { header: 1, defval: '' })
    : [];
  const entetes = brut[0] || [];
  const corps = brut.slice(1);

  /* Valeurs distinctes par colonne, pour proposer un filtre lorsqu'elles sont
     peu nombreuses — au-delà, une liste déroulante devient inutilisable. */
  const valeursDistinctes = entetes.map((_, j) => {
    const set = new Set(corps.map((r) => String(r[j] == null ? '' : r[j])));
    return set.size <= 30 ? Array.from(set).sort((a, b) => a.localeCompare(b, 'fr')) : null;
  });

  let lignes = corps.filter((r) => {
    if (recherche && !r.some((v) => String(v).toLowerCase().includes(recherche.toLowerCase()))) return false;
    return Object.entries(filtres).every(([j, val]) => !val || String(r[j] == null ? '' : r[j]) === val);
  });

  if (tri.colonne != null) {
    const j = tri.colonne;
    lignes = lignes.slice().sort((a, b) => {
      const x = a[j];
      const y = b[j];
      /* Un tri alphabétique sur des nombres placerait 10 avant 9 */
      const nx = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
      const ny = typeof y === 'number' ? y : parseFloat(String(y).replace(',', '.'));
      if (!Number.isNaN(nx) && !Number.isNaN(ny)) return (nx - ny) * tri.sens;
      return String(x).localeCompare(String(y), 'fr') * tri.sens;
    });
  }

  const basculerTri = (j) =>
    setTri((t) => (t.colonne === j ? { colonne: j, sens: -t.sens } : { colonne: j, sens: 1 }));

  function exporterFiltre() {
    const sep = ';';
    const contenu = [entetes.join(sep), ...lignes.map((r) => entetes.map((_, j) => String(r[j] == null ? '' : r[j])).join(sep))].join('\n');
    const blob = new Blob(['\uFEFF' + contenu], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrait-${feuille}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const filtresActifs = Object.values(filtres).filter(Boolean).length + (recherche ? 1 : 0);

  return (
    <Card>
      <div className="flex items-center gap-1.5 mb-2">
        <Table2 size={16} style={{ color: INK_SOFT }} />
        <span className="text-sm font-semibold" style={{ fontFamily: F_DISPLAY }}>Lire un rapport Excel</span>
      </div>
      <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
        Avec tri et filtres, sans ouvrir Excel. Ce fichier n'est pas intégré à l'analyse :
        il ne contient pas les critères d'acquisition.
      </p>
      <input type="file" accept=".xlsx,.xls" onChange={(e) => ouvrir(e.target.files && e.target.files[0])}
        className="w-full text-sm mb-2" />
      {erreur && <p className="text-xs rounded-lg px-2.5 py-2" style={{ color: texteLisibleSur(NON_ACQUIS), backgroundColor: NON_ACQUIS }}>{erreur}</p>}

      {classeur && (
        <>
          <div className="flex flex-wrap gap-1.5 my-3">
            {classeur.wb.SheetNames.map((n) => (
              <Chip key={n} label={n} on={feuille === n}
                onClick={() => { setFeuille(n); setTri({ colonne: null, sens: 1 }); setFiltres({}); }} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher dans toutes les colonnes"
              className="flex-1 min-w-[200px] rounded-xl border px-3 py-2 text-sm bg-transparent"
              style={{ borderColor: BORDER, color: INK }} />
            {filtresActifs > 0 && (
              <Btn variant="ghost" onClick={() => { setFiltres({}); setRecherche(''); }} className="text-xs py-1.5">
                <X size={13} /> Effacer les filtres ({filtresActifs})
              </Btn>
            )}
            <Btn variant="outline" onClick={exporterFiltre} className="text-xs py-1.5">
              <Download size={13} /> Exporter l'extrait
            </Btn>
          </div>

          <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
            {lignes.length} ligne{lignes.length !== 1 ? 's' : ''}
            {lignes.length !== corps.length && ` sur ${corps.length}`}
            {lignes.length > 300 && ' — les 300 premières sont affichées'}
          </div>

          {/* Filtres par colonne, là où les valeurs sont assez peu nombreuses */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {entetes.map((h, j) => (valeursDistinctes[j] && valeursDistinctes[j].length > 1 ? (
              <select key={j} value={filtres[j] || ''} onChange={(e) => setFiltres((f) => ({ ...f, [j]: e.target.value }))}
                className="rounded-lg border px-2 py-1.5 text-xs"
                style={{ borderColor: filtres[j] ? INK : BORDER, color: filtres[j] ? INK : INK_SOFT }}>
                <option value="">{String(h)} : tout</option>
                {valeursDistinctes[j].map((v) => <option key={v} value={v}>{v || '(vide)'}</option>)}
              </select>
            ) : null))}
          </div>

          <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
            <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr>
                  {entetes.map((h, j) => (
                    <th key={j} onClick={() => basculerTri(j)}
                      className="text-left px-2 py-1.5 whitespace-nowrap cursor-pointer select-none"
                      style={{ borderBottom: `2px solid ${BORDER}`, backgroundColor: PAPER, position: 'sticky', top: 0, color: tri.colonne === j ? INK : INK_SOFT }}>
                      {String(h)}{tri.colonne === j ? (tri.sens > 0 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.slice(0, 300).map((r, i) => (
                  <tr key={i}>
                    {entetes.map((_, j) => (
                      <td key={j} className="px-2 py-1 whitespace-nowrap" style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {String(r[j] == null ? '' : r[j])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

/* ==================== Gestion ==================== */
/* Paquet d'export au format Manager (`aba-manager-export`) — partagé entre
   l'export complet de GestionScreen (personnes seules, tout l'historique)
   et l'export de détail d'une personne sur une période (PersonnesScreen).
   `periode` est optionnelle : absente, tout l'historique part comme avant.
   Réglée, elle filtre les quatre tableaux datés par `dansPeriode` —
   séances, crises, suivi ET stabilite, les quatre : même exigence
   d'exhaustivité que les purges (CLAUDE.md), pour la même raison qu'un
   tableau oublié laisse filer des données d'usager qu'on croit exclues. */
function construirePaquetExport(donnees, initialesRetenues, periode) {
  const garder = (initialesRetenues || []).length ? new Set(initialesRetenues) : null;
  const ini = (source, sid) => ((donnees._idVersInitiales || {})[source] || {})[sid];
  const dansLaPeriode = (date) => !periode || dansPeriode(date, periode);
  const personnes = donnees.personnes.filter((p) => !garder || garder.has(p.initials));
  /* Les classes retenues sont celles que gardent encore les personnes
     sélectionnées : envoyer la liste complète enverrait le nom d'une classe
     qui ne concerne aucune des personnes exportées. */
  const classesGardees = new Set(personnes.map((p) => p.classeId).filter(Boolean));
  const classes = (donnees.classes || []).filter((c) => classesGardees.has(c.id));
  const seances = donnees.seances.filter((s) => (!garder || (s.studentIds || []).some((sid) => garder.has(ini(s.source, sid)))) && dansLaPeriode(s.date));
  const crises = donnees.crises.filter((c) => (!garder || garder.has(ini(c.source, c.studentId))) && dansLaPeriode(c.date));
  const stabilite = (donnees.stabilite || []).filter((r) => (!garder || garder.has(ini(r.source, r.studentId))) && dansLaPeriode(r.timestamp));
  const suivi = (donnees.suivi || []).filter((r) => (!garder || garder.has(ini(r.source, r.studentId))) && dansLaPeriode(r.timestamp));
  const alias = { personnes: {}, objectifs: {} };
  Object.entries(donnees.alias.personnes || {}).forEach(([k, v]) => { if (!garder || garder.has(k)) alias.personnes[k] = v; });
  Object.entries(donnees.alias.objectifs || {}).forEach(([k, v]) => { if (!garder || garder.has(k.split('|')[0])) alias.objectifs[k] = v; });
  const commentaires = {};
  Object.entries(donnees.commentaires || {}).forEach(([k, v]) => { if (!garder || garder.has(k.split('|')[0])) commentaires[k] = v; });
  /* Les codes de curriculum ne dépendent d'aucune personne : ils partent en
     entier, même sur un export restreint à quelques personnes ou une
     période resserrée. */
  const codesEfl = { ...(donnees.codesEfl || {}) };
  /* Même filtrage que `commentaires` : la clé porte les initiales avant le
     premier séparateur. */
  const objectifsSuivi = {};
  Object.entries(donnees.objectifsSuivi || {}).forEach(([k, v]) => { if (!garder || garder.has(k.split('|')[0])) objectifsSuivi[k] = v; });
  /* Rapports enregistrés : ils ne partaient pas du tout, si bien qu'un
     transfert Manager → Manager les perdait tous en silence. Filtrés sur les
     personnes retenues comme les alias et les commentaires — un rapport dont
     le sujet n'est pas exporté n'aurait rien à rouvrir à l'arrivée. */
  const rapports = (donnees.rapports || []).filter((r) => !garder || garder.has(r.personne));

  return {
    format: 'aba-manager-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    personnes, classes, seances, crises, stabilite, suivi,
    sources: donnees.sources,
    _idVersInitiales: donnees._idVersInitiales,
    _ateliers: donnees._ateliers,
    _compteurs: donnees._compteurs,
    _intervenants: donnees._intervenants,
    _axesSuivi: donnees._axesSuivi,
    _guidances: donnees._guidances,
    alias, commentaires, codesEfl, objectifsSuivi, rapports,
  };
}

function GestionScreen({ donnees, securite, accent, onAccent, onImported, onChangerMotDePasse, onRetirerProtection, onPurger, notify, etatStockage, persistant }) {
  const [fichier, setFichier] = useState(null);
  const [enveloppe, setEnveloppe] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [exportPersonnes, setExportPersonnes] = useState([]);
  const [demandeCle, setDemandeCle] = useState(null);
  const [cleExport, setCleExport] = useState('');
  const [changement, setChangement] = useState(null);
  const [avant, setAvant] = useState('');

  const limiteAvant = avant ? new Date(`${avant}T00:00:00`) : null;
  const nbAvant = limiteAvant ? donnees.seances.filter((x) => new Date(x.date) < limiteAvant).length : 0;
  const nbCrisesAvant = limiteAvant ? donnees.crises.filter((x) => new Date(x.date) < limiteAvant).length : 0;

  function integrer(backup, nom) {
    /* La tablette d'origine est inscrite dans le fichier depuis la version 3 :
       elle prime sur le nom du fichier, qu'un renommage ou un transfert par
       messagerie fait facilement perdre. */
    const source = (backup.appareil || '').trim() || nom.replace(/\.json$/i, '');
    onImported(fusionnerImport(donnees, backup, source));
    setFichier(null); setEnveloppe(null); setPassphrase('');
  }

  /* Fichier venu d'un autre Manager : on reprend ses sources telles quelles,
     pour que le rapprochement des personnes reste cohérent. */
  function integrerManager(paquet) {
    let cumul = donnees;
    /* Les personnes du paquet portent déjà leur classeId : on le réinjecte
       dans `students` pour que fusionnerImport le reprenne comme à un import
       de tablette, et on transmet la définition des classes en une fois —
       fusionnerClasses la déduplique par id, la répéter à chaque source ne
       coûte rien. */
    const classeIdDe = Object.fromEntries((paquet.personnes || []).map((p) => [p.initials, p.classeId || null]));
    /* Toutes les données du paquet sont attribuées à une source : sans liste
       de sources, la boucle ci-dessous ne tourne pas et l'import ne reprend
       rien du tout. Le dire plutôt que de laisser croire à une réussite. */
    if (!(paquet.sources || []).length) {
      setErreur("Ce fichier ne déclare aucune tablette d'origine : il n'y a rien à reprendre.");
      return;
    }
    /* `suivi` prime sur `stabilite`, mais le test porte sur le contenu et non
       sur le type : `normaliser` garantit un tableau pour les deux, si bien
       qu'un `Array.isArray(paquet.suivi)` était toujours vrai et rendait la
       branche `stabilite` inatteignable — un Manager n'ayant que des relevés
       v3 les perdait intégralement au réimport de son propre export. */
    const paquetEnV4 = (paquet.suivi || []).length > 0 || !(paquet.stabilite || []).length;
    (paquet.sources || []).forEach((src) => {
      const table = (paquet._idVersInitiales || {})[src] || {};
      const backup = {
        students: Object.entries(table).map(([id, initials]) => ({ id, initials, classeId: classeIdDe[initials] || null })),
        classes: paquet.classes || [],
        ateliers: Object.entries((paquet._ateliers || {})[src] || {}).map(([id, name]) => ({ id, name })),
        /* Tableau plat plutôt que `students[].compteurs` : la reconstruction
           ci-dessus ne sait pas à quelle personne rattacher quel compteur, et
           fusionnerImport n'en a pas besoin — sa table est indexée par source,
           pas par personne. Sans cette ligne, un aller-retour Manager → Manager
           perdrait les noms de compteurs. */
        compteurs: Object.entries((paquet._compteurs || {})[src] || {}).map(([id, nom]) => ({ id, nom })),
        intervenants: Object.entries((paquet._intervenants || {})[src] || {}).map(([id, name]) => ({ id, name })),
        /* Même forme que dans la sauvegarde de tablette : sans elle, un
           aller-retour Manager → Manager perdrait le jeu de guidances de
           l'établissement et les pourcentages changeraient au passage. */
        guidances: (paquet._guidances || {})[src] || [],
        sessions: (paquet.seances || []).filter((s) => s.source === src),
        crises: (paquet.crises || []).filter((c) => c.source === src),
        /* Même règle que fusionnerImport : `suivi` prime sur `stabilite`, pour
           ne pas compter deux fois les mêmes relevés. */
        ...(paquetEnV4
          ? { suivi: (paquet.suivi || []).filter((r) => r.source === src), axesSuivi: (paquet._axesSuivi || {})[src] || [] }
          : { stabilite: (paquet.stabilite || []).filter((r) => r.source === src) }),
      };
      cumul = fusionnerImport(cumul, backup, src);
    });
    cumul = {
      ...cumul,
      alias: {
        personnes: { ...(cumul.alias.personnes || {}), ...((paquet.alias || {}).personnes || {}) },
        objectifs: { ...(cumul.alias.objectifs || {}), ...((paquet.alias || {}).objectifs || {}) },
      },
      commentaires: { ...(cumul.commentaires || {}), ...(paquet.commentaires || {}) },
      codesEfl: { ...(cumul.codesEfl || {}), ...(paquet.codesEfl || {}) },
      objectifsSuivi: { ...(cumul.objectifsSuivi || {}), ...(paquet.objectifsSuivi || {}) },
      /* Rapports enregistrés, dédupliqués par id : le paquet gagne sur un
         rapport déjà connu, comme partout ailleurs à l'import. */
      rapports: fusionnerParId(cumul.rapports || [], paquet.rapports || []).liste,
    };
    onImported(cumul);
    setFichier(null); setEnveloppe(null); setPassphrase('');
    notify('Données reprises depuis un autre Manager');
  }

  async function analyser(f) {
    setErreur(''); setEnveloppe(null); setFichier(f);
    if (!f) return;
    if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
      setErreur("Ce fichier est un rapport tableur : il se consulte dans l'onglet Explorer, tout en bas. Pour alimenter l'analyse, utilisez dans DatABA : Export → « Fichier pour DatABA Manager ».");
      setFichier(null);
      return;
    }
    let contenu;
    try {
      contenu = JSON.parse(await f.text());
    } catch (e) {
      setErreur('Fichier illisible. Attendu : une sauvegarde DatABA au format .json.');
      setFichier(null);
      return;
    }
    if (contenu.format === 'aba-backup-encrypted') { setEnveloppe(contenu); return; }
    if (contenu.format === 'aba-backup') { integrer(contenu, f.name); return; }
    if (contenu.format === 'aba-manager-export') { integrerManager(contenu); return; }
    if (contenu.format === 'aba-config') {
      setErreur('Ce fichier ne contient que la configuration, sans aucune séance.');
      setFichier(null);
      return;
    }
    setErreur('Format non reconnu.');
    setFichier(null);
  }

  async function dechiffrer() {
    if (!enveloppe || !passphrase) return;
    setEnCours(true); setErreur('');
    try {
      const contenu = await decryptEnvelope(enveloppe, passphrase);
      if (contenu.format === 'aba-manager-export') integrerManager(contenu);
      else integrer(contenu, fichier.name);
    } catch (e) {
      setErreur('Mot de passe incorrect ou fichier corrompu.');
    }
    setEnCours(false);
  }

  /* Export complet : tout l'historique, pas de période. Le détail borné à
     une personne et une période vit dans PersonnesScreen, sur la même
     fonction (`construirePaquetExport`). */
  const construirePaquet = (initialesRetenues) => construirePaquetExport(donnees, initialesRetenues, null);

  function telecharger(blob, nom) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exporter(chiffre) {
    const paquet = construirePaquet(exportPersonnes);
    const suffixe = exportPersonnes.length ? exportPersonnes.map((i) => i.replace(/\./g, '')).join('-') : 'tout';
    const nom = `manager-${suffixe}-${new Date().toISOString().slice(0, 10)}.json`;
    if (!chiffre) {
      telecharger(new Blob([JSON.stringify(paquet, null, 2)], { type: 'application/json' }), nom);
      notify('Export sans chiffrement');
      return;
    }
    setDemandeCle({ paquet, nom });
  }

  async function confirmerExportChiffre() {
    if (cleExport.length < 4) return;
    const env = await encryptJSON(demandeCle.paquet, cleExport);
    telecharger(new Blob([JSON.stringify(env)], { type: 'application/json' }), demandeCle.nom);
    setDemandeCle(null);
    setCleExport('');
    notify('Export chiffré');
  }

  return (
    <div>
      <Card className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Upload size={16} style={{ color: INK_SOFT }} />
          <span className="text-sm font-semibold" style={{ fontFamily: F_DISPLAY }}>Importer</span>
        </div>
        <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Sauvegarde DatABA, ou export venu d'un autre Manager. Le format est reconnu au contenu ;
          les séances déjà connues ne sont pas dupliquées.
        </p>
        <input type="file" onChange={(e) => analyser(e.target.files && e.target.files[0])} className="w-full text-sm mb-2" />
        {enveloppe && (
          <>
            <p className="text-xs mb-2" style={{ color: INK_SOFT }}>Fichier chiffré — saisissez la clé.</p>
            <input type="password" value={passphrase} autoFocus onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') dechiffrer(); }}
              placeholder="Mot de passe du fichier"
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent mb-2" style={{ borderColor: BORDER, color: INK }} />
            <Btn onClick={dechiffrer} disabled={!passphrase || enCours} className="w-full">
              {enCours ? 'Déchiffrement…' : 'Déchiffrer et importer'}
            </Btn>
          </>
        )}
        {erreur && <p className="text-xs mt-2 rounded-lg px-2.5 py-2" style={{ color: texteLisibleSur(NON_ACQUIS), backgroundColor: NON_ACQUIS }}>{erreur}</p>}
        {donnees.sources.length > 0 && (
          <p className="text-xs mt-3" style={{ color: INK_SOFT }}>Sources importées : {donnees.sources.join(', ')}</p>
        )}
      </Card>

      <CarteStockage etat={etatStockage} persistant={persistant} />

      <Card className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Download size={16} style={{ color: INK_SOFT }} />
          <span className="text-sm font-semibold" style={{ fontFamily: F_DISPLAY }}>Exporter</span>
        </div>
        <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Pour transmettre à un autre poste équipé de Manager, ou pour archiver. Sans sélection,
          tout est exporté. Libellés personnalisés et commentaires suivent.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {donnees.personnes.map((p) => (
            <Chip key={p.initials} label={nomAffiche(donnees, p.initials)}
              on={exportPersonnes.includes(p.initials)}
              onClick={() => setExportPersonnes((cur) => (cur.includes(p.initials) ? cur.filter((x) => x !== p.initials) : [...cur, p.initials]))} />
          ))}
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" onClick={() => exporter(true)} className="flex-1 text-sm">Chiffré</Btn>
          <Btn variant="ghost" onClick={() => {
            if (window.confirm("Exporter sans chiffrement ?\n\nLe fichier sera lisible par quiconque y a accès.")) exporter(false);
          }} className="flex-1 text-sm">Sans chiffrement</Btn>
        </div>

        {demandeCle && (
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: BORDER, backgroundColor: PAPER }}>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Mot de passe protégeant ce fichier</div>
            <input type="password" value={cleExport} autoFocus onChange={(e) => setCleExport(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmerExportChiffre(); }}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent mb-2" style={{ borderColor: BORDER, color: INK }} />
            <div className="flex gap-2">
              <Btn onClick={confirmerExportChiffre} disabled={cleExport.length < 4} className="flex-1 text-sm">Chiffrer et télécharger</Btn>
              <Btn variant="ghost" onClick={() => { setDemandeCle(null); setCleExport(''); }} className="text-sm">Annuler</Btn>
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Trash2 size={16} style={{ color: INK_SOFT }} />
          <span className="text-sm font-semibold" style={{ fontFamily: F_DISPLAY }}>Purger les données</span>
        </div>
        <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Les suppressions sont définitives et ne touchent que ce poste : les tablettes conservent
          leurs propres données, et une réimportation reste possible depuis le dossier partagé.
          Exportez avant si vous voulez pouvoir revenir en arrière.
        </p>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Séances antérieures à une date</div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={avant} onChange={(e) => setAvant(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }} />
            <Btn variant="outline" disabled={!avant || !nbAvant} className="text-sm"
              onClick={() => {
                if (window.confirm(`Supprimer ${nbAvant} séance(s) et ${nbCrisesAvant} crise(s) antérieures au ${new Date(`${avant}T00:00:00`).toLocaleDateString('fr-FR')} ?\n\nSuppression définitive.`)) {
                  onPurger((d) => ({
                    ...d,
                    seances: d.seances.filter((x) => new Date(x.date) >= new Date(`${avant}T00:00:00`)),
                    crises: d.crises.filter((x) => new Date(x.date) >= new Date(`${avant}T00:00:00`)),
                    stabilite: (d.stabilite || []).filter((x) => new Date(x.timestamp) >= new Date(`${avant}T00:00:00`)),
                    suivi: (d.suivi || []).filter((x) => new Date(x.timestamp) >= new Date(`${avant}T00:00:00`)),
                  }));
                }
              }}>
              Supprimer {avant ? `(${nbAvant} séances, ${nbCrisesAvant} crises)` : ''}
            </Btn>
          </div>
        </div>

        {donnees.sources.length > 0 && (
          <div className="mb-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Tout ce qui vient d'une source</div>
            <div className="flex flex-wrap gap-1.5">
              {donnees.sources.map((src) => {
                const n = donnees.seances.filter((x) => x.source === src).length;
                return (
                  <button key={src}
                    onClick={() => {
                      if (!window.confirm(`Supprimer la source « ${src} » ?\n\n${n} séance(s) et les crises associées seront retirées.\n\nSuppression définitive.`)) return;
                      onPurger((d) => {
                        const reste = { ...(d._idVersInitiales || {}) };
                        delete reste[src];
                        const ate = { ...(d._ateliers || {}) };
                        delete ate[src];
                        const inter = { ...(d._intervenants || {}) };
                        delete inter[src];
                        const axes = { ...(d._axesSuivi || {}) };
                        delete axes[src];
                        const compt = { ...(d._compteurs || {}) };
                        delete compt[src];
                        const guid = { ...(d._guidances || {}) };
                        delete guid[src];
                        const seances = d.seances.filter((x) => x.source !== src);
                        const crises = d.crises.filter((x) => x.source !== src);
                        const stabilite = (d.stabilite || []).filter((x) => x.source !== src);
                        const suivi = (d.suivi || []).filter((x) => x.source !== src);
                        /* Une personne qui n'apparaît plus nulle part disparaît aussi */
                        const encore = new Set();
                        Object.values(reste).forEach((t) => Object.values(t).forEach((i) => encore.add(i)));
                        /* Et ses dictionnaires avec elle. La purge par personne
                           les traitait déjà, celle-ci les laissait derrière :
                           libellés, commentaires et réglages de suivi promus
                           survivaient à la disparition de leur sujet, puis
                           ressuscitaient si les mêmes initiales revenaient à un
                           import ultérieur — sur une autre personne. */
                        const survit = (k) => encore.has(k.split('|')[0]);
                        const alias = {
                          personnes: Object.fromEntries(Object.entries(d.alias.personnes || {}).filter(([k]) => encore.has(k))),
                          objectifs: Object.fromEntries(Object.entries(d.alias.objectifs || {}).filter(([k]) => survit(k))),
                        };
                        const commentaires = Object.fromEntries(Object.entries(d.commentaires || {}).filter(([k]) => survit(k)));
                        const objectifsSuivi = Object.fromEntries(Object.entries(d.objectifsSuivi || {}).filter(([k]) => survit(k)));
                        const rapports = (d.rapports || []).filter((r) => encore.has(r.personne));
                        return {
                          ...d, seances, crises, stabilite, suivi, sources: d.sources.filter((x) => x !== src),
                          _idVersInitiales: reste, _ateliers: ate, _intervenants: inter, _axesSuivi: axes,
                          _compteurs: compt,
                          _guidances: guid,
                          alias, commentaires, objectifsSuivi, rapports,
                          personnes: d.personnes.filter((pp) => encore.has(pp.initials)),
                        };
                      });
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs border"
                    style={{ borderColor: BORDER, color: INK_SOFT }}>
                    {src} ({n})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {donnees.personnes.length > 0 && (
          <div className="mb-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Tout ce qui concerne une personne</div>
            <div className="flex flex-wrap gap-1.5">
              {donnees.personnes.map((pp) => (
                <button key={pp.initials}
                  onClick={() => {
                    if (!window.confirm(`Supprimer toutes les données de ${nomAffiche(donnees, pp.initials)} ?\n\nSes cotations dans les séances partagées seront retirées, ainsi que ses crises, libellés et commentaires.\n\nSuppression définitive.`)) return;
                    onPurger((d) => {
                      const idDe = (src) => idPourSource(d, src, pp.initials);
                      const seances = d.seances
                        .map((se) => {
                          const sid = idDe(se.source);
                          if (!sid || !(se.studentIds || []).includes(sid)) return se;
                          const studentIds = se.studentIds.filter((x) => x !== sid);
                          const selectedObjectives = { ...(se.selectedObjectives || {}) };
                          delete selectedObjectives[sid];
                          const data = { ...(se.data || {}) };
                          delete data[sid];
                          return { ...se, studentIds, selectedObjectives, data };
                        })
                        .filter((se) => (se.studentIds || []).length > 0);
                      const crises = d.crises.filter((c) => ((d._idVersInitiales || {})[c.source] || {})[c.studentId] !== pp.initials);
                      const stabilite = (d.stabilite || []).filter((r) => ((d._idVersInitiales || {})[r.source] || {})[r.studentId] !== pp.initials);
                      const suivi = (d.suivi || []).filter((r) => ((d._idVersInitiales || {})[r.source] || {})[r.studentId] !== pp.initials);
                      const alias = {
                        personnes: { ...(d.alias.personnes || {}) },
                        objectifs: Object.fromEntries(Object.entries(d.alias.objectifs || {}).filter(([k]) => k.split('|')[0] !== pp.initials)),
                      };
                      delete alias.personnes[pp.initials];
                      const commentaires = Object.fromEntries(Object.entries(d.commentaires || {}).filter(([k]) => k.split('|')[0] !== pp.initials));
                      const objectifsSuivi = Object.fromEntries(Object.entries(d.objectifsSuivi || {}).filter(([k]) => k.split('|')[0] !== pp.initials));
                      /* Les rapports enregistrés manquaient au lot : un rapport
                         dont le sujet vient d'être supprimé s'ouvrait encore,
                         sur une fiche vide. */
                      const rapports = (d.rapports || []).filter((r) => r.personne !== pp.initials);
                      const idVers = {};
                      Object.entries(d._idVersInitiales || {}).forEach(([src, t]) => {
                        idVers[src] = Object.fromEntries(Object.entries(t).filter(([, i]) => i !== pp.initials));
                      });
                      return {
                        ...d, seances, crises, stabilite, suivi, alias, commentaires, objectifsSuivi, rapports,
                        _idVersInitiales: idVers,
                        personnes: d.personnes.filter((x) => x.initials !== pp.initials),
                      };
                    });
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs border"
                  style={{ borderColor: BORDER, color: INK_SOFT }}>
                  {nomAffiche(donnees, pp.initials)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            onClick={() => {
              if (window.confirm(`Effacer TOUTES les données consolidées ?\n\n${donnees.personnes.length} personne(s), ${donnees.seances.length} séance(s), ${donnees.crises.length} crise(s).\n\nSuppression définitive.`)
                && window.confirm('Dernière confirmation : tout sera effacé sur ce poste.')) {
                onPurger(() => ({ ...VIDE }));
              }
            }}
            className="w-full text-xs py-2" style={{ color: NON_ACQUIS }}>
            Effacer toutes les données consolidées
          </button>
        </div>
      </Card>

      {/* Apparence ici et non dans le rail : son pied porte déjà trois
          pastilles de 32px, et à 64px de large en mode replié une quatrième
          déborde du cadre (voir NavigationLaterale). Le mode clair/sombre y
          reste, c'est un geste fréquent ; la couleur se choisit une fois. */}
      <Card className="mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Palette size={16} style={{ color: INK_SOFT }} />
          <span className="text-sm font-semibold" style={{ fontFamily: F_DISPLAY }}>Apparence</span>
        </div>
        <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
          La couleur ne touche qu'à l'accent — boutons, sélection, ligne active de la navigation.
          Elle se combine avec le mode clair ou sombre, qui se règle depuis la navigation.
          Les couleurs des états d'acquisition et des intensités de crise ne changent jamais :
          elles portent du sens. Un document imprimé sort toujours en neutre.
        </p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button key={a.k} onClick={() => onAccent(a.k)}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
              style={{ borderColor: accent === a.k ? INK : BORDER, color: accent === a.k ? INK : INK_SOFT }}
              aria-pressed={accent === a.k}>
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: a.echantillon }} />
              {a.label}
            </button>
          ))}
        </div>
        {accent === 'rouge' && (
          <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
            Le rouge est aussi la couleur des crises et des actions destructrices : avec cet accent,
            un bouton principal ressemble à un bouton de suppression.
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-1.5 mb-2">
          <Lock size={16} style={{ color: INK_SOFT }} />
          <span className="text-sm font-semibold" style={{ fontFamily: F_DISPLAY }}>Sécurité</span>
        </div>
        {securite.disabled ? (
          <>
            <p className="text-xs mb-3" style={{ color: NON_ACQUIS }}>
              <strong>Protection désactivée.</strong> Les données consolidées ne sont plus chiffrées :
              quiconque accède à cet ordinateur peut les lire.
            </p>
            <Btn variant="outline" onClick={() => window.location.reload()} className="w-full text-sm">
              Réactiver une protection
            </Btn>
          </>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
              Mot de passe demandé à l'ouverture. Verrouillage à la mise en veille et après
              15 minutes d'inactivité. Les données consolidées sont chiffrées avec lui.
            </p>
            <Btn variant="outline" onClick={() => setChangement({ etape: 'ancien', ancien: '', nouveau: '' })} className="w-full text-sm mb-2">
              Modifier le mot de passe
            </Btn>
            <button
              onClick={() => {
                if (!window.confirm("Avez-vous une sauvegarde récente ?\n\nExportez vos données avant toute modification de la protection.\n\nOK pour continuer, Annuler pour aller sauvegarder.")) return;
                if (window.confirm("Retirer la protection ?\n\nLes données seront déchiffrées et enregistrées en clair sur cet ordinateur.")) onRetirerProtection();
              }}
              className="w-full text-xs py-2" style={{ color: NON_ACQUIS }}>
              Retirer la protection et le chiffrement
            </button>
          </>
        )}

        {changement && (
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: BORDER, backgroundColor: PAPER }}>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>
              {changement.etape === 'ancien' ? 'Mot de passe actuel' : 'Nouveau mot de passe'}
            </div>
            <input type="password" autoFocus
              value={changement.etape === 'ancien' ? changement.ancien : changement.nouveau}
              onChange={(e) => setChangement({ ...changement, [changement.etape === 'ancien' ? 'ancien' : 'nouveau']: e.target.value })}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent mb-2" style={{ borderColor: BORDER, color: INK }} />
            <div className="flex gap-2">
              <Btn onClick={async () => {
                if (changement.etape === 'ancien') {
                  const hash = await hashPin(changement.ancien, securite.pinSalt);
                  if (hash !== securite.pinHash) { notify('Mot de passe actuel incorrect'); return; }
                  setChangement({ ...changement, etape: 'nouveau' });
                  return;
                }
                if (changement.nouveau.length < 4) return;
                await onChangerMotDePasse(changement.nouveau);
                setChangement(null);
              }} className="flex-1 text-sm">
                {changement.etape === 'ancien' ? 'Vérifier' : 'Enregistrer'}
              </Btn>
              <Btn variant="ghost" onClick={() => setChangement(null)} className="text-sm">Annuler</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ==================== Écran d'erreur ====================
   Sans lui, une erreur de rendu laisse un écran blanc sans aucun message —
   ce qui a rendu le diagnostic d'un incident bien plus long qu'il n'aurait dû
   l'être. Reprend le principe déjà en place sur DatABA. */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const message = String((this.state.error && this.state.error.message) || this.state.error);
    const pile = (this.state.info && this.state.info.componentStack) || '';
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAPER, fontFamily: F_BODY }}>
        <div className="w-full max-w-md">
          <h1 className="text-lg font-semibold mb-2" style={{ fontFamily: F_DISPLAY, color: INK }}>Une erreur est survenue</h1>
          <p className="text-sm mb-3" style={{ color: INK_SOFT }}>
            Recopiez le message ci-dessous, il indique précisément l'origine du problème.
          </p>
          <pre className="text-xs rounded-xl p-3 mb-3 whitespace-pre-wrap" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: NON_ACQUIS, maxHeight: 240, overflowY: 'auto' }}>
            {message}
            {pile ? `\n${pile.split('\n').slice(0, 8).join('\n')}` : ''}
          </pre>
          <div className="flex gap-2">
            <Btn onClick={() => window.location.reload()} className="flex-1 text-sm">Recharger</Btn>
            <Btn
              variant="outline"
              onClick={() => {
                if (navigator.clipboard) navigator.clipboard.writeText(`${message}\n${pile}`);
              }}
              className="text-sm"
            >
              Copier
            </Btn>
          </div>
        </div>
      </div>
    );
  }
}

/* ==================== Application ==================== */
/* ==================== Navigation latérale ====================
   Remplace la rangée d'onglets et le balayage tactile : Manager est un poste
   assis, les sept destinations tiennent en permanence à l'écran. Repliable en
   rail d'icônes pour rendre la largeur au contenu (tableaux, graphiques,
   Explorer) quand elle sert peu. Marquée no-print entièrement : jamais dans
   un rapport ni dans une impression ciblée. */
/* Les sept destinations, dans l'ordre où elles apparaissent dans la
   navigation latérale — le même ordre sert aux raccourcis clavier 1-7,
   d'où la constante commune plutôt qu'une définition locale à chaque. */
const ONGLETS = [
  { k: 'bord', l: 'Tableau de bord', icone: LayoutDashboard },
  { k: 'seances', l: 'Séances', icone: CalendarDays },
  { k: 'personnes', l: 'Personnes accompagnées', icone: Users },
  { k: 'crises', l: 'Crises', icone: AlertTriangle },
  { k: 'explorer', l: 'Explorer', icone: Grid3x3 },
  { k: 'rapport', l: 'Rapport', icone: FileText },
  { k: 'gestion', l: 'Gestion', icone: Settings },
];

/* Palette de commande : ⌘K/Ctrl+K, aller à une personne au clavier. Seule
   fenêtre modale de Manager — d'où sa gestion à part plutôt qu'un état de
   plus dans un composant déjà chargé. */
function PaletteCommande({ donnees, onChoisir, onFermer }) {
  const [q, setQ] = useState('');
  const champRef = useRef(null);
  useEffect(() => { if (champRef.current) champRef.current.focus(); }, []);

  const norm = (s) => String(s || '').toLowerCase();
  const termes = norm(q);
  const resultats = donnees.personnes
    .filter((p) => norm(nomAffiche(donnees, p.initials)).includes(termes) || norm(p.initials).includes(termes))
    .slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 no-print"
      style={{ backgroundColor: OVERLAY_BACKDROP }} onClick={onFermer}>
      <div className="w-full max-w-md rounded-2xl border overflow-hidden shadow-lg"
        style={{ backgroundColor: CARD, borderColor: BORDER }} onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b" style={{ borderColor: BORDER }}>
          <input ref={champRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Aller à une personne…" autoComplete="off"
            className="w-full bg-transparent text-sm outline-none" style={{ color: INK, fontFamily: F_BODY }}
            onKeyDown={(e) => { if (e.key === 'Enter' && resultats[0]) onChoisir(resultats[0]); }} />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {resultats.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center" style={{ color: INK_SOFT }}>Aucune personne ne correspond.</div>
          ) : resultats.map((p) => (
            <button key={p.initials} onClick={() => onChoisir(p)}
              className="w-full text-left rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2">
              <span style={{ color: INK }}>{nomAffiche(donnees, p.initials)}</span>
              {nomClasseDe(donnees, p.initials) && (
                <span className="text-xs shrink-0" style={{ color: INK_SOFT }}>{nomClasseDe(donnees, p.initials)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="px-3 py-2 border-t text-xs" style={{ borderColor: BORDER, color: INK_SOFT }}>
          Entrée pour choisir · Échap pour fermer
        </div>
      </div>
    </div>
  );
}

function NavigationLaterale({ onglets, tab, setTab, theme, onBasculerTheme, donnees, replie, onReplier, densite, onDensite }) {
  const largeur = replie ? 64 : 236;
  return (
    <aside className="no-print shrink-0 sticky top-0 h-screen flex flex-col border-r overflow-hidden"
      style={{ width: largeur, borderColor: BORDER, backgroundColor: NAV_BG, transition: 'width .15s ease' }}>
      <div className="px-3 pt-4 pb-3">
        {replie ? (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ fontFamily: F_DISPLAY, backgroundColor: CARD, color: INK_SOFT }}>DM</div>
        ) : (
          /* Le fichier porte déjà la mention « MANAGER » (bandeau rouge sous
             le mot-symbole) : pas de libellé texte en plus en dessous, ce
             serait la répéter. Ratio 2078×930 (≈2.23), plus haut à largeur
             égale que l'ancien logo DatABA (≈4.5) — largeur resserrée en
             conséquence pour garder un en-tête de rail raisonnable. */
          <img src={`${import.meta.env.BASE_URL}logo-databamanager.png`} alt="DatABA Manager" className="w-full max-w-[150px] h-auto" />
        )}
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {onglets.map((t) => {
          const Icone = t.icone;
          const on = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} title={replie ? t.l : undefined}
              className="w-full rounded-lg px-2.5 py-2.5 text-sm font-medium flex items-center gap-2.5"
              style={{ fontFamily: F_DISPLAY, backgroundColor: on ? ACCENT_WASH : 'transparent', color: on ? ACCENT : INK_SOFT }}>
              <Icone size={17} className="shrink-0" />
              {!replie && <span className="truncate">{t.l}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-2 pb-3 pt-2 border-t" style={{ borderColor: BORDER }}>
        {!replie && (
          <>
            <div className="px-2 text-xs" style={{ color: INK_SOFT }}>
              {donnees.personnes.length} personne{donnees.personnes.length !== 1 ? 's' : ''} · {donnees.seances.length} séance{donnees.seances.length !== 1 ? 's' : ''}
            </div>
            {/* Raccourcis découvrables plutôt que secrets : la mention reste
                à l'écran en permanence, pas cachée dans un menu d'aide. */}
            <div className="px-2 pb-2 text-xs" style={{ color: INK_SOFT, opacity: 0.75 }} title="Ctrl/⌘+K : aller à une personne. 1-7 : changer d'onglet.">
              ⌘K une personne · 1-7 les onglets
            </div>
          </>
        )}
        {/* Trois pastilles de 32px : à plat elles dépassent les 64px du rail
            replié (overflow-hidden les coupe, et le bouton qui déplie —
            le dernier — sort du cadre en entier, rendant le rail inaccessible
            une fois refermé). Empilées, elles rentrent. */}
        <div className={replie ? 'flex flex-col items-center gap-1.5' : 'flex items-center gap-1.5 px-0.5'}>
          <button
            onClick={onBasculerTheme}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: CARD, color: INK_SOFT }}
            aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
            title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={() => onDensite((d) => (d === 'compact' ? 'confort' : 'compact'))}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: CARD, color: INK_SOFT }}
            aria-label={densite === 'compact' ? 'Densité confortable' : 'Densité compacte'}
            title={densite === 'compact' ? 'Affichage confortable' : 'Affichage compact'}
          >
            {densite === 'compact' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={() => onReplier((r) => !r)}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: CARD, color: INK_SOFT }}
            aria-label={replie ? 'Déplier la navigation' : 'Replier la navigation'}
            title={replie ? 'Déplier' : 'Replier'}
          >
            {replie ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

function ManagerApp() {
  /* Thème clair/sombre. Posé une première fois par le script bloquant de
     index.html (attribut data-theme sur <html>, avant le premier rendu) ;
     l'état ici ne fait que le lire et le faire suivre au bouton. Préférence
     non sensible : clé aba-cadre: en clair, hors du chiffrement — même
     logique que côté DatABA. */
  const [theme, setThemeState] = useState(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });
  const basculerTheme = () => {
    setThemeState((t) => {
      const suivant = t === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', suivant);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', suivant === 'dark' ? '#0A1120' : '#F3F6FB');
      try { window.localStorage.setItem(`${PREFIXE}theme`, suivant); } catch (e) {}
      return suivant;
    });
  };
  /* Couleur d'accent, second axe indépendant du mode clair/sombre : elle ne
     touche qu'à `--accent`, `--accent-ink` et `--accent-wash` (voir
     src/index.css). 'neutre' retire l'attribut plutôt que d'en poser un —
     c'est l'absence de `data-accent` qui vaut défaut, pas une valeur. */
  const [accent, setAccentState] = useState(() => {
    if (typeof document === 'undefined') return 'neutre';
    return document.documentElement.getAttribute('data-accent') || 'neutre';
  });
  const choisirAccent = (k) => {
    if (k === 'neutre') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', k);
    try { window.localStorage.setItem(`${PREFIXE}accent`, k); } catch (e) {}
    setAccentState(k);
  };
  const [donnees, setDonnees] = useState(VIDE);
  const [loaded, setLoaded] = useState(false);
  /* État de la dernière écriture du bloc consolidé. Un échec ne s'avale
     plus : il barre l'écran tant qu'il dure, parce qu'un poste qui
     n'enregistre pas ressemble en tout point à un poste qui enregistre
     jusqu'au moment où l'on ferme l'application. */
  const [etatStockage, setEtatStockage] = useState(null);
  /* Lecture ratée sur un bloc existant : l'écriture est suspendue pour ne
     pas écraser des données peut-être encore intactes. */
  const [blocIllisible, setBlocIllisible] = useState(null);
  const [persistant, setPersistant] = useState(null);
  const [securite, setSecurite] = useState({ pinHash: null, pinSalt: null });
  const [secuLue, setSecuLue] = useState(false);
  const [verrouille, setVerrouille] = useState(true);
  const [tab, setTab] = useState('bord');
  /* Navigation latérale repliée en rail d'icônes. Choix de lecture, pas de
     donnée : jamais persisté, jamais dans le bloc chiffré. */
  const [railReplie, setRailReplie] = useState(false);
  /* Palette de commande : ⌘K/Ctrl+K pour aller à une personne sans passer
     par la souris. Seule fenêtre modale de Manager — Échap la ferme. */
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  /* Densité d'affichage : confort (défaut) ou compact. Un cadre balaie des
     dizaines de séances, il ne cote pas dans l'urgence — le compromis
     tablette (cibles tactiles larges) ne s'impose pas ici. Choix de
     lecture, jamais persisté. */
  const [densite, setDensite] = useState('confort');
  const [toast, setToast] = useState('');
  const [logo, setLogo] = useState(null);
  const [association, setAssociation] = useState('');
  const [periode, setPeriode] = useState(periodeVide());
  /* Réglages d'écran qui doivent survivre à un changement d'onglet : les sept
     onglets sont montés conditionnellement, un useState posé dans l'écran
     repart de sa valeur initiale à chaque retour. Choix de lecture, jamais
     persistés ni chiffrés — comme `periode` juste au-dessus. */
  const [uniteBord, setUniteBord] = useState('nombre');
  const [configCrises, setConfigCrises] = useState(configCriseVide());
  /* Réglages de graphique — style de tracé et lectures superposées. Deux jeux
     séparés : la fiche personne et le document du rapport ont toujours eu des
     choix indépendants, les fusionner ferait suivre au document ce qu'on
     regarde à l'écran. */
  const [graphePersonnes, setGraphePersonnes] = useState({ style: 'ligne', courbes: [] });
  const [grapheRapport, setGrapheRapport] = useState({ style: 'ligne', courbes: [] });
  /* Contexte de lecture partagé par les écrans d'analyse : qui on regarde, et
     dans quelle classe. La personne était choisie séparément dans trois états
     sans rapport (la liste de la fiche, les pastilles de Crises, le sujet du
     rapport) et n'existait pas du tout sur Séances ni Explorer : arriver sur un
     écran par le rail latéral ne reportait rien.
     `selectionRapport.personne` reste à part, délibérément : ce n'est pas un
     filtre de lecture mais le sujet d'un document, enregistré dans
     `donnees.rapports` et restauré par `ouvrirRapport`. Le fusionner ferait
     qu'ouvrir un rapport enregistré repointerait toute l'application, et que
     changer de personne ici orphelinerait ses objectifs retenus. Le lien reste
     unidirectionnel, par `lancerRapport`.
     Choix de lecture, jamais persisté — et pour celui-ci la règle est plus
     qu'une convention : les initiales sont la seule donnée nominative du
     produit, elles n'ont pas à sortir du bloc chiffré pour économiser un clic. */
  const [contexte, setContexte] = useState({ personne: null, classe: '' });
  /* Ne garde plus que l'objectif à déplier et vers lequel défiler : la personne
     vit dans `contexte`. */
  const [focus, setFocus] = useState(null);
  const [selectionRapport, setSelectionRapport] = useState({ personne: null, objectifs: [], periode: periodeVide(), bilanCrises: null });
  /* Réglages d'écran remontés ici pour la même raison que `uniteBord` : les
     sept onglets sont montés conditionnellement, et un useState posé dans
     l'écran repart de sa valeur initiale à chaque retour. Vérifier un accord
     inter-observateurs, aller lire une fiche et revenir imposait de refaire la
     recherche, le tri, les déplis et le choix de la paire ; un aller-retour
     depuis Explorer reperdait les trois menus du croisement. */
  const [vueSeances, setVueSeances] = useState({ recherche: '', tri: 'jour', toutes: false, groupesOuverts: [], ouverte: null, paire: null });
  const [vuePersonne, setVuePersonne] = useState('objectifs');
  const [croisement, setCroisement] = useState({ ligne: 'personne', colonne: 'semaine', mesure: 'autonomie' });
  /* Composition d'un bilan de crise en cours, déclenchée depuis le rapport.
     Le jeton force la reprise des réglages à chaque nouvelle demande, même si
     la configuration est identique à la précédente. */
  const [compositionBilan, setCompositionBilan] = useState(null);

  /* Le calcul ne dépend que des données analytiques. Sans cette séparation,
     taper une lettre dans un commentaire de rapport relançait l'analyse de
     tous les objectifs de tout le monde. */
  const lignes = useMemo(
    () => construireLignes(donnees),
    [donnees.seances, donnees.personnes, donnees.sources, donnees._idVersInitiales,
      donnees.suivi, donnees.stabilite, donnees._axesSuivi, donnees._compteurs, donnees._guidances,
      donnees.objectifsSuivi]
  );



  function notify(m) {
    setToast(m);
    setTimeout(() => setToast(''), 3500);
  }

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(SECU_KEY);
      if (brut) setSecurite(JSON.parse(brut));
      setLogo(window.localStorage.getItem(`${PREFIXE}logo`) || null);
      setAssociation(window.localStorage.getItem(`${PREFIXE}association`) || '');
    } catch (e) { /* réglages illisibles */ }
    setSecuLue(true);
    demanderStockagePersistant().then(setPersistant);
  }, []);

  function ecrireSecurite(s) {
    setSecurite(s);
    try { window.localStorage.setItem(SECU_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* Point d'entrée unique du chargement : les trois chemins (déverrouillage,
     protection retirée, création du mot de passe) doivent traiter le cas
     'illisible' de la même façon, sinon l'un d'eux réintroduit l'écrasement
     du bloc par un état vide. */
  async function chargerDansEtat() {
    const r = await chargerDonnees();
    setDonnees(r.donnees);
    setBlocIllisible(r.etat === 'illisible' ? r : null);
    setLoaded(true);
  }

  async function deverrouiller(motDePasse) {
    let sec = securite;
    if (!sec.dataSalt) { sec = { ...sec, dataSalt: newSalt() }; ecrireSecurite(sec); }
    if (sec.failedAttempts || sec.lockUntil) { sec = { ...sec, failedAttempts: 0, lockUntil: 0 }; ecrireSecurite(sec); }
    dataKey = await deriveDataKey(motDePasse, sec.dataSalt);
    setVerrouille(false);
    await chargerDansEtat();
  }

  /* Protection retirée : les données repassent en clair, aucun verrouillage */
  useEffect(() => {
    if (!secuLue || loaded || !securite.disabled) return;
    dataKey = null;
    setVerrouille(false);
    chargerDansEtat();
  }, [secuLue, securite.disabled, loaded]);

  useEffect(() => {
    if (!loaded || blocIllisible) return undefined;
    let annule = false;
    sauverDonnees(donnees).then((r) => { if (!annule) setEtatStockage(r); });
    return () => { annule = true; };
  }, [donnees, loaded, blocIllisible]);

  useEffect(() => {
    if (!securite.pinHash || verrouille || securite.disabled) return undefined;
    let minuteur = null;
    /* Instant du passage en arrière-plan, hors état React : consulté au
       retour seulement, pas de rendu à provoquer pour une simple bascule
       d'onglet. */
    let partiA = null;
    const relancer = () => { clearTimeout(minuteur); minuteur = setTimeout(() => setVerrouille(true), DELAI_VERROUILLAGE); };
    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') {
        partiA = Date.now();
        return;
      }
      // De retour sur l'onglet : verrouiller seulement si l'absence a dépassé
      // le délai, sinon la session reprend et le compte à rebours repart.
      if (doitVerrouillerAuRetour(partiA, Date.now(), DELAI_VERROUILLAGE)) setVerrouille(true);
      else relancer();
      partiA = null;
    };
    document.addEventListener('visibilitychange', surVisibilite);
    // wheel en plus : lire un long rapport à la molette ne doit pas verrouiller.
    ['mousedown', 'keydown', 'touchstart', 'wheel'].forEach((e) => document.addEventListener(e, relancer, { passive: true }));
    relancer();
    return () => {
      clearTimeout(minuteur);
      document.removeEventListener('visibilitychange', surVisibilite);
      ['mousedown', 'keydown', 'touchstart', 'wheel'].forEach((e) => document.removeEventListener(e, relancer));
    };
  }, [securite.pinHash, securite.disabled, verrouille]);

  /* Raccourcis clavier : 1-7 pour les onglets, ⌘K/Ctrl+K pour aller à une
     personne, Échap pour fermer la palette. Inactifs pendant une saisie
     (champ de texte, liste déroulante) — sans quoi taper un commentaire
     changerait d'onglet à chaque chiffre. */
  useEffect(() => {
    const surTouche = (e) => {
      const cible = e.target;
      const saisie = cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.tagName === 'SELECT' || cible.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte(true);
        return;
      }
      if (e.key === 'Escape' && paletteOuverte) {
        setPaletteOuverte(false);
        return;
      }
      if (saisie || paletteOuverte || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= ONGLETS.length) setTab(ONGLETS[n - 1].k);
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [paletteOuverte]);

  async function changerMotDePasse(nouveau) {
    const pinSalt = newSalt();
    const dataSalt = newSalt();
    const pinHash = await hashPin(nouveau, pinSalt);
    ecrireSecurite({ ...securite, disabled: false, pinHash, pinSalt, dataSalt, failedAttempts: 0, lockUntil: 0 });
    dataKey = await deriveDataKey(nouveau, dataSalt);
    const r = await sauverDonnees(donnees); // rechiffrées avec la nouvelle clé
    setEtatStockage(r);
    notify(r.ok ? 'Mot de passe modifié' : "Mot de passe modifié, mais l'enregistrement a échoué");
  }

  /* Le bloc repasse en clair par la même écriture vérifiée que les autres :
     l'ancien `setItem` direct sautait le repli IndexedDB et le contrôle de
     relecture, si bien que retirer la protection sur un bloc trop gros pour
     localStorage perdait tout en silence. */
  async function retirerProtection() {
    dataKey = null;
    const r = await sauverDonnees(donnees);
    setEtatStockage(r);
    ecrireSecurite({ disabled: true, pinHash: null, pinSalt: null, dataSalt: null, failedAttempts: 0, lockUntil: 0 });
    setVerrouille(false);
    notify(r.ok ? 'Protection retirée, données déchiffrées' : "Protection retirée, mais l'enregistrement a échoué");
  }

  function enregistrerLogo(v) {
    setLogo(v);
    try {
      if (v) window.localStorage.setItem(`${PREFIXE}logo`, v);
      else window.localStorage.removeItem(`${PREFIXE}logo`);
    } catch (e) { /* image trop volumineuse pour le stockage */ }
  }
  function enregistrerAssociation(v) {
    setAssociation(v);
    try { window.localStorage.setItem(`${PREFIXE}association`, v); } catch (e) {}
  }
  function majAlias(categorie, cle, valeur) {
    setDonnees((d) => ({ ...d, alias: { ...d.alias, [categorie]: { ...(d.alias[categorie] || {}), [cle]: valeur } } }));
  }
  function majCommentaire(cle, valeur) {
    setDonnees((d) => ({ ...d, commentaires: { ...(d.commentaires || {}), [cle]: valeur } }));
  }
  /* Le code est saisi une fois et vaut pour toutes les personnes qui
     travaillent cet objectif : la clé est le nom de l'objectif, pas le couple. */
  function majCodeEfl(objectif, valeur) {
    setDonnees((d) => ({ ...d, codesEfl: { ...(d.codesEfl || {}), [objectif]: valeur } }));
  }
  /* Réglage « compte comme un objectif » d'un critère de suivi ou d'un
     compteur : `cle` est déjà préfixée des initiales (voir cleObjectifSuivi),
     même patron que majCommentaire. */
  function majObjectifSuivi(cle, valeur) {
    setDonnees((d) => ({ ...d, objectifsSuivi: { ...(d.objectifsSuivi || {}), [cle]: valeur } }));
  }

  /* Toute purge passe par ici : un seul point d'écriture, un seul message. */
  function purger(transformer) {
    setDonnees((d) => {
      const suite = transformer(d);
      return {
        ...suite,
        nbNouvellesSeances: undefined, nbNouvellesCrises: undefined, nbNouveauxReleves: undefined,
        nbSeancesMisesAJour: undefined, nbCrisesMisesAJour: undefined, nbRelevesMisAJour: undefined,
        collisionsInitiales: undefined,
      };
    });
    notify('Données purgées');
  }

  function onImported(fusion) {
    setDonnees(fusion);
    if (fusion.nbNouvellesSeances != null) {
      /* Les mises à jour se disent à part des ajouts : réimporter un fichier
         complété n'apporte parfois aucun enregistrement neuf, seulement des
         corrections sur des enregistrements déjà là. Sans ce second compte, le
         message annonçait « 0 nouvelle » — indiscernable d'un import qui n'a
         effectivement rien apporté. */
      const majs = (fusion.nbSeancesMisesAJour || 0) + (fusion.nbCrisesMisesAJour || 0) + (fusion.nbRelevesMisAJour || 0);
      notify(
        `${fusion.nbNouvellesSeances} nouvelle(s) séance(s), ${fusion.nbNouvellesCrises} nouvelle(s) crise(s)`
        + (fusion.nbNouveauxReleves ? `, ${fusion.nbNouveauxReleves} relevé(s) de suivi continu` : '')
        + (majs ? ` · ${majs} enregistrement(s) mis à jour` : '')
        /* Deux personnes de classes différentes, mêmes initiales : la fusion
           les a réunies en une seule sans pouvoir les distinguer. Signalé
           plutôt que résolu — voir fusionnerImport. */
        + (fusion.collisionsInitiales ? ` · ⚠ ${fusion.collisionsInitiales} collision(s) d'initiales entre classes, à vérifier` : '')
      );
    }
    /* Le tableau de bord ne sait rien montrer sans séance : un import de
       relevés de suivi seuls y annonçait « N relevés » puis affichait
       « Importez une sauvegarde ». On atterrit là où les données importées se
       voient réellement. */
    setTab(fusion.seances.length ? 'bord' : 'personnes');
  }
  /* Point d'entrée unique vers une fiche : il écrit la personne dans le
     contexte partagé (donc tous les écrans la suivent) et garde `focus` pour
     le seul objectif à déplier et vers lequel défiler. */
  function ouvrirPersonne(initiales, objectif) {
    setContexte((c) => ({ ...c, personne: initiales }));
    setFocus({ initiales, objectif });
    setTab('personnes');
  }

  /* Retrait d'une séance consolidée. On ne touche qu'à cette application :
     la séance reste intacte sur la tablette, et un nouvel import la
     ramènerait — c'est dit dans la confirmation pour éviter la surprise. */
  function supprimerSeance(seance) {
    const table = (donnees._idVersInitiales || {})[seance.source] || {};
    const qui = (seance.studentIds || []).map((sid) => table[sid]).filter(Boolean).join(', ');
    const ok = window.confirm(
      `Retirer cette séance de l'analyse ?\n\n`
      + `${new Date(seance.date).toLocaleDateString('fr-FR')} · ${seance.source}`
      + `${qui ? `\nPersonnes : ${qui}` : ''}\n\n`
      + `Elle disparaîtra des graphiques et des rapports de ce poste. La séance reste `
      + `sur la tablette : si vous réimportez une sauvegarde qui la contient, elle reviendra.`
    );
    if (!ok) return;
    setDonnees((d) => ({ ...d, seances: d.seances.filter((s) => s.id !== seance.id) }));
    notify('Séance retirée de l’analyse');
  }
  function lancerRapport(personne, objectifs) {
    setSelectionRapport({ personne, objectifs, periode, bilanCrises: null });
    setTab('rapport');
  }
  /* Rapport centré sur les crises : aucun objectif retenu, on part directement
     composer le bilan. */
  function lancerRapportCrises(personne) {
    setSelectionRapport({ personne, objectifs: [], periode, bilanCrises: null });
    composerBilan(personne);
  }

  /* Aller composer un bilan dans l'onglet Crises, puis revenir au rapport. */
  function composerBilan(personne) {
    setCompositionBilan({
      personne,
      config: selectionRapport.bilanCrises || { ...configCriseVide(), personnes: [personne] },
      jeton: Date.now(),
    });
    setTab('crises');
  }
  function validerBilan(config) {
    setSelectionRapport((sel) => ({ ...sel, bilanCrises: config }));
    setCompositionBilan(null);
    setTab('rapport');
    notify('Bilan des crises joint au rapport');
  }
  function annulerBilan() {
    setCompositionBilan(null);
    setTab('rapport');
  }

  /* Joindre directement depuis l'onglet Crises, sans être parti du rapport.
     Contrairement à validerBilan (qui ne touche que bilanCrises, la personne
     et la période du rapport étant déjà celles réglées avant de composer),
     ici rien n'est réglé côté rapport : il faut reporter la personne du
     filtre ET la période de l'écran Crises — BilanCrises se rend avec
     selection.periode, pas avec celle de l'écran, un bilan qui ne reprendrait
     que la config referrait sur une autre fenêtre et pourrait sortir vide. */
  function joindreBilanAuRapport(config) {
    const cible = (config.personnes || [])[0] || null;
    if (!cible) return;
    setSelectionRapport((sel) => ({
      ...sel,
      personne: cible,
      objectifs: sel.personne === cible ? (sel.objectifs || []) : [],
      periode,
      bilanCrises: config,
    }));
    setTab('rapport');
    notify('Bilan des crises joint au rapport');
  }

  /* Enregistrement d'un rapport. Réenregistrer sous un nom déjà pris écrase
     l'existant : c'est ce qu'on attend quand on revient corriger un document,
     et cela évite de collectionner des doublons homonymes. */
  function enregistrerRapport(nom) {
    const titre = String(nom || '').trim();
    if (!titre) return;
    const entree = {
      id: `${Date.now()}`,
      nom: titre,
      majLe: new Date().toISOString(),
      personne: selectionRapport.personne,
      objectifs: selectionRapport.objectifs || [],
      periode: selectionRapport.periode,
      bilanCrises: selectionRapport.bilanCrises || null,
    };
    setDonnees((d) => {
      const autres = (d.rapports || []).filter((r) => r.nom !== titre);
      return { ...d, rapports: [entree, ...autres] };
    });
    notify(`Rapport « ${titre} » enregistré`);
  }
  function ouvrirRapport(r) {
    setSelectionRapport({
      personne: r.personne,
      objectifs: r.objectifs || [],
      periode: r.periode || periodeVide(),
      bilanCrises: r.bilanCrises || null,
    });
    setTab('rapport');
  }
  function supprimerRapport(r) {
    if (!window.confirm(`Supprimer le rapport « ${r.nom} » ?\n\nSeule sa composition est effacée : aucune donnée de suivi n'est touchée.`)) return;
    setDonnees((d) => ({ ...d, rapports: (d.rapports || []).filter((x) => x.id !== r.id) }));
    notify('Rapport supprimé');
  }
  /* Aller à l'écran Crises sur une personne. Il n'y a plus de jeton à
     consommer ni d'effet dans l'écran : la personne vit dans le contexte
     partagé, et seul le type d'enregistrement affiché reste à poser — venir
     de la vue Crises d'une fiche veut dire « les crises », pas les
     observations. `initiales` à null = toutes les personnes. */
  function ouvrirCrises(initiales) {
    setContexte((c) => ({ ...c, personne: initiales || null }));
    setConfigCrises((c) => ({ ...c, type: 'crise' }));
    setTab('crises');
  }

  if (!secuLue) return <div className="min-h-screen flex items-center justify-center" style={{ background: PAPER }}>Chargement…</div>;

  if (!securite.disabled && (verrouille || !securite.pinHash)) {
    return (
      <LockScreen
        security={securite}
        onUnlock={deverrouiller}
        onFailedAttempt={(failedAttempts, lockUntil) => ecrireSecurite({ ...securite, failedAttempts, lockUntil })}
        onSetup={async (pinHash, pinSalt, motDePasse) => {
          const dataSalt = newSalt();
          ecrireSecurite({ pinHash, pinSalt, dataSalt, failedAttempts: 0, lockUntil: 0 });
          dataKey = await deriveDataKey(motDePasse, dataSalt);
          setVerrouille(false);
          await chargerDansEtat();
        }}
      />
    );
  }

  if (!loaded) return <div className="min-h-screen flex items-center justify-center" style={{ background: PAPER }}>Chargement…</div>;

  /* Un bloc existe mais n'a pas pu être lu. Écran bloquant, et non bandeau :
     l'application n'a rien à montrer, et laisser entrer dans une interface
     vide invite à réimporter par-dessus des données qui sont peut-être
     encore là. Rien n'est écrit tant que ce choix n'est pas fait. */
  if (blocIllisible) return <EcranBlocIllisible etat={blocIllisible} securite={securite} />;

  /* Construit une seule fois et passé aux cinq écrans de lecture, qui l'insèrent
     dans la bande collante de leur sélecteur de période. Un seul nœud plutôt
     qu'un composant monté cinq fois : les cinq portent le même contexte, et un
     second bloc dans la structure de page serait le risque de régression n°1 à
     l'impression. */
  const bandeauContexte = donnees.personnes.length ? (
    <BandeauContexte donnees={donnees} contexte={contexte} setContexte={setContexte}
      onPalette={() => setPaletteOuverte(true)} />
  ) : null;

  return (
    <div className="min-h-screen flex" style={{ background: PAPER, color: INK, fontFamily: F_BODY }}>
      <NavigationLaterale onglets={ONGLETS} tab={tab} setTab={setTab}
        theme={theme} onBasculerTheme={basculerTheme} donnees={donnees}
        replie={railReplie} onReplier={setRailReplie}
        densite={densite} onDensite={setDensite} />
      <div className="flex-1 min-w-0 px-6 py-6 lg:px-8">
        {/* Hors du bloc `no-print` des écrans, mais lui-même `no-print` :
            l'onglet Rapport s'imprime en pleine page et sort de ce bloc, un
            bandeau posé dedans y serait invisible. */}
        <BandeauStockage etat={etatStockage} />
        <div className="no-print">
          {tab === 'bord' && (
            <>
              <SectionTitle sub="L'avancée récente, d'un coup d'œil." icone={LayoutDashboard}>Tableau de bord</SectionTitle>
              <TableauDeBord donnees={donnees} lignes={lignes} periode={periode} setPeriode={setPeriode}
                unite={uniteBord} setUnite={setUniteBord}
                contexte={contexte} bandeau={bandeauContexte}
                onOuvrirPersonne={ouvrirPersonne} onOuvrirCrises={() => ouvrirCrises(null)} />
            </>
          )}
          {tab === 'seances' && (
            <>
              <SectionTitle sub="Consulter ce qui a été importé, et vérifier l'accord entre observateurs." icone={CalendarDays}>Séances</SectionTitle>
              <SeancesScreen donnees={donnees} onSupprimerSeance={supprimerSeance} densite={densite}
                vue={vueSeances} setVue={setVueSeances}
                periode={periode} setPeriode={setPeriode}
                contexte={contexte} bandeau={bandeauContexte}
                onOuvrirPersonne={ouvrirPersonne} />
            </>
          )}
          {tab === 'personnes' && (
            <>
              <SectionTitle sub="Le suivi complet, personne par personne." icone={Users}>Personnes accompagnées</SectionTitle>
              <PersonnesScreen donnees={donnees} lignes={lignes} focus={focus} setFocus={setFocus}
                contexte={contexte} setContexte={setContexte} bandeau={bandeauContexte}
                periode={periode} setPeriode={setPeriode}
                vue={vuePersonne} setVue={setVuePersonne}
                graphe={graphePersonnes} setGraphe={setGraphePersonnes}
                onRapport={lancerRapport}
                onRapportCrises={lancerRapportCrises} onOuvrirCrises={ouvrirCrises}
                onObjectifSuivi={majObjectifSuivi} />
            </>
          )}
          {tab === 'crises' && (
            <>
              <SectionTitle icone={AlertTriangle} sub="Ce qui déclenche, ce qui se produit, ce qui suit.">Crises</SectionTitle>
              <CrisesScreen donnees={donnees} periode={periode} setPeriode={setPeriode}
                config={configCrises} setConfig={setConfigCrises}
                contexte={contexte} setContexte={setContexte} bandeau={bandeauContexte}
                composition={compositionBilan} onValiderBilan={validerBilan} onAnnulerBilan={annulerBilan}
                rapportEnCours={selectionRapport} onJoindreAuRapport={joindreBilanAuRapport} />
            </>
          )}
          {tab === 'explorer' && (
            <>
              <SectionTitle icone={Grid3x3} sub="Croiser librement deux axes, comme un tableau croisé dynamique.">Explorer</SectionTitle>
              <ExplorerScreen donnees={donnees} lignes={lignes} periode={periode} setPeriode={setPeriode}
                croisement={croisement} setCroisement={setCroisement} bandeau={bandeauContexte}
                onOuvrirPersonne={ouvrirPersonne} />
            </>
          )}
          {tab === 'gestion' && (
            <>
              <SectionTitle sub="Import, export, apparence et sécurité." icone={Settings}>Gestion</SectionTitle>
              <GestionScreen donnees={donnees} securite={securite}
                accent={accent} onAccent={choisirAccent} onImported={onImported}
                onChangerMotDePasse={changerMotDePasse} onRetirerProtection={retirerProtection}
                onPurger={purger} notify={notify}
                etatStockage={etatStockage} persistant={persistant} />
            </>
          )}
        </div>

        {tab === 'rapport' && (
          <>
            <div className="no-print"><SectionTitle sub="Le document à transmettre ou à déposer dans Airmes." icone={FileText}>Rapport</SectionTitle></div>
            <RapportScreen donnees={donnees} lignes={lignes}
              selection={selectionRapport} setSelection={setSelectionRapport}
              logo={logo} association={association}
              graphe={grapheRapport} setGraphe={setGrapheRapport}
              onLogo={enregistrerLogo} onAssociation={enregistrerAssociation}
              onAlias={majAlias} onCommentaire={majCommentaire} onCodeEfl={majCodeEfl}
              onComposerBilan={composerBilan}
              onEnregistrer={enregistrerRapport} onOuvrirRapport={ouvrirRapport}
              onSupprimerRapport={supprimerRapport} />
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm shadow-lg no-print" style={{ backgroundColor: ACCENT, color: ACCENT_INK }}>
          {toast}
        </div>
      )}

      {paletteOuverte && (
        <PaletteCommande donnees={donnees}
          onChoisir={(p) => { ouvrirPersonne(p.initials, null); setPaletteOuverte(false); }}
          onFermer={() => setPaletteOuverte(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ManagerApp />
    </ErrorBoundary>
  );
}
