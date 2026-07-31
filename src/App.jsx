import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, CalendarDays, Users, FileText, Settings,
  Lock, Download, Upload, TrendingUp, AlertTriangle, Target, Trash2, Gift,
  Radar as RadarIcon, Activity, Table2, Printer, X, Check, Grid3x3,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  CartesianGrid, Legend,
} from 'recharts';

/* ==================== Identité visuelle ====================
   Reprise de DatABA, avec le bleu en couleur d'accent pour distinguer les
   deux applications au premier coup d'œil. */
const PAPER = '#FAF7F0';
const CARD = '#FFFFFF';
const INK = '#1A345C';
const INK_SOFT = '#6B7280';
const BORDER = '#E3DDD0';
const ACQUIS = '#0F8B6C';
const EN_COURS = '#D69A2D';
const NON_ACQUIS = '#A8402F';
const CRISE = '#A8402F';
const F_DISPLAY = "'Space Grotesk', sans-serif";
const F_BODY = "'IBM Plex Sans', sans-serif";
const F_MONO = "'IBM Plex Mono', monospace";

const ETATS = {
  acquis: { label: 'Acquis', court: 'Acquis', color: ACQUIS },
  bientot: { label: 'Bientôt acquis', court: 'Bientôt', color: '#3F9E7C' },
  plateau: { label: 'En plateau', court: 'Plateau', color: EN_COURS },
  en_cours: { label: "En cours d'acquisition", court: 'En cours', color: '#5B8AC4' },
  dormant: { label: 'Sans cotation récente', court: 'Dormant', color: INK_SOFT },
  /* Suivi en mesure brute (occurrences, minutes, latence) : aucun seuil
     d'acquisition en pourcentage ne s'y applique. */
  mesure: { label: 'Suivi en mesure', court: 'Mesure', color: '#7A6FA8' },
  non_acquis: { label: 'Non acquis', court: 'Non acquis', color: NON_ACQUIS },
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

/* Intensité ressentie, telle que saisie dans DatABA */
const INTENSITES = {
  1: { label: 'Légère', color: '#7A9A3A' },
  2: { label: 'Modérée', color: '#D69A2D' },
  3: { label: 'Forte', color: '#A8402F' },
};

const PLATEAU_MIN_POINTS = 6;
const PLATEAU_ECART_MAX = 20;
const DORMANT_JOURS = 21;

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
  personnes: [], seances: [], crises: [], sources: [],
  _idVersInitiales: {}, _ateliers: {}, _intervenants: {}, alias: { personnes: {}, objectifs: {} }, commentaires: {},
  /* Code du référentiel (EFL) attaché à l'objectif lui-même, et non au couple
     personne-objectif : une même compétence garde son code quelle que soit la
     personne qui la travaille. La clé est donc le nom de l'objectif. */
  codesEfl: {},
  /* Rapports enregistrés : uniquement leur composition — personne, période,
     objectifs retenus, réglages du bilan de crise. Les commentaires et les
     libellés vivent déjà à part et suivent d'eux-mêmes, si bien qu'un rapport
     rouvert reflète les cotations les plus récentes plutôt qu'un figé. */
  rapports: [],
};

function normaliser(d) {
  return {
    ...VIDE,
    ...d,
    alias: { personnes: {}, objectifs: {}, ...(d.alias || {}) },
    commentaires: d.commentaires || {},
    codesEfl: d.codesEfl || {},
    rapports: d.rapports || [],
  };
}
async function chargerDonnees() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return VIDE;
    const texte = dataKey ? await decryptValue(raw, dataKey) : raw;
    return normaliser(JSON.parse(texte));
  } catch (e) {
    return VIDE;
  }
}
async function sauverDonnees(d) {
  try {
    const texte = JSON.stringify(d);
    window.localStorage.setItem(STORE_KEY, dataKey ? await encryptValue(texte, dataKey) : texte);
  } catch (e) { /* écriture impossible : l'usage n'est pas interrompu */ }
}
function effacerDonneesManager() {
  try {
    const cles = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIXE)) cles.push(k);
    }
    cles.forEach((k) => window.localStorage.removeItem(k));
  } catch (e) { /* stockage indisponible */ }
}

/* ==================== Import et fusion ==================== */
function fusionnerImport(actuel, backup, nomSource) {
  const personnes = actuel.personnes.slice();
  const parInitiales = new Map(personnes.map((p) => [p.initials, p]));
  (backup.students || []).forEach((s) => {
    if (!parInitiales.has(s.initials)) {
      const p = { id: s.id, initials: s.initials };
      personnes.push(p);
      parInitiales.set(s.initials, p);
    }
  });

  const idVersInitiales = Object.fromEntries((backup.students || []).map((s) => [s.id, s.initials]));
  const ateliersSource = Object.fromEntries((backup.ateliers || []).map((a) => [a.id, a.name]));
  const intervenantsSource = Object.fromEntries((backup.intervenants || []).map((i) => [i.id, i.name]));

  const dejaLa = new Set(actuel.seances.map((s) => s.id));
  const nouvelles = (backup.sessions || []).filter((s) => !dejaLa.has(s.id));
  const seances = [
    ...actuel.seances.filter((s) => !nouvelles.some((n) => n.id === s.id)),
    ...nouvelles,
  ].map((s) => ({ ...s, source: s.source || nomSource }));

  const crisesLa = new Set(actuel.crises.map((c) => c.id));
  const nouvellesCrises = (backup.crises || []).filter((c) => !crisesLa.has(c.id));
  const crises = [...actuel.crises, ...nouvellesCrises].map((c) => ({ ...c, source: c.source || nomSource }));

  return {
    ...actuel,
    personnes,
    seances,
    crises,
    sources: actuel.sources.includes(nomSource) ? actuel.sources : [...actuel.sources, nomSource],
    _idVersInitiales: { ...(actuel._idVersInitiales || {}), [nomSource]: idVersInitiales },
    _ateliers: { ...(actuel._ateliers || {}), [nomSource]: ateliersSource },
    _intervenants: { ...(actuel._intervenants || {}), [nomSource]: intervenantsSource },
    nbNouvellesSeances: nouvelles.length,
    nbNouvellesCrises: nouvellesCrises.length,
  };
}

function idPourSource(donnees, source, initiales) {
  const t = (donnees._idVersInitiales || {})[source] || {};
  return Object.keys(t).find((id) => t[id] === initiales) || null;
}

/* ==================== Calcul des scores ==================== */
function objectiveScoreValue(obj, entry) {
  if (!obj || !entry) return null;
  const gList = (obj.config && obj.config.guidanceSet) || [];
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

function critereDe(obj) {
  const m = obj.config && obj.config.mastery;
  return m ? { threshold: m.threshold || 80, needed: m.sessions || 3 } : null;
}

function analyserObjectif(seances, tableParSource, obj) {
  const points = [];
  const mesures = [];
  let unite = null;
  seances.forEach((sess) => {
    const sid = tableParSource[sess.source];
    if (!sid) return;
    const oid = Object.keys(sess.objectiveSnapshot || {}).find((k) => sess.objectiveSnapshot[k].name === obj.name);
    if (!oid || !((sess.selectedObjectives || {})[sid] || []).includes(oid)) return;
    const entry = (sess.data || {})[sid] && sess.data[sid][oid];
    const snap = sess.objectiveSnapshot[oid];
    const v = objectiveScoreValue(snap, entry);
    if (v != null) points.push({ date: sess.date, value: v, favorite: !!snap.favorite });

    /* Les mesures brutes vivent à part des points en pourcentage. Les mélanger
       fausserait toutes les moyennes d'autonomie du reste de l'application :
       un compteur d'occurrences à 12 n'est pas un score de 12 %. */
    const m = valeurCotation(snap, entry);
    if (m && m.unite !== '%') {
      mesures.push({ date: sess.date, value: m.valeur, favorite: !!snap.favorite });
      unite = m.unite;
    }
  });
  points.sort((a, b) => new Date(a.date) - new Date(b.date));
  mesures.sort((a, b) => new Date(a.date) - new Date(b.date));

  const crit = critereDe(obj);
  const base = {
    points,
    mesures,
    unite,
    threshold: crit ? crit.threshold : null,
    needed: crit ? crit.needed : null,
    prioritaire: points.some((p) => p.favorite) || mesures.some((m) => m.favorite),
  };

  /* Un objectif suivi en mesure brute — occurrences, minutes, latence — n'a
     pas de pourcentage à comparer au seuil d'acquisition. Le classer « Non
     acquis » comme avant était faux : il n'était pas raté, il n'était pas
     mesuré sur cette échelle. Il garde donc son propre état, et seule
     l'absence de cotation récente peut encore le rendre dormant. */
  if (!points.length && mesures.length) {
    const jours = Math.floor((Date.now() - new Date(mesures[mesures.length - 1].date)) / 86400000);
    if (jours >= DORMANT_JOURS) return { ...base, etat: 'dormant', streak: 0, jours };
    return { ...base, etat: 'mesure', streak: 0 };
  }
  if (!points.length) return { ...base, etat: 'non_acquis', streak: 0 };

  let streak = 0;
  if (crit) {
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].value >= crit.threshold) streak += 1;
      else break;
    }
  }
  const jours = Math.floor((Date.now() - new Date(points[points.length - 1].date)) / 86400000);

  if (crit && streak >= crit.needed) return { ...base, etat: 'acquis', streak };
  if (jours >= DORMANT_JOURS) return { ...base, etat: 'dormant', streak, jours };
  if (crit && crit.needed > 1 && streak >= crit.needed - 1) return { ...base, etat: 'bientot', streak };
  if (crit && points.length >= PLATEAU_MIN_POINTS) {
    const cinq = points.slice(-5);
    const moyenne = Math.round(cinq.reduce((a, p) => a + p.value, 0) / cinq.length);
    const ecart = crit.threshold - moyenne;
    if (ecart > 0 && ecart <= PLATEAU_ECART_MAX) return { ...base, etat: 'plateau', streak, moyenne };
  }
  return { ...base, etat: 'en_cours', streak };
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
        ...analyserObjectif(siennes, tableParSource, obj),
      });
    });
  });
  return lignes;
}

/* ==================== Table de faits ====================
   Une ligne par cotation, par crise et par renforcement, avec toutes les
   dimensions résolues. C'est ce qui permet de croiser librement deux axes
   sans avoir prévu la combinaison à l'avance. */
function construireFaits(donnees) {
  const cotations = [];
  const renforcements = [];
  const nomIntervenant = (source, id) => {
    const t = (donnees._intervenants || {})[source] || {};
    return t[id] || 'Non renseigné';
  };

  donnees.seances.forEach((sess) => {
    const atelier = nomAtelier(donnees, sess.source, sess.atelierId);
    const intervenant = nomIntervenant(sess.source, sess.intervenantId);
    const table = (donnees._idVersInitiales || {})[sess.source] || {};

    (sess.studentIds || []).forEach((sid) => {
      const initiales = table[sid];
      if (!initiales) return;

      ((sess.selectedObjectives || {})[sid] || []).forEach((oid) => {
        const obj = (sess.objectiveSnapshot || {})[oid];
        const entry = (sess.data || {})[sid] && sess.data[sid][oid];
        if (!obj) return;
        const score = objectiveScoreValue(obj, entry);
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
        });
      });

      const r = (sess.reinforcement || {})[sid];
      if (r && r.totalMs) {
        renforcements.push({
          seanceId: sess.id,
          date: sess.date,
          personne: initiales,
          atelier,
          intervenant,
          minutes: Math.round(r.totalMs / 60000),
        });
      }
    });
  });

  const crises = (donnees.crises || []).map((c) => {
    const table = (donnees._idVersInitiales || {})[c.source] || {};
    return {
      date: c.date,
      personne: table[c.studentId] || 'Non renseignée',
      atelier: nomAtelier(donnees, c.source, c.atelierId),
      type: (c.kind || 'crise') === 'abc' ? 'Observation' : 'Crise',
      intensite: c.intensite ? `${c.intensite} · ${INTENSITES[c.intensite].label}` : 'Non renseignée',
      minutes: Math.round((c.durationMs || 0) / 60000),
    };
  });

  return { cotations, crises, renforcements };
}

const TYPES_COTATION = {
  trials: 'Essai par essai', probe: 'Probe', occurrence: 'Par occurrence',
  timer: 'Timer', interval: 'Niveau par intervalle', chaining: 'Chaînage',
  latency: 'Latence', balance: 'Balance Program',
};

const nomAtelier = (d, source, id) => (id && ((d._ateliers || {})[source] || {})[id]) || 'Hors atelier';
/* --- Temps de renforcement ---
   Relevé par personne et par séance. Le temps d'activité est déduit de la
   durée réelle de la séance, pauses comprises. */
function renforcementsDe(donnees, initiales) {
  const releves = [];
  donnees.seances.forEach((se) => {
    const sid = idPourSource(donnees, se.source, initiales);
    if (!sid || !(se.studentIds || []).includes(sid)) return;
    const r = (se.reinforcement || {})[sid];
    const renfoMs = (r && r.totalMs) || 0;
    const dureeMs = se.endedAt && se.startedAt ? Math.max(0, se.endedAt - se.startedAt) : 0;
    releves.push({
      date: se.date,
      renfoMin: Math.round(renfoMs / 60000),
      dureeMin: Math.round(dureeMs / 60000),
      activiteMin: Math.max(0, Math.round((dureeMs - renfoMs) / 60000)),
      part: dureeMs ? Math.round((renfoMs / dureeMs) * 100) : 0,
    });
  });
  return releves.sort((a, b) => new Date(a.date) - new Date(b.date));
}

const cleAlias = (initiales, objectif) => `${initiales}|${objectif}`;
const nomAffiche = (d, initiales) => (d.alias.personnes || {})[initiales] || initiales;
const libelleAffiche = (d, initiales, objectif) => (d.alias.objectifs || {})[cleAlias(initiales, objectif)] || objectif;
const codeEflDe = (d, objectif) => ((d.codesEfl || {})[objectif] || '').trim();

/* ==================== Navigation par balayage ====================
   Sur mobile, passer d'un onglet à l'autre au doigt. Les zones qui défilent
   déjà horizontalement — tableaux, graphiques — gardent la priorité, sinon
   le balayage volerait leur geste. */
function gereDejaLeGeste(cible) {
  let n = cible;
  while (n && n !== document.body) {
    if (n.dataset && n.dataset.noSwipe !== undefined) return true;
    const t = n.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return true;
    if (n.scrollWidth > n.clientWidth + 4) {
      const st = window.getComputedStyle(n);
      if (/(auto|scroll)/.test(st.overflowX)) return true;
    }
    n = n.parentElement;
  }
  return false;
}


/* Balayage horizontal entre onglets, pour l'usage mobile.
   Les zones marquées data-no-swipe (tableaux, graphiques) gardent la main :
   sans cela, faire défiler un tableau large changerait de page. */
function useBalayage(onGauche, onDroite) {
  const ref = useRef(null);
  const etat = useRef({ x: 0, y: 0, actif: false });
  const [decalage, setDecalage] = useState(0);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const debut = (e) => {
      const t = e.touches[0];
      etat.current = { x: t.clientX, y: t.clientY, actif: !gereDejaLeGeste(e.target) };
    };
    const bouge = (e) => {
      if (!etat.current.actif) return;
      const t = e.touches[0];
      const dx = t.clientX - etat.current.x;
      const dy = t.clientY - etat.current.y;
      if (Math.abs(dx) < Math.abs(dy)) return; // geste plutôt vertical : on laisse défiler
      setEnCours(true);
      setDecalage(Math.max(-60, Math.min(60, dx * 0.35)));
    };
    const fin = (e) => {
      setEnCours(false);
      setDecalage(0);
      if (!etat.current.actif) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - etat.current.x;
      const dy = t.clientY - etat.current.y;
      etat.current.actif = false;
      // Geste franc et nettement horizontal, sinon on laisse défiler
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      if (dx < 0) onGauche();
      else onDroite();
    };

    el.addEventListener('touchstart', debut, { passive: true });
    el.addEventListener('touchmove', bouge, { passive: true });
    el.addEventListener('touchend', fin, { passive: true });
    return () => {
      el.removeEventListener('touchstart', debut);
      el.removeEventListener('touchmove', bouge);
      el.removeEventListener('touchend', fin);
    };
  }, [onGauche, onDroite]);

  return { ref, decalage, enCours };
}

/* ==================== Composants de base ==================== */
function Btn({ children, onClick, variant = 'solid', className = '', disabled, style, title }) {
  const base = 'rounded-xl px-4 py-2.5 font-medium text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-40';
  const styles = variant === 'solid'
    ? { backgroundColor: INK, color: '#fff' }
    : variant === 'outline'
    ? { backgroundColor: 'transparent', color: INK, border: `1px solid ${BORDER}` }
    : { backgroundColor: 'transparent', color: INK_SOFT };
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`${base} ${className}`} style={{ fontFamily: F_DISPLAY, ...styles, ...style }}>
      {children}
    </button>
  );
}
function Card({ children, className = '', style }) {
  return <div className={`rounded-2xl border p-4 ${className}`} style={{ borderColor: BORDER, backgroundColor: CARD, ...style }}>{children}</div>;
}
function Chip({ label, on, onClick }) {
  return (
    <button onClick={onClick} className="rounded-lg px-3 py-1.5 text-xs border"
      style={{ borderColor: on ? INK : BORDER, backgroundColor: on ? INK : 'transparent', color: on ? '#fff' : INK_SOFT }}>
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

/* Sélecteur de période, partagé par tous les écrans */
function SelecteurPeriode({ periode, setPeriode, avecGranularite }) {
  const p = periode;
  const maj = (champs) => setPeriode({ ...p, ...champs });

  return (
    <Card className="mb-4">
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
    </Card>
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

const periodeVide = () => ({ mode: 'raccourci', jours: 30, debut: '', fin: '', moisDebut: '', moisFin: '', granularite: 'jour' });

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
  return Math.round(((totaux[cible] || 0) / total) * 100);
}

/* Valeur d'une cotation, quel que soit son type : le pourcentage quand il
   existe, sinon la mesure brute. Renvoie null si rien n'a été relevé. */
function valeurCotation(obj, entry) {
  if (!obj || !entry) return null;
  const score = objectiveScoreValue(obj, entry);
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

function Graphique({ points, style, seuil, hauteur = 220, unite = '%' }) {
  const donnees = points.map((p) => ({
    label: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    valeur: p.value,
  }));
  /* Un pourcentage se lit toujours sur 0-100 : borner l'axe évite de faire
     passer une variation de trois points pour un bouleversement. Une mesure
     brute — occurrences, minutes, secondes — n'a pas de maximum connu, on
     laisse alors recharts choisir l'échelle. */
  const enPourcent = unite === '%';
  const etiquette = enPourcent ? 'Résultat' : 'Moyenne du jour';
  const axes = (
    <>
      <CartesianGrid stroke={BORDER} vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
      <YAxis domain={enPourcent ? [0, 100] : [0, 'auto']} allowDecimals={!enPourcent}
        tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={40} />
      <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontFamily: F_BODY, fontSize: 12 }}
        formatter={(v) => [`${v} ${unite}`, etiquette]} />
      {seuil != null && <ReferenceLine y={seuil} stroke={ACQUIS} strokeDasharray="4 4" strokeWidth={1.5} />}
    </>
  );
  const marge = { top: 8, right: 8, bottom: 4, left: -14 };
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        {style === 'barres' ? (
          <BarChart data={donnees} margin={marge}>{axes}<Bar dataKey="valeur" fill={INK} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart>
        ) : style === 'aire' ? (
          <AreaChart data={donnees} margin={marge}>{axes}<Area type="monotone" dataKey="valeur" stroke={INK} fill={INK} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} /></AreaChart>
        ) : style === 'points' ? (
          <ScatterChart data={donnees} margin={marge}>{axes}<Scatter dataKey="valeur" fill={INK} isAnimationActive={false} /></ScatterChart>
        ) : (
          <LineChart data={donnees} margin={marge}>{axes}<Line type="monotone" dataKey="valeur" stroke={INK} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} /></LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* Aperçu minuscule, sans axes : lisible d'un coup d'œil dans une liste */
function MiniGraphe({ points, couleur }) {
  const donnees = points.map((p, i) => ({ i, v: p.value }));
  return (
    <div style={{ height: 40, width: 110 }} className="shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={donnees} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis domain={[0, 100]} hide />
          <Line type="monotone" dataKey="v" stroke={couleur} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Radar : quels objectifs sont travaillés, et à quel niveau */
function RadarObjectifs({ lignes, hauteur = 320 }) {
  const donnees = lignes
    .filter((l) => l.points.length)
    .map((l) => ({
      objectif: l.objectif.length > 22 ? `${l.objectif.slice(0, 20)}…` : l.objectif,
      niveau: l.points[l.points.length - 1].value,
      seances: l.points.length,
    }));
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
          <Radar name="Dernier résultat" dataKey="niveau" stroke={INK} fill={INK} fillOpacity={0.25} isAnimationActive={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontFamily: F_BODY, fontSize: 12 }}
            formatter={(v, n, p) => [`${v} % · ${p.payload.seances} séances`, 'Dernier résultat']} />
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
              <Btn onClick={() => { effacerDonneesManager(); window.location.reload(); }} className="flex-1 text-sm" style={{ backgroundColor: NON_ACQUIS }}>
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

/* ==================== Tableau de bord ==================== */
function TableauDeBord({ donnees, lignes, periode, setPeriode, onOuvrirPersonne, onOuvrirCrises }) {
  const [unite, setUnite] = useState('nombre');
  const [etatOuvert, setEtatOuvert] = useState(null);
  /* Replié quand des prioritaires occupent déjà l'écran, déplié sinon :
     la liste doit rester le sujet principal de la page. */
  const [autresOuverts, setAutresOuverts] = useState(false);

  const recentes = lignes
    .map((l) => ({ ...l, points: l.points.filter((pt) => dansPeriode(pt.date, periode)) }))
    .filter((l) => l.points.length > 0);
  /* Deux listes distinctes plutôt qu'un titre qui bascule. Auparavant, dès
     qu'un objectif prioritaire existait sur la période, les autres
     disparaissaient et l'intitulé changeait tout seul : d'un appareil à
     l'autre, selon les séances importées, le même écran s'appelait tantôt
     « Objectifs prioritaires » tantôt « Objectifs travaillés » sans que rien
     ne l'explique. Les deux groupes sont désormais toujours nommés. */
  const rang = { bientot: 0, plateau: 1, en_cours: 2, dormant: 3, acquis: 4, non_acquis: 5 };
  const parEtat = (a, b) => rang[a.etat] - rang[b.etat];
  const prioritaires = recentes.filter((l) => l.prioritaire).sort(parEtat);
  const autres = recentes.filter((l) => !l.prioritaire).sort(parEtat);

  const crises = (donnees.crises || []).filter((c) => (c.kind || 'crise') === 'crise');
  const recentesCrises = crises.filter((c) => dansPeriode(c.date, periode));

  /* Période précédente de même durée, pour situer la tendance */
  const { min, max } = bornesDe(periode);
  const finRef = max || Date.now();
  const debutRef = min || (finRef - 30 * 86400000);
  const duree = finRef - debutRef;
  const precedentes = crises.filter((c) => {
    const t = new Date(c.date).getTime();
    return t >= debutRef - duree && t < debutRef;
  });
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
  const compte = (e) => lignes.filter((l) => l.etat === e).length;

  if (!donnees.seances.length) {
    return <Empty>Importez une sauvegarde DatABA depuis l'onglet Gestion pour commencer.</Empty>;
  }

  return (
    <div>
      <SelecteurPeriode periode={periode} setPeriode={setPeriode} />

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
            {['acquis', 'bientot', 'plateau', 'en_cours', 'dormant', 'non_acquis'].map((e) => {
              const n = compte(e);
              const tot = lignes.length || 1;
              const on = etatOuvert === e;
              return (
                <button key={e} onClick={() => setEtatOuvert(on ? null : e)} disabled={!n}
                  className="min-w-[74px] rounded-xl px-2.5 py-2 border text-left disabled:opacity-40"
                  style={{ borderColor: on ? ETATS[e].color : BORDER, backgroundColor: on ? `${ETATS[e].color}14` : 'transparent' }}>
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
                {lignes.filter((l) => l.etat === etatOuvert).map((l, i) => (
                  <button key={i} onClick={() => onOuvrirPersonne(l.initials, l.objectif)}
                    className="w-full text-left rounded-xl px-3 py-2 flex items-start justify-between gap-2"
                    style={{ backgroundColor: PAPER }}>
                    <span className="text-sm min-w-0 break-words">
                      <span className="font-semibold" style={{ fontFamily: F_DISPLAY }}>{nomAffiche(donnees, l.initials)}</span>
                      {' · '}{libelleAffiche(donnees, l.initials, l.objectif)}
                    </span>
                    <span className="text-xs shrink-0" style={{ fontFamily: F_MONO, color: ETATS[etatOuvert].color }}>
                      {l.points.length} séance{l.points.length !== 1 ? 's' : ''}
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
                {tendance > 0 ? '+' : ''}{tendance} % vs période précédente
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
      {lignes.map((l, i) => (
        <button key={`${l.initials}|${l.objectif}|${i}`} onClick={() => onOuvrir(l.initials, l.objectif)}
          className="w-full rounded-xl border px-3.5 py-3 flex items-center gap-3 text-left"
          style={{ borderColor: BORDER, backgroundColor: CARD }}>
          <div className="min-w-0 flex-1">
            <div className="text-sm break-words">
              <span className="font-semibold" style={{ fontFamily: F_DISPLAY }}>{nomAffiche(donnees, l.initials)}</span>
              {' · '}{libelleAffiche(donnees, l.initials, l.objectif)}
            </div>
            <div className="text-xs" style={{ color: INK_SOFT }}>
              {l.points.length} séance{l.points.length !== 1 ? 's' : ''}
              {l.threshold != null && ` · seuil ${l.threshold} %`}
              {l.etat === 'bientot' && ` · ${l.streak}/${l.needed}`}
              {l.etat === 'plateau' && ` · moyenne ${l.moyenne} %`}
            </div>
          </div>
          <MiniGraphe points={l.points} couleur={ETATS[l.etat].color} />
          <span className="text-xs font-medium px-2 py-1 rounded-lg shrink-0"
            style={{ backgroundColor: ETATS[l.etat].color, color: '#fff', fontFamily: F_DISPLAY }}>
            {ETATS[l.etat].court}
          </span>
        </button>
      ))}
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

function trouverPaires(seances) {
  const cand = seances.filter((s) => s.doubleCotation);
  const parJour = new Map();
  cand.forEach((s) => {
    const cle = `${new Date(s.date).toLocaleDateString('fr-FR')}|${s.atelierId || 'libre'}`;
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
function SeancesScreen({ donnees, onSupprimerSeance }) {
  const [choisie, setChoisie] = useState(null);
  const [ouverte, setOuverte] = useState(null);      // séance dépliée
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState('date');
  const [toutes, setToutes] = useState(false);       // au-delà des 25 premières

  const LOT = 25;

  const seances = donnees.seances.map((s) => {
    let cotations = 0;
    (s.studentIds || []).forEach((sid) => {
      ((s.selectedObjectives || {})[sid] || []).forEach((oid) => {
        const obj = (s.objectiveSnapshot || {})[oid];
        const entry = (s.data || {})[sid] && s.data[sid][oid];
        if (obj && entry && objectiveScoreValue(obj, entry) != null) cotations += 1;
      });
    });
    const table = (donnees._idVersInitiales || {})[s.source] || {};
    const initiales = (s.studentIds || []).map((sid) => table[sid]).filter(Boolean);
    return { ...s, cotations, initiales };
  });

  const q = recherche.trim().toLowerCase();
  const filtrees = seances.filter((s) => {
    if (!q) return true;
    const champs = [
      new Date(s.date).toLocaleDateString('fr-FR'),
      s.source || '',
      nomAtelier(donnees, s.source, s.atelierId),
      ...s.initiales.map((i) => nomAffiche(donnees, i)),
    ].join(' ').toLowerCase();
    return champs.includes(q);
  }).sort((a, b) => (tri === 'cotations'
    ? b.cotations - a.cotations
    : new Date(b.date) - new Date(a.date)));

  const affichees = toutes ? filtrees : filtrees.slice(0, LOT);

  const paires = trouverPaires(donnees.seances);
  const res = choisie ? comparerPaire(choisie, donnees) : null;
  const couleur = res && res.pct != null ? (res.pct >= 80 ? ACQUIS : res.pct >= 60 ? EN_COURS : NON_ACQUIS) : INK_SOFT;

  if (!donnees.seances.length) return <Empty>Aucune séance importée.</Empty>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une date, une personne, un atelier…"
          className="flex-1 min-w-[220px] rounded-xl border px-3 py-2.5 text-sm bg-transparent"
          style={{ borderColor: BORDER, color: INK }} />
        <div className="flex gap-1.5">
          <Chip label="Par date" on={tri === 'date'} onClick={() => setTri('date')} />
          <Chip label="Par cotations" on={tri === 'cotations'} onClick={() => setTri('cotations')} />
        </div>
      </div>

      <div className="text-xs uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>
        {filtrees.length} séance{filtrees.length !== 1 ? 's' : ''}
        {q && ` sur ${seances.length}`} — appuyez pour voir le détail
      </div>

      <div className="space-y-1.5 mb-4">
        {affichees.map((s) => (
          <DetailSeance key={s.id} seance={s} donnees={donnees}
            ouverte={ouverte === s.id}
            onBasculer={() => setOuverte(ouverte === s.id ? null : s.id)}
            onSupprimer={() => onSupprimerSeance(s)} />
        ))}
        {!affichees.length && <Empty>Aucune séance ne correspond à cette recherche.</Empty>}
      </div>

      {filtrees.length > LOT && (
        <Btn variant="outline" onClick={() => setToutes((v) => !v)} className="text-sm mb-6">
          {toutes ? `N'afficher que les ${LOT} premières` : `Afficher les ${filtrees.length - LOT} autres`}
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
        <>
          <div className="space-y-1.5 mb-3">
            {paires.map((p, i) => (
              <button key={i} onClick={() => setChoisie(p)}
                className="w-full text-left rounded-xl border px-3.5 py-3"
                style={{ borderColor: choisie === p ? INK : BORDER, backgroundColor: CARD }}>
                <div className="text-sm font-medium">{p.jour}</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>{p.a.source} · {p.b.source}</div>
              </button>
            ))}
          </div>

          {res && (
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
                  En dessous, mieux vaut reprendre ensemble les définitions avant de poursuivre.
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
        </>
      )}
    </div>
  );
}

/* Une séance dans la liste, dépliable sur son détail complet.
   Les cotations ne sont pas modifiables ici : la tablette reste la source, et
   un réimport de la même séance rétablirait de toute façon ses valeurs. */
function DetailSeance({ seance, donnees, ouverte, onBasculer, onSupprimer }) {
  const table = (donnees._idVersInitiales || {})[seance.source] || {};
  const intervenant = ((donnees._intervenants || {})[seance.source] || {})[seance.intervenantId];
  const dureeMin = seance.endedAt && seance.startedAt
    ? Math.round(Math.max(0, seance.endedAt - seance.startedAt) / 60000) : null;

  return (
    <div className="rounded-xl border" style={{ borderColor: ouverte ? INK : BORDER, backgroundColor: CARD }}>
      <button onClick={onBasculer} className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {new Date(seance.date).toLocaleDateString('fr-FR')}
            {seance.doubleCotation && (
              <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ backgroundColor: INK, color: '#fff' }}>double cotation</span>
            )}
          </div>
          <div className="text-xs break-words" style={{ color: INK_SOFT }}>
            {seance.source} · {nomAtelier(donnees, seance.source, seance.atelierId)}
            {seance.initiales.length > 0 && ` · ${seance.initiales.map((i) => nomAffiche(donnees, i)).join(', ')}`}
          </div>
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
            Mode : {seance.mode === 'balance' ? 'Balance Program' : 'atelier'}
          </div>

          {(seance.studentIds || []).map((sid) => {
            const ini = table[sid];
            const objectifs = (seance.selectedObjectives || {})[sid] || [];
            const note = (seance.notes || {})[sid];
            const renfo = (seance.reinforcement || {})[sid];
            return (
              <div key={sid} className="mb-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: PAPER }}>
                <div className="text-sm font-semibold mb-1.5" style={{ fontFamily: F_DISPLAY }}>
                  {ini ? nomAffiche(donnees, ini) : 'Personne inconnue'}
                  {renfo && renfo.totalMs > 0 && (
                    <span className="text-xs font-normal ml-2" style={{ color: INK_SOFT }}>
                      renforcement {Math.round(renfo.totalMs / 60000)} min
                    </span>
                  )}
                </div>
                {objectifs.length === 0 ? (
                  <div className="text-xs" style={{ color: INK_SOFT }}>Aucun objectif sélectionné.</div>
                ) : objectifs.map((oid) => {
                  const obj = (seance.objectiveSnapshot || {})[oid];
                  if (!obj) return null;
                  const entry = (seance.data || {})[sid] && seance.data[sid][oid];
                  const score = objectiveScoreValue(obj, entry);
                  return (
                    <div key={oid} className="flex items-baseline justify-between gap-2 text-xs py-0.5">
                      <span className="min-w-0 break-words">
                        {ini ? libelleAffiche(donnees, ini, obj.name) : obj.name}
                        <span style={{ color: INK_SOFT }}> · {TYPES_COTATION[obj.type] || obj.type}</span>
                      </span>
                      <span className="shrink-0" style={{ fontFamily: F_MONO, color: score == null ? INK_SOFT : INK }}>
                        {score == null ? 'non coté' : `${score} %`}
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

/* Palette des séries : assez contrastée pour distinguer six segments empilés */
const PALETTE_SERIES = ['#1A345C', '#A8402F', '#D69A2D', '#0F8B6C', '#7A6A9A', '#2E6E8E', '#8A8F84'];
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
   Les périodes sans aucune crise sont conservées : un trou dans la courbe est
   une information, l'écraser laisserait croire à une continuité.
   « mesure » vaut 'nombre' (chaque crise pèse 1) ou 'duree' (chaque crise pèse
   ses minutes) : une semaine peut compter peu de crises mais très longues. */
function chronologieCrises(donnees, crises, granularite, segmentation, mesure = 'nombre') {
  const paquets = new Map();
  const totaux = new Map();
  const poids = (c) => (mesure === 'duree' ? Math.round((c.durationMs || 0) / 60000) : 1);

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
  { k: 'avertissement', label: 'Rappel sur l’interprétation' },
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
});

/* Barres horizontales : les intitulés sont longs, un axe vertical les
   tronquerait. */
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
function BlocsCrise({ donnees, crises, periode, config, refChrono }) {
  const actif = (k) => (config.blocs || TOUS_LES_BLOCS).includes(k);
  const gran = periode.granularite || 'semaine';
  const chrono = chronologieCrises(donnees, crises, gran, config.segmentation, config.mesure);

  const minutesDe = (c) => Math.round((c.durationMs || 0) / 60000);
  const chronometrees = crises.filter((c) => (c.durationMs || 0) > 0);
  const dureeTotale = crises.reduce((a, c) => a + minutesDe(c), 0);
  const dureeMoyenne = chronometrees.length
    ? Math.round(chronometrees.reduce((a, c) => a + minutesDe(c), 0) / chronometrees.length) : 0;
  const dureeMax = chronometrees.length ? Math.max(...chronometrees.map(minutesDe)) : 0;

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
      {actif('chronologie') && (
        <Card className="mb-3">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>Évolution dans le temps</div>
          {chrono.donnees.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: INK_SOFT }}>Aucun enregistrement sur cette période.</p>
          ) : (
            <>
              <div style={{ height: 300 }} ref={refChrono} data-no-swipe>
                <ResponsiveContainer width="100%" height="100%">
                  {config.forme === 'courbes' ? (
                    <LineChart data={chrono.donnees} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                      <CartesianGrid stroke={BORDER} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={34} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontFamily: F_BODY, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chrono.series.map((nom, i) => (
                        <Line key={nom} type="monotone" dataKey={nom} stroke={PALETTE_SERIES[i % PALETTE_SERIES.length]}
                          strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={chrono.donnees} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                      <CartesianGrid stroke={BORDER} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={34} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontFamily: F_BODY, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chrono.series.map((nom, i) => (
                        <Bar key={nom} dataKey={nom} stackId="crises" fill={PALETTE_SERIES[i % PALETTE_SERIES.length]}
                          radius={i === chrono.series.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
                {config.mesure === 'duree' ? 'Minutes cumulées' : 'Nombre d’enregistrements'}, regroupé par {gran === 'jour' ? 'jour' : gran === 'mois' ? 'mois' : 'semaine'}.
                {chrono.regroupe && ' Les séries les moins fréquentes sont réunies sous « Autres ».'}
                {(SEGMENTATIONS.find((sg) => sg.k === config.segmentation) || {}).multi &&
                  " Un même enregistrement peut porter plusieurs valeurs : le total empilé dépasse alors le nombre d'enregistrements."}
                {config.mesure === 'duree' && " Une observation ABC n'a pas de durée : elle pèse zéro dans cette vue."}
              </p>
            </>
          )}
        </Card>
      )}

      {actif('synthese') && (
        <Card className="mb-3">
          <div className="flex flex-wrap items-baseline gap-4">
            <span>
              <span className="text-2xl font-semibold" style={{ fontFamily: F_MONO }}>{crises.length}</span>
              <span className="text-xs ml-1.5" style={{ color: INK_SOFT }}>
                enregistrement{crises.length !== 1 ? 's' : ''} sur {libellePeriode(periode)}
              </span>
            </span>
            {notees > 0 && (
              <span className="text-xs" style={{ color: INK_SOFT }}>
                dont <span style={{ fontFamily: F_MONO }}>{notees}</span> avec une intensité renseignée
              </span>
            )}
          </div>
          {chronometrees.length > 0 && (
            <div className="flex flex-wrap gap-5 mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div>
                <div className="text-xl font-semibold" style={{ fontFamily: F_MONO, color: CRISE }}>{dureeTotale} min</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>durée cumulée</div>
              </div>
              <div>
                <div className="text-xl font-semibold" style={{ fontFamily: F_MONO }}>{dureeMoyenne} min</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>
                  en moyenne ({chronometrees.length}/{crises.length} chronométrée{chronometrees.length !== 1 ? 's' : ''})
                </div>
              </div>
              <div>
                <div className="text-xl font-semibold" style={{ fontFamily: F_MONO }}>{dureeMax} min</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>la plus longue</div>
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

      {actif('avertissement') && (
        <p className="text-xs" style={{ color: INK_SOFT }}>
          Ces répartitions décrivent ce qui a été observé et coché. Elles orientent une hypothèse,
          elles ne l'établissent pas : une analyse fonctionnelle reste du ressort du professionnel.
        </p>
      )}
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

function CrisesScreen({ donnees, periode, setPeriode, focusPersonne, onFocusConsomme,
  composition, onValiderBilan, onAnnulerBilan }) {
  const [config, setConfig] = useState(configCriseVide());
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const refChrono = useRef(null);
  const refZone = useRef(null);

  const maj = (champs) => setConfig((c) => ({ ...c, ...champs }));

  /* Arrivée depuis la fiche d'une personne, ou depuis un rapport à composer :
     on préselectionne le filtre, puis on rend la main pour que l'utilisateur
     puisse le modifier librement.
     La dépendance se limite à focusPersonne : onFocusConsomme est recréée à
     chaque rendu du parent, la lister relancerait l'effet en boucle. */
  useEffect(() => {
    if (!focusPersonne) return;
    setConfig((c) => ({ ...c, personnes: [focusPersonne], type: 'crise' }));
    onFocusConsomme();
  }, [focusPersonne]);

  /* Reprise d'un bilan déjà composé : on repart de ses réglages exacts plutôt
     que des réglages par défaut, sinon revenir le modifier le reconstruirait
     de zéro. */
  useEffect(() => {
    if (composition && composition.config) setConfig(composition.config);
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
        <div className="flex flex-wrap gap-1.5 mb-3 no-print">
          <Chip label="Toutes les personnes" on={!(config.personnes || []).length} onClick={() => maj({ personnes: [] })} />
          {donnees.personnes.map((p) => (
            <Chip key={p.initials} label={nomAffiche(donnees, p.initials)}
              on={(config.personnes || []).includes(p.initials)}
              onClick={() => maj({ personnes: (config.personnes || []).includes(p.initials)
                ? config.personnes.filter((x) => x !== p.initials)
                : [...(config.personnes || []), p.initials] })} />
          ))}
        </div>
      )}

      <div className="no-print"><SelecteurPeriode periode={periode} setPeriode={setPeriode} avecGranularite /></div>

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
            <Btn variant="ghost" className="text-xs py-1.5" onClick={() => setReglagesOuverts((v) => !v)}>
              {reglagesOuverts ? 'Replier' : 'Modifier'}
            </Btn>
          </div>
        </div>

        {reglagesOuverts && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="text-xs mr-1" style={{ color: INK_SOFT }}>Graphique</span>
              <Chip label="Barres" on={config.forme === 'barres'} onClick={() => maj({ forme: 'barres' })} />
              <Chip label="Courbes" on={config.forme === 'courbes'} onClick={() => maj({ forme: 'courbes' })} />
            </div>
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
          titre et du rappel des réglages. */}
      <div ref={refZone}>
        <div className="print-only" style={{ marginBottom: '0.75rem' }}>
          <div className="text-lg font-semibold" style={{ fontFamily: F_DISPLAY }}>
            Bilan des crises — {libellePeriode(periode)}
          </div>
          <div className="text-xs" style={{ color: INK_SOFT }}>{resumeReglages}</div>
        </div>

        {retenues.length === 0 ? (
          <Empty>Aucun enregistrement sur cette période avec ces filtres.</Empty>
        ) : (
          <BlocsCrise donnees={donnees} crises={retenues} periode={periode} config={config} refChrono={refChrono} />
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
function ApercuCrises({ donnees, personne, crises, granularite, onOuvrir }) {
  const vraies = crises.filter((c) => (c.kind || 'crise') === 'crise');

  const paquets = new Map();
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
      <div style={{ height: 110 }} data-no-swipe>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={34} />
            <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontFamily: F_BODY, fontSize: 12 }} />
            <Bar dataKey="Crises" fill={CRISE} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            {tendance && <Line type="linear" dataKey="Tendance" stroke={INK} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs mt-1" style={{ color: INK_SOFT }}>
        Occurrences par {granularite === 'jour' ? 'jour' : granularite === 'mois' ? 'mois' : 'semaine'}
        {tendance && ', ligne pointillée : tendance'}. Les observations ABC ne sont pas comptées.
      </p>
    </button>
  );
}

/* Une courbe d'objectif et ses trois commandes : replier (pour se concentrer
   sur les autres), agrandir (une courbe dense est illisible à 220 px), et
   exporter en image (pour coller dans un compte rendu sans passer par une
   capture d'écran). */
function CarteObjectif({ ligne, donnees, personne, style, masque, agrandi, surligne, onMasquer, onAgrandir }) {
  const refGraphe = useRef(null);
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

  /* Une hausse de latence n'est pas un progrès : la couleur suit le sens de
     l'objectif, pas le signe du pourcentage. */
  const favorable = evolution && evolution.pct != null && evolution.pct !== 0
    ? ((evolution.pct > 0) === (ligne.unite !== 's'))
    : null;

  return (
    /* Repliée, la carte sort aussi de l'export : imprimer un en-tête sans sa
       courbe n'aurait aucun intérêt, et replier sert précisément à choisir ce
       qui part dans le document. */
    <Card className={masque ? 'no-print' : ''} style={surligne ? { borderColor: INK, borderWidth: 2 } : undefined}>
      <div className="flex items-start justify-between gap-3 mb-2">
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
          <div className="text-xs" style={{ color: INK_SOFT }}>
            {enMesure ? (
              <>
                {journalieres.length} jour{journalieres.length !== 1 ? 's' : ''} de relevé
                {moyenne != null && ` · ${moyenne} ${ligne.unite} par jour en moyenne`}
              </>
            ) : (
              <>
                {ligne.points.length} séance{ligne.points.length !== 1 ? 's' : ''}
                {ligne.threshold != null && ` · seuil ${ligne.threshold} %`}
              </>
            )}
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-lg shrink-0"
          style={{ backgroundColor: ETATS[ligne.etat].color, color: '#fff', fontFamily: F_DISPLAY }}>
          {ETATS[ligne.etat].label}
        </span>
      </div>

      {enMesure && (
        <div className="rounded-xl px-3 py-2 mb-2" style={{ backgroundColor: PAPER }}>
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

      <div className="flex flex-wrap items-center gap-1.5 mb-2 no-print">
        <Btn variant="ghost" onClick={onMasquer} className="text-xs py-1">
          {masque ? 'Afficher la courbe' : 'Replier'}
        </Btn>
        {!masque && courbe.length > 0 && (
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

      {masque ? null : courbe.length ? (
        <div ref={refGraphe} data-no-swipe>
          <Graphique points={courbe} style={style} seuil={enMesure ? null : ligne.threshold}
            hauteur={agrandi ? 460 : surligne ? 300 : 220}
            unite={enMesure ? ligne.unite : '%'} />
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: INK_SOFT }}>Aucune donnée sur cette période.</p>
      )}
    </Card>
  );
}

function PersonnesScreen({ donnees, lignes, focus, setFocus, periode, setPeriode, onRapport, onRapportCrises, onOuvrirCrises }) {
  const [vue, setVue] = useState('objectifs');
  const [style, setStyle] = useState('ligne');
  /* Objectifs dont on a replié la courbe, et celui qu'on a agrandi. Repérés
     par leur nom : les identifiants d'objectif changent d'une tablette à
     l'autre, le nom est ce qui reste stable côté consolidation. */
  const [masques, setMasques] = useState([]);
  const [agrandi, setAgrandi] = useState(null);
  const refObjectifs = useRef(null);

  /* Calculé avant le retour anticipé plus bas : l'effet qui suit doit être
     appelé à chaque rendu, sans quoi l'ordre des hooks change selon qu'une
     personne existe ou non. */
  const personne = (focus && focus.initiales)
    || (donnees.personnes.length ? donnees.personnes[0].initials : null);

  /* Changer de personne remet les courbes à plat : un objectif replié chez
     l'une n'a pas de raison de l'être chez l'autre, même s'il porte le même
     nom. */
  useEffect(() => {
    setMasques([]);
    setAgrandi(null);
  }, [personne]);

  if (!donnees.personnes.length) return <Empty>Importez une sauvegarde pour commencer.</Empty>;

  const objectifOuvert = focus && focus.objectif;

  const siennes = lignes
    .filter((l) => l.initials === personne)
    .map((l) => ({ ...l, points: l.points.filter((pt) => dansPeriode(pt.date, periode)) }));

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

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {donnees.personnes.map((p) => (
          <button key={p.initials} onClick={() => setFocus({ initiales: p.initials, objectif: null })}
            className="rounded-xl px-4 py-2.5 border font-semibold text-sm"
            style={{ fontFamily: F_DISPLAY, borderColor: personne === p.initials ? INK : BORDER,
              backgroundColor: personne === p.initials ? INK : 'transparent', color: personne === p.initials ? '#fff' : INK_SOFT }}>
            {nomAffiche(donnees, p.initials)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {[
          { k: 'objectifs', l: 'Objectifs', icone: TrendingUp },
          { k: 'bilan', l: 'Bilan', icone: Target },
          { k: 'radar', l: 'Radar', icone: RadarIcon },
          { k: 'crises', l: 'Crises', icone: AlertTriangle },
          { k: 'renfo', l: 'Renforcement', icone: Gift },
          { k: 'croisement', l: 'Croisement', icone: Activity },
        ].map((v) => {
          const Icone = v.icone;
          return (
            <button key={v.k} onClick={() => setVue(v.k)}
              className="rounded-lg px-3 py-1.5 text-xs border flex items-center gap-1.5"
              style={{ borderColor: vue === v.k ? INK : BORDER, backgroundColor: vue === v.k ? INK : 'transparent', color: vue === v.k ? '#fff' : INK_SOFT }}>
              <Icone size={13} /> {v.l}
            </button>
          );
        })}
      </div>

      <SelecteurPeriode periode={periode} setPeriode={setPeriode} avecGranularite={vue === 'croisement'} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Btn onClick={() => onRapport(personne, siennes.map((l) => l.objectif))} className="text-sm">
          Générer un rapport
        </Btn>
        <Btn variant="outline" onClick={() => onRapportCrises(personne)} className="text-sm">
          <AlertTriangle size={14} /> Rapport de crise
        </Btn>
        <span className="text-xs" style={{ color: INK_SOFT }}>Reprend cette personne et cette période.</span>
      </div>

      <ApercuCrises donnees={donnees} personne={personne} crises={crisesPersonne}
        granularite={gran} onOuvrir={() => onOuvrirCrises(personne)} />

      {vue === 'objectifs' && (() => {
        const visibles = siennes.filter((l) => !masques.includes(l.objectif));
        const basculerMasque = (nom) => setMasques((cur) => (cur.includes(nom) ? cur.filter((x) => x !== nom) : [...cur, nom]));
        return (
          <>
            <div className="flex flex-wrap items-center gap-1.5 mb-3 no-print">
              {STYLES_GRAPHIQUE.map((g) => <Chip key={g.k} label={g.label} on={style === g.k} onClick={() => setStyle(g.k)} />)}
              <Btn variant="outline" className="text-xs py-1.5 ml-auto"
                onClick={() => imprimerZone(refObjectifs.current)} disabled={!visibles.length}>
                <Printer size={13} /> PDF
              </Btn>
              {masques.length > 0 && (
                <Btn variant="ghost" onClick={() => setMasques([])} className="text-xs py-1.5">
                  Réafficher {masques.length} courbe{masques.length !== 1 ? 's' : ''}
                </Btn>
              )}
            </div>

            {siennes.length === 0 ? <Empty>Aucun objectif pour cette personne.</Empty> : (
              /* Zone exportée : seules les courbes laissées visibles en sortent,
                 dans le style choisi. Ce qui est replié à l'écran n'est pas
                 imprimé — c'est tout l'intérêt de pouvoir replier. */
              <div ref={refObjectifs}>
                <div className="print-only" style={{ marginBottom: '0.75rem' }}>
                  <div className="text-lg font-semibold" style={{ fontFamily: F_DISPLAY }}>
                    {nomAffiche(donnees, personne)} — {libellePeriode(periode)}
                  </div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>
                    {visibles.length} objectif{visibles.length !== 1 ? 's' : ''} sur {siennes.length}
                    {masques.length > 0 && ` · ${masques.length} replié${masques.length !== 1 ? 's' : ''}`}
                  </div>
                </div>

                <div className="space-y-3">
                  {siennes.map((l) => (
                    <CarteObjectif key={l.objectif} ligne={l} donnees={donnees} personne={personne}
                      style={style}
                      masque={masques.includes(l.objectif)}
                      agrandi={agrandi === l.objectif}
                      surligne={objectifOuvert === l.objectif}
                      onMasquer={() => basculerMasque(l.objectif)}
                      onAgrandir={() => setAgrandi(agrandi === l.objectif ? null : l.objectif)} />
                  ))}
                  {visibles.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: INK_SOFT }}>
                      Toutes les courbes sont repliées.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {vue === 'bilan' && (
        <Card>
          <div className="flex flex-wrap gap-4 mb-4">
            {['acquis', 'bientot', 'plateau', 'en_cours', 'dormant', 'non_acquis'].map((e) => (
              <div key={e} className="min-w-[80px]">
                <div className="text-xl font-semibold" style={{ fontFamily: F_MONO, color: ETATS[e].color }}>{compte(e)}</div>
                <div className="text-xs" style={{ color: INK_SOFT }}>{ETATS[e].court}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {siennes.map((l, i) => (
              <div key={i} className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2" style={{ backgroundColor: PAPER }}>
                <span className="text-sm min-w-0 break-words">{libelleAffiche(donnees, l.initials, l.objectif)}</span>
                <span className="text-xs shrink-0 px-2 py-0.5 rounded" style={{ backgroundColor: ETATS[l.etat].color, color: '#fff' }}>
                  {ETATS[l.etat].court}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {vue === 'radar' && (
        <Card>
          <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
            Dernier résultat de chaque objectif travaillé sur la période — la forme montre d'un coup
            d'œil ce qui est solide et ce qui reste à consolider.
          </div>
          <RadarObjectifs lignes={siennes} />
        </Card>
      )}

      {vue === 'crises' && (
        crisesPersonne.length === 0 ? <Empty>Aucune crise consignée sur la période.</Empty> : (
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
                      <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: INTENSITES[c.intensite].color, color: '#fff' }}>
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
        )
      )}

      {vue === 'renfo' && (() => {
        const releves = renforcementsDe(donnees, personne).filter((r) => dansPeriode(r.date, periode));
        if (!releves.length) return <Empty>Aucune séance sur cette période.</Empty>;
        const avecRenfo = releves.filter((r) => r.renfoMin > 0);
        const totalRenfo = releves.reduce((a, r) => a + r.renfoMin, 0);
        /* Deux moyennes, parce qu'elles ne répondent pas à la même question :
           la générale compte les séances sans renforcement comme des zéros et
           dit la place du renforcement dans l'accompagnement ; celle « quand il
           y en a » ne porte que sur les séances concernées et dit la durée
           habituelle d'un renforcement. Confondre les deux fait conclure à une
           baisse là où il n'y a qu'un changement de fréquence. */
        const moyenneGenerale = releves.length ? Math.round(totalRenfo / releves.length) : 0;
        const moyenneRenfo = avecRenfo.length ? Math.round(avecRenfo.reduce((a, r) => a + r.renfoMin, 0) / avecRenfo.length) : 0;
        const moyennePart = avecRenfo.length ? Math.round(avecRenfo.reduce((a, r) => a + r.part, 0) / avecRenfo.length) : 0;
        const graphe = releves.map((r) => ({
          label: new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
          Renforcement: r.renfoMin,
          Activité: r.activiteMin,
        }));
        return (
          <>
            <Card className="mb-3">
              <div className="flex flex-wrap gap-5">
                <div>
                  <div className="text-xl font-semibold" style={{ fontFamily: F_MONO }}>{moyenneGenerale} min</div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>en moyenne par séance</div>
                </div>
                <div>
                  <div className="text-xl font-semibold" style={{ fontFamily: F_MONO, color: EN_COURS }}>{moyenneRenfo} min</div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>
                    quand il y en a ({avecRenfo.length}/{releves.length} séances)
                  </div>
                </div>
                <div>
                  <div className="text-xl font-semibold" style={{ fontFamily: F_MONO, color: EN_COURS }}>{moyennePart} %</div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>du temps de séance</div>
                </div>
                <div>
                  <div className="text-xl font-semibold" style={{ fontFamily: F_MONO }}>{totalRenfo} min</div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>au total sur la période</div>
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
                Une séance sans renforcement compte comme zéro dans la moyenne générale : c'est ce qui
                la distingue de la moyenne « quand il y en a », calculée sur les seules séances concernées.
              </p>
            </Card>

            <Card>
              <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
                Répartition du temps de séance, séance par séance
              </div>
              <div style={{ height: 260 }} data-no-swipe>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graphe} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
                    <CartesianGrid stroke={BORDER} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontFamily: F_BODY, fontSize: 12 }} formatter={(v) => [`${v} min`]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Activité" stackId="t" fill={INK} isAnimationActive={false} />
                    <Bar dataKey="Renforcement" stackId="t" fill={EN_COURS} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </>
        );
      })()}

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
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontFamily: F_BODY, fontSize: 12 }} labelFormatter={(l) => l} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="d" dataKey="crises" name="Crises" fill={CRISE} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line yAxisId="g" type="monotone" dataKey="autonomie" name="Autonomie (%)" stroke={ACQUIS} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
              Une évolution parallèle n'établit aucun lien de cause à effet : le graphique sert à
              repérer un moment à examiner, pas à conclure.
            </p>
          </Card>
        )
      )}
    </div>
  );
}

const MESURES = [
  { k: 'cotations', label: 'Nombre de cotations', source: 'cotations', agg: 'compte' },
  { k: 'autonomie', label: "Taux d'autonomie moyen", source: 'cotations', agg: 'moyenne', champ: 'score', suffixe: ' %' },
  { k: 'seances', label: 'Nombre de séances', source: 'cotations', agg: 'distinct', champ: 'seanceId' },
  { k: 'crises', label: 'Nombre de crises et observations', source: 'crises', agg: 'compte' },
  { k: 'dureeCrises', label: 'Durée totale des crises', source: 'crises', agg: 'somme', champ: 'minutes', suffixe: ' min' },
  { k: 'renfo', label: 'Temps de renforcement', source: 'renforcements', agg: 'somme', champ: 'minutes', suffixe: ' min' },
  { k: 'renfoMoyen', label: 'Renforcement moyen par séance', source: 'renforcements', agg: 'moyenne', champ: 'minutes', suffixe: ' min' },
];

const DIMENSIONS = [
  { k: 'aucune', label: 'Aucune', get: () => 'Total' },
  { k: 'personne', label: 'Personne', get: (f) => f.personne },
  { k: 'atelier', label: 'Atelier', get: (f) => f.atelier },
  { k: 'intervenant', label: 'Intervenant', get: (f) => f.intervenant || 'Non renseigné' },
  { k: 'objectif', label: 'Objectif', get: (f) => f.objectif || '—' },
  { k: 'type', label: 'Type', get: (f) => f.type || '—' },
  { k: 'phase', label: 'Phase', get: (f) => f.phase || '—' },
  { k: 'intensite', label: 'Intensité', get: (f) => f.intensite || '—' },
  { k: 'jour', label: 'Jour de la semaine', get: (f) => new Date(f.date).toLocaleDateString('fr-FR', { weekday: 'long' }) },
  { k: 'semaine', label: 'Semaine', get: (f) => etiquetteAgregation(cleAgregation(f.date, 'semaine'), 'semaine') },
  { k: 'mois', label: 'Mois', get: (f) => etiquetteAgregation(cleAgregation(f.date, 'mois'), 'mois') },
];

function agreger(faits, mesure) {
  if (!faits.length) return null;
  if (mesure.agg === 'compte') return faits.length;
  if (mesure.agg === 'distinct') return new Set(faits.map((f) => f[mesure.champ])).size;
  const valeurs = faits.map((f) => f[mesure.champ]).filter((v) => v != null);
  if (!valeurs.length) return null;
  const somme = valeurs.reduce((a, b) => a + b, 0);
  return mesure.agg === 'somme' ? Math.round(somme) : Math.round(somme / valeurs.length);
}

function ExplorerScreen({ donnees, periode, setPeriode }) {
  const [ligneDim, setLigneDim] = useState('personne');
  const [colonneDim, setColonneDim] = useState('semaine');
  const [mesureK, setMesureK] = useState('autonomie');

  const faits = useMemo(() => construireFaits(donnees), [donnees.seances, donnees.crises, donnees.sources, donnees._idVersInitiales]);
  const mesure = MESURES.find((m) => m.k === mesureK);
  const dimL = DIMENSIONS.find((d) => d.k === ligneDim);
  const dimC = DIMENSIONS.find((d) => d.k === colonneDim);

  const base = (faits[mesure.source] || []).filter((f) => dansPeriode(f.date, periode));

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
  const L = trierTemps(ligneDim, lignesCles);
  const C = trierTemps(colonneDim, colonnesCles);

  const valeurCellule = (l, c) => agreger(cellules.get(`${l}||${c}`) || [], mesure);
  const totalLigne = (l) => agreger(base.filter((f) => dimL.get(f) === l), mesure);
  const totalColonne = (c) => agreger(base.filter((f) => dimC.get(f) === c), mesure);
  const totalGeneral = agreger(base, mesure);

  /* Échelle de couleur : repérer d'un coup d'œil les cases fortes */
  const toutes = L.flatMap((l) => C.map((c) => valeurCellule(l, c))).filter((v) => v != null);
  const maxi = toutes.length ? Math.max(...toutes) : 0;

  function exporterCsv() {
    const sep = ';';
    const echapper = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lignes = [[dimL.label, ...C, 'Total'].map(echapper).join(sep)];
    L.forEach((l) => {
      lignes.push([l, ...C.map((c) => valeurCellule(l, c)), totalLigne(l)].map(echapper).join(sep));
    });
    lignes.push(['Total', ...C.map((c) => totalColonne(c)), totalGeneral].map(echapper).join(sep));
    const blob = new Blob(['\uFEFF' + lignes.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `croisement-${mesure.k}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* Sans séance importée, le croisement n'a rien à montrer — mais le lecteur de
     rapport tableur, lui, reste utilisable : il ne dépend d'aucun import. */
  if (!donnees.seances.length) {
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
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }}>
              {MESURES.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>En lignes</div>
            <select value={ligneDim} onChange={(e) => setLigneDim(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }}>
              {DIMENSIONS.map((d) => <option key={d.k} value={d.k}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>En colonnes</div>
            <select value={colonneDim} onChange={(e) => setColonneDim(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent" style={{ borderColor: BORDER, color: INK }}>
              {DIMENSIONS.map((d) => <option key={d.k} value={d.k}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
          Toutes les dimensions ne s'appliquent pas à toutes les mesures : croiser un objectif
          avec un nombre de crises n'a pas de sens, la colonne restera vide.
        </p>
      </Card>

      <SelecteurPeriode periode={periode} setPeriode={setPeriode} />

      <Card className="mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs uppercase tracking-wide" style={{ color: INK_SOFT }}>
            {mesure.label} · {libellePeriode(periode)}
          </span>
          <Btn variant="outline" onClick={exporterCsv} disabled={!L.length} className="text-xs py-1.5">
            <Download size={14} /> CSV
          </Btn>
        </div>

        {L.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: INK_SOFT }}>Aucune donnée pour cette combinaison.</p>
        ) : (
          <div data-no-swipe style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th className="text-left px-2 py-2 whitespace-nowrap"
                    style={{ borderBottom: `2px solid ${BORDER}`, backgroundColor: CARD, position: 'sticky', top: 0, left: 0, zIndex: 2, color: INK_SOFT }}>
                    {dimL.label}
                  </th>
                  {C.map((c) => (
                    <th key={c} className="text-right px-2 py-2 whitespace-nowrap"
                      style={{ borderBottom: `2px solid ${BORDER}`, backgroundColor: CARD, position: 'sticky', top: 0, color: INK_SOFT }}>
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
                    <td className="px-2 py-1.5 whitespace-nowrap font-medium"
                      style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: CARD, position: 'sticky', left: 0 }}>
                      {l}
                    </td>
                    {C.map((c) => {
                      const v = valeurCellule(l, c);
                      const intensite = v != null && maxi ? v / maxi : 0;
                      return (
                        <td key={c} className="px-2 py-1.5 text-right whitespace-nowrap"
                          style={{ borderBottom: `1px solid ${BORDER}`, fontFamily: F_MONO,
                            backgroundColor: v == null ? 'transparent' : `rgba(26, 52, 92, ${0.05 + intensite * 0.25})` }}>
                          {v == null ? '' : `${v}${mesure.suffixe || ''}`}
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
function RapportScreen({ donnees, lignes, selection, setSelection, logo, association, onLogo, onAssociation, onAlias, onCommentaire, onCodeEfl, onComposerBilan, onEnregistrer, onOuvrirRapport, onSupprimerRapport }) {
  const [avecGraphiques, setAvecGraphiques] = useState(true);
  const [style, setStyle] = useState('ligne');
  const [nomRapport, setNomRapport] = useState('');

  if (!donnees.personnes.length) return <Empty>Importez une sauvegarde pour composer un rapport.</Empty>;

  const personne = selection.personne || donnees.personnes[0].initials;
  const periode = selection.periode || periodeVide();

  const disponibles = lignes.filter((l) => l.initials === personne);
  const retenus = disponibles
    .filter((l) => (selection.objectifs || []).includes(l.objectif))
    .map((l) => ({ ...l, points: l.points.filter((pt) => dansPeriode(pt.date, periode)) }));

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
            Objectifs à inclure, leur code EFL et leur libellé dans le document
          </div>
          <div className="space-y-1.5">
            {disponibles.map((l) => {
              const coche = (selection.objectifs || []).includes(l.objectif);
              return (
                <div key={l.objectif} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ backgroundColor: PAPER }}>
                  <button onClick={() => basculer(l.objectif)}
                    className="w-5 h-5 rounded border flex items-center justify-center shrink-0 text-xs"
                    style={{ borderColor: coche ? INK : BORDER, backgroundColor: coche ? INK : 'transparent', color: '#fff' }}>
                    {coche ? '✓' : ''}
                  </button>
                  <input value={(donnees.codesEfl || {})[l.objectif] || ''}
                    onChange={(e) => onCodeEfl(l.objectif, e.target.value)}
                    placeholder="EFL"
                    title="Code du référentiel, repris à côté de l'objectif dans le document"
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
            Le code EFL est attaché à l'objectif : saisi une fois, il vaut pour toutes les personnes qui le travaillent.
          </p>
        </div>

        <button onClick={() => setAvecGraphiques((v) => !v)} className="flex items-center gap-1.5 text-xs mb-3" style={{ color: INK_SOFT }}>
          <span className="w-9 h-5 rounded-full relative shrink-0" style={{ backgroundColor: avecGraphiques ? INK : BORDER }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white" style={{ left: avecGraphiques ? '1.25rem' : '0.125rem', transition: 'left .15s' }} />
          </span>
          Inclure les graphiques
        </button>
        {avecGraphiques && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {STYLES_GRAPHIQUE.map((g) => <Chip key={g.k} label={g.label} on={style === g.k} onClick={() => setStyle(g.k)} />)}
          </div>
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

      <div className="rounded-2xl border p-6" style={{ borderColor: BORDER, backgroundColor: CARD }}>
        <div className="flex items-start justify-between gap-4 pb-4 mb-5" style={{ borderBottom: `2px solid ${INK}` }}>
          <div className="min-w-0">
            <div className="text-lg font-semibold" style={{ fontFamily: F_DISPLAY }}>{association || 'Bilan de suivi'}</div>
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
            return (
              <div key={i} className="mb-6 pb-5" style={{ breakInside: 'avoid', borderBottom: i < retenus.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="text-base font-semibold min-w-0 break-words" style={{ fontFamily: F_DISPLAY }}>
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
                  {l.points.length} séance{l.points.length !== 1 ? 's' : ''} sur la période
                  {dernier != null && ` · dernier résultat ${dernier} %`}
                  {l.threshold != null && ` · critère ${l.threshold} % sur ${l.needed} séances`}
                </div>

                {(() => {
                  const enMesure = !l.points.length && (l.mesures || []).length > 0;
                  if (!enMesure) {
                    return avecGraphiques && l.points.length > 0 ? (
                      <div className="mb-3"><Graphique points={l.points} style={style} seuil={l.threshold} hauteur={180} /></div>
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
                          <Graphique points={journalieres} style={style} seuil={null} hauteur={180} unite={l.unite} />
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
      <div className="text-base font-semibold mb-1" style={{ fontFamily: F_DISPLAY }}>Bilan des crises</div>
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
      {erreur && <p className="text-xs rounded-lg px-2.5 py-2" style={{ color: '#fff', backgroundColor: NON_ACQUIS }}>{erreur}</p>}

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
                className="rounded-lg border px-2 py-1.5 text-xs bg-transparent"
                style={{ borderColor: filtres[j] ? INK : BORDER, color: filtres[j] ? INK : INK_SOFT }}>
                <option value="">{String(h)} : tout</option>
                {valeursDistinctes[j].map((v) => <option key={v} value={v}>{v || '(vide)'}</option>)}
              </select>
            ) : null))}
          </div>

          <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }} data-no-swipe>
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
function GestionScreen({ donnees, securite, onImported, onChangerMotDePasse, onRetirerProtection, onPurger, notify }) {
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
    onImported(fusionnerImport(donnees, backup, nom.replace(/\.json$/i, '')));
    setFichier(null); setEnveloppe(null); setPassphrase('');
  }

  /* Fichier venu d'un autre Manager : on reprend ses sources telles quelles,
     pour que le rapprochement des personnes reste cohérent. */
  function integrerManager(paquet) {
    let cumul = donnees;
    (paquet.sources || []).forEach((src) => {
      const table = (paquet._idVersInitiales || {})[src] || {};
      const backup = {
        students: Object.entries(table).map(([id, initials]) => ({ id, initials })),
        ateliers: Object.entries((paquet._ateliers || {})[src] || {}).map(([id, name]) => ({ id, name })),
        intervenants: Object.entries((paquet._intervenants || {})[src] || {}).map(([id, name]) => ({ id, name })),
        sessions: (paquet.seances || []).filter((s) => s.source === src),
        crises: (paquet.crises || []).filter((c) => c.source === src),
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

  function construirePaquet(initialesRetenues) {
    const garder = initialesRetenues.length ? new Set(initialesRetenues) : null;
    const ini = (source, sid) => ((donnees._idVersInitiales || {})[source] || {})[sid];
    const personnes = donnees.personnes.filter((p) => !garder || garder.has(p.initials));
    const seances = donnees.seances.filter((s) => !garder || (s.studentIds || []).some((sid) => garder.has(ini(s.source, sid))));
    const crises = donnees.crises.filter((c) => !garder || garder.has(ini(c.source, c.studentId)));
    const alias = { personnes: {}, objectifs: {} };
    Object.entries(donnees.alias.personnes || {}).forEach(([k, v]) => { if (!garder || garder.has(k)) alias.personnes[k] = v; });
    Object.entries(donnees.alias.objectifs || {}).forEach(([k, v]) => { if (!garder || garder.has(k.split('|')[0])) alias.objectifs[k] = v; });
    const commentaires = {};
    Object.entries(donnees.commentaires || {}).forEach(([k, v]) => { if (!garder || garder.has(k.split('|')[0])) commentaires[k] = v; });
    /* Les codes EFL ne dépendent d'aucune personne : ils partent en entier,
       même sur un export restreint à quelques personnes. */
    const codesEfl = { ...(donnees.codesEfl || {}) };

    return {
      format: 'aba-manager-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      personnes, seances, crises,
      sources: donnees.sources,
      _idVersInitiales: donnees._idVersInitiales,
      _ateliers: donnees._ateliers,
      _intervenants: donnees._intervenants,
      alias, commentaires, codesEfl,
    };
  }

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
        {erreur && <p className="text-xs mt-2 rounded-lg px-2.5 py-2" style={{ color: '#fff', backgroundColor: NON_ACQUIS }}>{erreur}</p>}
        {donnees.sources.length > 0 && (
          <p className="text-xs mt-3" style={{ color: INK_SOFT }}>Sources importées : {donnees.sources.join(', ')}</p>
        )}
      </Card>

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
                        const seances = d.seances.filter((x) => x.source !== src);
                        const crises = d.crises.filter((x) => x.source !== src);
                        /* Une personne qui n'apparaît plus nulle part disparaît aussi */
                        const encore = new Set();
                        Object.values(reste).forEach((t) => Object.values(t).forEach((i) => encore.add(i)));
                        return {
                          ...d, seances, crises, sources: d.sources.filter((x) => x !== src),
                          _idVersInitiales: reste, _ateliers: ate, _intervenants: inter,
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
                      const alias = {
                        personnes: { ...(d.alias.personnes || {}) },
                        objectifs: Object.fromEntries(Object.entries(d.alias.objectifs || {}).filter(([k]) => k.split('|')[0] !== pp.initials)),
                      };
                      delete alias.personnes[pp.initials];
                      const commentaires = Object.fromEntries(Object.entries(d.commentaires || {}).filter(([k]) => k.split('|')[0] !== pp.initials));
                      const idVers = {};
                      Object.entries(d._idVersInitiales || {}).forEach(([src, t]) => {
                        idVers[src] = Object.fromEntries(Object.entries(t).filter(([, i]) => i !== pp.initials));
                      });
                      return {
                        ...d, seances, crises, alias, commentaires,
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
function ManagerApp() {
  const [donnees, setDonnees] = useState(VIDE);
  const [loaded, setLoaded] = useState(false);
  const [securite, setSecurite] = useState({ pinHash: null, pinSalt: null });
  const [secuLue, setSecuLue] = useState(false);
  const [verrouille, setVerrouille] = useState(true);
  const [tab, setTab] = useState('bord');
  const [toast, setToast] = useState('');
  const [logo, setLogo] = useState(null);
  const [association, setAssociation] = useState('');
  const [periode, setPeriode] = useState(periodeVide());
  const [focus, setFocus] = useState(null);
  const [selectionRapport, setSelectionRapport] = useState({ personne: null, objectifs: [], periode: periodeVide(), bilanCrises: null });
  /* Composition d'un bilan de crise en cours, déclenchée depuis le rapport.
     Le jeton force la reprise des réglages à chaque nouvelle demande, même si
     la configuration est identique à la précédente. */
  const [compositionBilan, setCompositionBilan] = useState(null);
  /* Personne sur laquelle préselectionner le filtre en arrivant dans Crises,
     consommée aussitôt : l'utilisateur doit pouvoir l'enlever ensuite. */
  const [focusCrises, setFocusCrises] = useState(null);

  /* Le calcul ne dépend que des données analytiques. Sans cette séparation,
     taper une lettre dans un commentaire de rapport relançait l'analyse de
     tous les objectifs de tout le monde. */
  const lignes = useMemo(
    () => construireLignes(donnees),
    [donnees.seances, donnees.personnes, donnees.sources, donnees._idVersInitiales]
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
  }, []);

  function ecrireSecurite(s) {
    setSecurite(s);
    try { window.localStorage.setItem(SECU_KEY, JSON.stringify(s)); } catch (e) {}
  }

  async function deverrouiller(motDePasse) {
    let sec = securite;
    if (!sec.dataSalt) { sec = { ...sec, dataSalt: newSalt() }; ecrireSecurite(sec); }
    if (sec.failedAttempts || sec.lockUntil) { sec = { ...sec, failedAttempts: 0, lockUntil: 0 }; ecrireSecurite(sec); }
    dataKey = await deriveDataKey(motDePasse, sec.dataSalt);
    setVerrouille(false);
    setDonnees(await chargerDonnees());
    setLoaded(true);
  }

  /* Protection retirée : les données repassent en clair, aucun verrouillage */
  useEffect(() => {
    if (!secuLue || loaded || !securite.disabled) return;
    dataKey = null;
    setVerrouille(false);
    (async () => { setDonnees(await chargerDonnees()); setLoaded(true); })();
  }, [secuLue, securite.disabled, loaded]);

  useEffect(() => {
    if (loaded) sauverDonnees(donnees);
  }, [donnees, loaded]);

  useEffect(() => {
    if (!securite.pinHash || verrouille || securite.disabled) return undefined;
    let minuteur = null;
    const relancer = () => { clearTimeout(minuteur); minuteur = setTimeout(() => setVerrouille(true), 15 * 60 * 1000); };
    const surVisibilite = () => { if (document.visibilityState === 'hidden') setVerrouille(true); };
    document.addEventListener('visibilitychange', surVisibilite);
    ['mousedown', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, relancer));
    relancer();
    return () => {
      clearTimeout(minuteur);
      document.removeEventListener('visibilitychange', surVisibilite);
      ['mousedown', 'keydown', 'touchstart'].forEach((e) => document.removeEventListener(e, relancer));
    };
  }, [securite.pinHash, securite.disabled, verrouille]);

  async function changerMotDePasse(nouveau) {
    const pinSalt = newSalt();
    const dataSalt = newSalt();
    const pinHash = await hashPin(nouveau, pinSalt);
    ecrireSecurite({ ...securite, disabled: false, pinHash, pinSalt, dataSalt, failedAttempts: 0, lockUntil: 0 });
    dataKey = await deriveDataKey(nouveau, dataSalt);
    await sauverDonnees(donnees); // rechiffrées avec la nouvelle clé
    notify('Mot de passe modifié');
  }

  async function retirerProtection() {
    const texte = JSON.stringify(donnees);
    dataKey = null;
    try { window.localStorage.setItem(STORE_KEY, texte); } catch (e) {}
    ecrireSecurite({ disabled: true, pinHash: null, pinSalt: null, dataSalt: null, failedAttempts: 0, lockUntil: 0 });
    setVerrouille(false);
    notify('Protection retirée, données déchiffrées');
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

  /* Toute purge passe par ici : un seul point d'écriture, un seul message. */
  function purger(transformer) {
    setDonnees((d) => {
      const suite = transformer(d);
      return { ...suite, nbNouvellesSeances: undefined, nbNouvellesCrises: undefined };
    });
    notify('Données purgées');
  }

  function onImported(fusion) {
    setDonnees(fusion);
    if (fusion.nbNouvellesSeances != null) {
      notify(`${fusion.nbNouvellesSeances} nouvelle(s) séance(s), ${fusion.nbNouvellesCrises} nouvelle(s) crise(s)`);
    }
    setTab('bord');
  }
  function ouvrirPersonne(initiales, objectif) {
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
  function ouvrirCrises(initiales) {
    setFocusCrises(initiales || null);
    setTab('crises');
  }

  const onglets = [
    { k: 'bord', l: 'Tableau de bord', icone: LayoutDashboard },
    { k: 'seances', l: 'Séances', icone: CalendarDays },
    { k: 'personnes', l: 'Personnes accompagnées', icone: Users },
    { k: 'crises', l: 'Crises', icone: AlertTriangle },
    { k: 'explorer', l: 'Explorer', icone: Grid3x3 },
    { k: 'rapport', l: 'Rapport', icone: FileText },
    { k: 'gestion', l: 'Gestion', icone: Settings },
  ];

  /* Balayage entre onglets, pour l'usage sur mobile. */
  const rangActuel = onglets.findIndex((t) => t.k === tab);
  const allerA = (n) => {
    if (n < 0 || n >= onglets.length) return;
    setTab(onglets[n].k);
    window.scrollTo({ top: 0 });
  };
  const balayage = useBalayage(() => allerA(rangActuel + 1), () => allerA(rangActuel - 1));

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
          setDonnees(await chargerDonnees());
          setLoaded(true);
        }}
      />
    );
  }

  if (!loaded) return <div className="min-h-screen flex items-center justify-center" style={{ background: PAPER }}>Chargement…</div>;

  return (
    <div ref={balayage.ref} className="min-h-screen" style={{ background: PAPER, color: INK, fontFamily: F_BODY }}>
      <div
        className="max-w-5xl mx-auto px-6 py-6"
        style={{
          transform: balayage.decalage ? `translateX(${balayage.decalage}px)` : 'none',
          transition: balayage.enCours ? 'none' : 'transform .2s ease-out',
        }}
      >
        <div className="flex items-baseline justify-between gap-4 mb-4 no-print">
          <h1 className="text-xl font-semibold" style={{ fontFamily: F_DISPLAY }}>DatABA Manager</h1>
          <span className="text-xs" style={{ color: INK_SOFT }}>
            {donnees.personnes.length} personne{donnees.personnes.length !== 1 ? 's' : ''} · {donnees.seances.length} séance{donnees.seances.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-6 no-print">
          {onglets.map((t) => {
            const Icone = t.icone;
            const on = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                className="flex-1 min-w-[110px] rounded-xl px-3 py-2.5 text-sm font-medium border flex items-center justify-center gap-1.5"
                style={{ fontFamily: F_DISPLAY, borderColor: on ? INK : BORDER,
                  backgroundColor: on ? INK : 'transparent', color: on ? '#fff' : INK_SOFT }}>
                <Icone size={15} /> <span className="hidden sm:inline">{t.l}</span>
              </button>
            );
          })}
        </div>

        <div className="no-print">
          {tab === 'bord' && (
            <>
              <SectionTitle sub="L'avancée récente, d'un coup d'œil." icone={LayoutDashboard}>Tableau de bord</SectionTitle>
              <TableauDeBord donnees={donnees} lignes={lignes} periode={periode} setPeriode={setPeriode}
                onOuvrirPersonne={ouvrirPersonne} onOuvrirCrises={() => ouvrirCrises(null)} />
            </>
          )}
          {tab === 'seances' && (
            <>
              <SectionTitle sub="Consulter ce qui a été importé, et vérifier l'accord entre observateurs." icone={CalendarDays}>Séances</SectionTitle>
              <SeancesScreen donnees={donnees} onSupprimerSeance={supprimerSeance} />
            </>
          )}
          {tab === 'personnes' && (
            <>
              <SectionTitle sub="Le suivi complet, personne par personne." icone={Users}>Personnes accompagnées</SectionTitle>
              <PersonnesScreen donnees={donnees} lignes={lignes} focus={focus} setFocus={setFocus}
                periode={periode} setPeriode={setPeriode} onRapport={lancerRapport}
                onRapportCrises={lancerRapportCrises} onOuvrirCrises={ouvrirCrises} />
            </>
          )}
          {tab === 'crises' && (
            <>
              <SectionTitle icone={AlertTriangle} sub="Ce qui déclenche, ce qui se produit, ce qui suit.">Crises</SectionTitle>
              <CrisesScreen donnees={donnees} periode={periode} setPeriode={setPeriode}
                focusPersonne={focusCrises} onFocusConsomme={() => setFocusCrises(null)}
                composition={compositionBilan} onValiderBilan={validerBilan} onAnnulerBilan={annulerBilan} />
            </>
          )}
          {tab === 'explorer' && (
            <>
              <SectionTitle icone={Grid3x3} sub="Croiser librement deux axes, comme un tableau croisé dynamique.">Explorer</SectionTitle>
              <ExplorerScreen donnees={donnees} periode={periode} setPeriode={setPeriode} />
            </>
          )}
          {tab === 'gestion' && (
            <>
              <SectionTitle sub="Import, export et sécurité." icone={Settings}>Gestion</SectionTitle>
              <GestionScreen donnees={donnees} securite={securite} onImported={onImported}
                onChangerMotDePasse={changerMotDePasse} onRetirerProtection={retirerProtection}
                onPurger={purger} notify={notify} />
            </>
          )}
        </div>

        {tab === 'rapport' && (
          <>
            <div className="no-print"><SectionTitle sub="Le document à transmettre ou à déposer dans Airmes." icone={FileText}>Rapport</SectionTitle></div>
            <RapportScreen donnees={donnees} lignes={lignes}
              selection={selectionRapport} setSelection={setSelectionRapport}
              logo={logo} association={association}
              onLogo={enregistrerLogo} onAssociation={enregistrerAssociation}
              onAlias={majAlias} onCommentaire={majCommentaire} onCodeEfl={majCodeEfl}
              onComposerBilan={composerBilan}
              onEnregistrer={enregistrerRapport} onOuvrirRapport={ouvrirRapport}
              onSupprimerRapport={supprimerRapport} />
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg no-print" style={{ backgroundColor: INK }}>
          {toast}
        </div>
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
