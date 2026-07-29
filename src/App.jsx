import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend,
} from 'recharts';

/* ==================== Palette et polices — reprises de l'app tablette,
   pour une identité visuelle cohérente entre les deux applications. ==================== */
const PAPER = '#FAF7F0';
const CARD = '#FFFFFF';
const INK = '#20291F';
const INK_SOFT = '#6B7266';
const BORDER = '#E3DDD0';
const ACQUIS = '#0F8B6C';
const EN_COURS = '#D69A2D';
const NON_ACQUIS = '#A8402F';
const F_DISPLAY = "'Space Grotesk', sans-serif";
const F_BODY = "'IBM Plex Sans', sans-serif";
const F_MONO = "'IBM Plex Mono', monospace";

/* ==================== Chiffrement ====================
   Fonctions identiques à celles de l'app tablette : même dérivation de clé,
   même schéma de chiffrement, pour lire les fichiers qu'elle produit sans
   rien avoir à adapter côté éducateur. */
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
async function deriveAesKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}
async function decryptEnvelope(envelope, passphrase) {
  const key = await deriveAesKey(passphrase, fromB64(envelope.salt));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function encryptJSON(obj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { format: 'aba-backup-encrypted', version: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) };
}

/* --- Verrouillage et chiffrement des données du poste ---
   Mêmes principes que sur DatABA : le code sert à la fois de verrou et de clé
   de chiffrement, et n'est jamais enregistré, seule son empreinte l'est. */
async function hashPin(pin, saltB64) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromB64(saltB64), iterations: 150000, hash: 'SHA-256' }, keyMaterial, 256);
  return toB64(bits);
}
function newSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}
let dataKey = null;
async function deriveDataKey(pin, saltB64) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(saltB64), iterations: 150000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
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

/* ==================== Stockage local du cadre ====================
   Un seul jeu de données, accumulé au fil des imports. localStorage suffit
   à ce stade ; si le volume devenait important sur plusieurs années et
   plusieurs tablettes, IndexedDB prendrait le relais sans changer l'usage. */
const STORE_KEY = 'aba-cadre:data';

const VIDE = { personnes: [], seances: [], crises: [], sources: [] };

async function chargerDonnees() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return VIDE;
    const texte = dataKey ? await decryptValue(raw, dataKey) : raw;
    return JSON.parse(texte);
  } catch (e) {
    return VIDE;
  }
}
async function sauverDonnees(d) {
  try {
    const texte = JSON.stringify(d);
    window.localStorage.setItem(STORE_KEY, dataKey ? await encryptValue(texte, dataKey) : texte);
  } catch (e) {
    /* silencieux : un échec d'écriture ne doit pas interrompre l'usage */
  }
}

/* Rapproche les personnes de sources différentes par leurs initiales — même
   principe que le rapprochement utilisé pour l'accord inter-observateurs sur
   la tablette. Deux personnes partageant les mêmes initiales sur deux
   tablettes différentes seraient à tort confondues : c'est la limite connue
   de cette approche, à traiter en amont si le cas se présente. */
function fusionnerImport(actuel, backup, nomSource) {
  const personnes = actuel.personnes.slice();
  const parInitiales = new Map(personnes.map((p) => [p.initials, p]));

  (backup.students || []).forEach((s) => {
    if (!parInitiales.has(s.initials)) {
      const p = { id: s.id, initials: s.initials, objectifsParTablette: {} };
      personnes.push(p);
      parInitiales.set(s.initials, p);
    }
  });

  // Table de correspondance id-tablette → initiales, pour cette source précise
  const idVersInitiales = new Map((backup.students || []).map((s) => [s.id, s.initials]));

  const seancesExistantes = new Set(actuel.seances.map((s) => s.id));
  const nouvellesSeances = (backup.sessions || []).filter((s) => !seancesExistantes.has(s.id));
  const seancesMaj = actuel.seances.filter((s) => !nouvellesSeances.some((n) => n.id === s.id));

  const seances = [...seancesMaj, ...nouvellesSeances].map((s) => ({ ...s, source: s.source || nomSource }));

  const crisesExistantes = new Set(actuel.crises.map((c) => c.id));
  const nouvellesCrises = (backup.crises || []).filter((c) => !crisesExistantes.has(c.id));
  const crises = [...actuel.crises.filter((c) => !nouvellesCrises.some((n) => n.id === c.id)), ...nouvellesCrises];

  const sources = actuel.sources.includes(nomSource) ? actuel.sources : [...actuel.sources, nomSource];

  return {
    personnes,
    seances,
    crises,
    sources,
    _idVersInitiales: { ...(actuel._idVersInitiales || {}), [nomSource]: Object.fromEntries(idVersInitiales) },
    nbNouvellesSeances: nouvellesSeances.length,
    nbNouvellesCrises: nouvellesCrises.length,
  };
}

/* Initiales d'une personne pour une séance donnée : la séance référence un
   identifiant propre à sa tablette d'origine, résolu via la table conservée
   à l'import de cette source. */
function initialesDe(donnees, seanceOuCrise, studentId) {
  const src = seanceOuCrise.source;
  const table = (donnees._idVersInitiales || {})[src] || {};
  return table[studentId] || '?';
}

/* ==================== Bilan à trois états ====================
   Reprend le calcul de critère déjà utilisé côté tablette (série de réussites
   consécutives face au seuil défini pour l'objectif), mais le fait tourner
   sur l'ensemble des personnes importées plutôt que sur une seule. */
function objectiveScoreValue(obj, entry, guidances) {
  if (!obj || !entry) return null;
  const gList = (obj.config && obj.config.guidanceSet) || guidances || [];
  const isIndep = (code) => {
    const g = gList.find((x) => x.code === code);
    return g ? !!g.independent : code === 'I';
  };
  if (obj.type === 'trials') {
    const trials = (entry.trials || []).map((t) => (t && typeof t === 'object' ? t.code : t)).filter(Boolean);
    if (!trials.length) return null;
    return Math.round((trials.filter(isIndep).length / trials.length) * 100);
  }
  if (obj.type === 'probe') {
    const v = entry.guidance != null ? entry.guidance : entry.value;
    if (v == null) return null;
    return typeof v === 'number' ? v * 100 : (isIndep(v) ? 100 : 0);
  }
  if (obj.type === 'chaining') {
    const steps = (obj.config && obj.config.steps) || [];
    const codes = steps.map((st) => (entry.steps || {})[st.id]).filter(Boolean);
    if (!codes.length) return null;
    return Math.round((codes.filter(isIndep).length / codes.length) * 100);
  }
  if (obj.type === 'balance') {
    const steps = (obj.config && obj.config.steps) || [];
    const outcomes = (obj.config && obj.config.balanceOutcomes) || [];
    const meta = (k) => outcomes.find((o) => o.k === k);
    const essais = Array.isArray(entry.trials) ? entry.trials : [{ steps: entry.steps || {} }];
    let reussi = 0, notes = 0;
    essais.forEach((es) => {
      steps.forEach((st) => {
        const e = (es.steps || {})[st.id];
        if (!e || !e.outcome) return;
        const m = meta(e.outcome);
        if (m && m.exclu) return;
        notes += 1;
        if (!m || m.reussite || e.outcome === 'reussi') reussi += 1;
      });
    });
    return notes ? Math.round((reussi / notes) * 100) : null;
  }
  return null;
}

function critereObjectif(obj) {
  const m = obj.config && obj.config.mastery;
  if (!m) return null;
  return { threshold: m.threshold || 80, needed: m.sessions || 3, unit: m.unit || 'sessions' };
}

/* Construit, pour une personne et un objectif, la série chronologique de
   scores puis en tire l'un des trois états : Acquis, En cours d'acquisition,
   ou Non acquis (aucune donnée). */
function statutObjectif(seances, studentIdParSource, obj, guidances) {
  const points = [];
  seances.forEach((s) => {
    const sid = studentIdParSource[s.source];
    if (!sid || !(s.selectedObjectives || {})[sid]) return;
    const oid = Object.keys(s.objectiveSnapshot || {}).find((k) => s.objectiveSnapshot[k].name === obj.name);
    if (!oid) return;
    const entry = (s.data || {})[sid] && s.data[sid][oid];
    const score = objectiveScoreValue(s.objectiveSnapshot[oid], entry, guidances);
    if (score != null) points.push({ date: s.date, value: score });
  });
  points.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!points.length) return { etat: 'non_acquis', points };

  const crit = critereObjectif(obj);
  if (!crit) return { etat: 'en_cours', points };

  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].value >= crit.threshold) streak += 1;
    else break;
  }
  const acquis = streak >= crit.needed;
  return { etat: acquis ? 'acquis' : 'en_cours', points, streak, needed: crit.needed, threshold: crit.threshold };
}

const ETATS = {
  acquis: { label: 'Acquis', color: ACQUIS },
  en_cours: { label: "En cours d'acquisition", color: EN_COURS },
  non_acquis: { label: 'Non acquis', color: NON_ACQUIS },
};

/* ==================== Accord inter-observateurs ====================
   Les paires sont repérées seules : deux séances du même jour, marquées
   « deux observateurs en parallèle », venues de sources différentes. Le cadre
   n'a rien à apparier à la main. */
function ioaPourEntree(obj, ea, eb) {
  if (!ea || !eb) return null;
  const t = obj.type;
  const codeEssai = (x) => (x && typeof x === 'object' ? x.code : x);

  if (t === 'trials') {
    const n = Math.max((ea.trials || []).length, (eb.trials || []).length);
    let pts = 0, acc = 0;
    for (let i = 0; i < n; i++) {
      const a = codeEssai((ea.trials || [])[i]);
      const b = codeEssai((eb.trials || [])[i]);
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
        const oa = a && a.outcome;
        const ob = b && b.outcome;
        if (!oa && !ob) return;
        pts += 1;
        if (oa === ob) acc += 1;
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
  /* Mesures continues : l'accord exact n'aurait pas de sens, on retient le
     rapport entre la plus petite et la plus grande valeur. */
  const proportionnel = (a, b) => (!a && !b ? null : { points: 1, accords: Math.min(a, b) / Math.max(a, b), proportionnel: true });
  if (t === 'occurrence') return proportionnel(ea.count || 0, eb.count || 0);
  if (t === 'timer') return proportionnel(ea.elapsedMs || 0, eb.elapsedMs || 0);
  if (t === 'latency') {
    const moy = (l) => (l && l.length ? l.reduce((x, y) => x + y, 0) / l.length : 0);
    return proportionnel(moy(ea.latencies), moy(eb.latencies));
  }
  return null;
}

function trouverPaires(donnees) {
  const candidates = donnees.seances.filter((s) => s.doubleCotation);
  const parJour = new Map();
  candidates.forEach((s) => {
    const jour = new Date(s.date).toLocaleDateString('fr-FR');
    const cle = `${jour}|${s.atelierId || 'libre'}`;
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle).push(s);
  });

  const paires = [];
  parJour.forEach((liste, cle) => {
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        // Deux relevés de la même séance viennent forcément d'appareils différents
        if (liste[i].source === liste[j].source) continue;
        paires.push({ cle, jour: cle.split('|')[0], a: liste[i], b: liste[j] });
      }
    }
  });
  return paires;
}

function comparerPaire(paire, donnees) {
  const lignes = [];
  const initialesDe = (sess, sid) => ((donnees._idVersInitiales || {})[sess.source] || {})[sid] || '?';

  (paire.a.studentIds || []).forEach((sidA) => {
    const ini = initialesDe(paire.a, sidA);
    const sidB = (paire.b.studentIds || []).find((id) => initialesDe(paire.b, id) === ini);
    if (!sidB) return;

    (paire.a.selectedObjectives[sidA] || []).forEach((oidA) => {
      const objA = (paire.a.objectiveSnapshot || {})[oidA];
      if (!objA) return;
      const oidB = (paire.b.selectedObjectives[sidB] || []).find(
        (o) => ((paire.b.objectiveSnapshot || {})[o] || {}).name === objA.name
      );
      if (!oidB) return;
      const r = ioaPourEntree(objA, (paire.a.data[sidA] || {})[oidA], (paire.b.data[sidB] || {})[oidB]);
      if (!r) return;
      lignes.push({ initials: ini, objectif: objA.name, type: objA.type, ...r, pct: Math.round((r.accords / r.points) * 100) });
    });
  });

  const points = lignes.reduce((a, l) => a + l.points, 0);
  const accords = lignes.reduce((a, l) => a + l.accords, 0);
  return { lignes, points, accords, pct: points ? Math.round((accords / points) * 100) : null };
}

function AccordScreen({ donnees }) {
  const paires = trouverPaires(donnees);
  const [choisie, setChoisie] = useState(null);

  if (paires.length === 0) {
    return (
      <Card>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Aucune séance en double cotation détectée. Pour qu'une paire apparaisse ici, les deux
          intervenants doivent avoir coché <strong>« Deux observateurs en parallèle »</strong> dans
          DatABA, sur la même séance et le même jour, chacun sur son appareil.
        </p>
      </Card>
    );
  }

  const res = choisie ? comparerPaire(choisie, donnees) : null;
  const couleur = res && res.pct != null ? (res.pct >= 80 ? ACQUIS : res.pct >= 60 ? EN_COURS : NON_ACQUIS) : INK_SOFT;

  return (
    <div>
      <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
        {paires.length} paire{paires.length !== 1 ? 's' : ''} de relevés détectée{paires.length !== 1 ? 's' : ''}.
        Sélectionnez-en une pour mesurer l'accord entre les deux observateurs.
      </p>

      <div className="space-y-1.5 mb-4">
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
              En dessous, il vaut mieux reprendre ensemble les définitions avant de poursuivre.
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
      setErreur(delai ? 'Code incorrect — saisie suspendue' : 'Code incorrect');
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

  const titres = {
    enter: attente ? 'Saisie suspendue' : 'DatABA Manager',
    create1: 'Protéger ce poste',
    create2: 'Confirmez',
  };
  const soustitres = {
    enter: attente
      ? `Trop d'essais. Nouvel essai possible dans ${Math.ceil((bloqueJusqua - now) / 1000)} s.`
      : 'Saisissez votre mot de passe',
    create1: "Ce mot de passe verrouille l'accès et chiffre les données consolidées sur cet ordinateur.",
    create2: 'Ressaisissez le même mot de passe',
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAPER, fontFamily: F_BODY }}>
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-center mb-1" style={{ fontFamily: F_DISPLAY, color: INK }}>{titres[step]}</h1>
        <p className="text-sm text-center mb-5" style={{ color: INK_SOFT }}>{soustitres[step]}</p>
        {erreur && <p className="text-sm text-center mb-3" style={{ color: NON_ACQUIS }}>{erreur}</p>}
        <input
          type="password"
          value={valeur}
          autoFocus
          disabled={attente}
          onChange={(e) => setValeur(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') valider(); }}
          placeholder="Mot de passe"
          className="w-full rounded-xl border px-3 py-3 text-base bg-transparent mb-3"
          style={{ borderColor: BORDER, color: INK }}
        />
        <Btn onClick={valider} disabled={attente || valeur.length < 4} className="w-full">
          {step === 'enter' ? 'Déverrouiller' : step === 'create1' ? 'Continuer' : 'Valider'}
        </Btn>
        <p className="text-xs text-center mt-3" style={{ color: INK_SOFT }}>Au moins 4 caractères.</p>

        {step === 'enter' && (
          <div className="text-center mt-6">
            <button onClick={() => setReset(true)} className="text-xs underline" style={{ color: INK_SOFT }}>
              Mot de passe oublié ?
            </button>
          </div>
        )}
        {reset && (
          <div className="rounded-2xl border p-4 mt-4" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <p className="text-sm mb-3" style={{ color: INK_SOFT }}>
              Les données consolidées sont chiffrées avec ce mot de passe : sans lui, elles ne sont pas
              récupérables. Vous pouvez tout effacer et réimporter les sauvegardes depuis le dossier partagé.
            </p>
            <div className="flex gap-2">
              <Btn onClick={() => { window.localStorage.clear(); window.location.reload(); }} className="flex-1 text-sm" style={{ backgroundColor: NON_ACQUIS }}>
                Effacer et recommencer
              </Btn>
              <Btn variant="ghost" onClick={() => setReset(false)} className="text-sm">Annuler</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== Composants d'interface ==================== */
function Btn({ children, onClick, variant = 'solid', className = '', disabled, style }) {
  const base = 'rounded-xl px-4 py-2.5 font-medium text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-40';
  const styles =
    variant === 'solid'
      ? { backgroundColor: INK, color: '#fff' }
      : variant === 'outline'
      ? { backgroundColor: 'transparent', color: INK, border: `1px solid ${BORDER}` }
      : { backgroundColor: 'transparent', color: INK_SOFT };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${className}`} style={{ fontFamily: F_DISPLAY, ...styles, ...style }}>
      {children}
    </button>
  );
}
function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`} style={{ borderColor: BORDER, backgroundColor: CARD }}>
      {children}
    </div>
  );
}

/* ==================== Écran d'import ==================== */
function ImportScreen({ donnees, onImported }) {
  const [passphrase, setPassphrase] = useState('');
  const [fichier, setFichier] = useState(null);
  const [enveloppe, setEnveloppe] = useState(null);   // sauvegarde chiffrée en attente de clé
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  /* Le format est reconnu au contenu, pas à l'extension : selon les systèmes,
     un filtre trop strict masque des fichiers pourtant valides. */
  async function analyser(f) {
    setErreur('');
    setEnveloppe(null);
    setFichier(f);
    if (!f) return;

    if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
      setErreur(
        "Ce fichier est un rapport tableur, pas une sauvegarde. Dans DatABA, allez dans " +
        "Export → « Générer le fichier pour Manager », ou Gestion → Sauvegarde → Exporter."
      );
      setFichier(null);
      return;
    }

    let contenu;
    try {
      contenu = JSON.parse(await f.text());
    } catch (e) {
      setErreur("Ce fichier n'est pas lisible. Attendu : une sauvegarde DatABA au format .json.");
      setFichier(null);
      return;
    }

    if (contenu.format === 'aba-backup-encrypted') {
      setEnveloppe(contenu);            // clé requise
      return;
    }
    if (contenu.format === 'aba-backup') {
      await integrer(contenu, f.name);  // sauvegarde en clair, rien à déchiffrer
      return;
    }
    if (contenu.format === 'aba-config') {
      setErreur("Ce fichier ne contient que la configuration, sans aucune séance. Exportez une sauvegarde complète.");
      setFichier(null);
      return;
    }
    setErreur("Format non reconnu. Attendu : une sauvegarde DatABA, chiffrée ou non.");
    setFichier(null);
  }

  async function integrer(backup, nomFichier) {
    const nomSource = nomFichier.replace(/\.json$/i, '');
    onImported(fusionnerImport(donnees, backup, nomSource));
    setFichier(null);
    setEnveloppe(null);
    setPassphrase('');
  }

  async function dechiffrer() {
    if (!enveloppe || passphrase.length < 1) return;
    setEnCours(true);
    setErreur('');
    try {
      const backup = await decryptEnvelope(enveloppe, passphrase);
      await integrer(backup, fichier.name);
    } catch (e) {
      setErreur('Mot de passe incorrect ou fichier corrompu.');
    }
    setEnCours(false);
  }

  return (
    <Card className="mb-4">
      <div className="text-sm font-semibold mb-2" style={{ fontFamily: F_DISPLAY }}>Importer une sauvegarde DatABA</div>
      <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
        Récupérez le fichier déposé par l'éducateur, sélectionnez-le ici. S'il est chiffré, la clé
        vous sera demandée. Les séances déjà connues sont mises à jour, les nouvelles s'ajoutent —
        rien n'est dupliqué.
      </p>

      <input
        type="file"
        onChange={(e) => analyser(e.target.files && e.target.files[0])}
        className="w-full text-sm mb-2"
      />

      {enveloppe && (
        <>
          <p className="text-xs mb-2" style={{ color: INK_SOFT }}>
            Sauvegarde chiffrée détectée — saisissez la clé transmise par l'éducateur.
          </p>
          <input
            type="password"
            value={passphrase}
            autoFocus
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') dechiffrer(); }}
            placeholder="Mot de passe de la sauvegarde"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent mb-2"
            style={{ borderColor: BORDER, color: INK }}
          />
          <Btn onClick={dechiffrer} disabled={!passphrase || enCours} className="w-full">
            {enCours ? 'Déchiffrement…' : 'Déchiffrer et importer'}
          </Btn>
        </>
      )}

      {erreur && (
        <p className="text-xs mt-2 rounded-lg px-2.5 py-2" style={{ color: '#fff', backgroundColor: NON_ACQUIS }}>
          {erreur}
        </p>
      )}

      {donnees.sources.length > 0 && (
        <p className="text-xs mt-3" style={{ color: INK_SOFT }}>
          Sources déjà importées : {donnees.sources.join(', ')}
        </p>
      )}
    </Card>
  );
}

/* ==================== Vue par personne ====================
   Courbes par objectif, style de graphique au choix, et fenêtre temporelle
   ajustable — ce que la tablette ne peut pas offrir, faute de recul. */
const STYLES_GRAPHIQUE = [
  { k: 'ligne', label: 'Courbe' },
  { k: 'barres', label: 'Barres' },
  { k: 'aire', label: 'Aire' },
  { k: 'points', label: 'Points' },
];
const PERIODES = [
  { k: 30, label: '30 jours' },
  { k: 90, label: '3 mois' },
  { k: 180, label: '6 mois' },
  { k: 365, label: '1 an' },
  { k: 0, label: 'Tout' },
];

function Graphique({ points, style, seuil }) {
  const donnees = points.map((p) => ({
    label: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    valeur: p.value,
  }));
  const commun = (
    <>
      <CartesianGrid stroke={BORDER} vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={{ stroke: BORDER }} tickLine={false} />
      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: INK_SOFT, fontFamily: F_MONO }} axisLine={false} tickLine={false} width={40} />
      <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontFamily: F_BODY, fontSize: 12 }} formatter={(v) => [`${v} %`, 'Résultat']} />
      {seuil != null && <ReferenceLine y={seuil} stroke={ACQUIS} strokeDasharray="4 4" strokeWidth={1.5} />}
    </>
  );
  const marge = { top: 8, right: 8, bottom: 4, left: -14 };

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        {style === 'barres' ? (
          <BarChart data={donnees} margin={marge}>{commun}
            <Bar dataKey="valeur" fill={INK} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        ) : style === 'aire' ? (
          <AreaChart data={donnees} margin={marge}>{commun}
            <Area type="monotone" dataKey="valeur" stroke={INK} fill={INK} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        ) : style === 'points' ? (
          <ScatterChart data={donnees} margin={marge}>{commun}
            <Scatter dataKey="valeur" fill={INK} isAnimationActive={false} />
          </ScatterChart>
        ) : (
          <LineChart data={donnees} margin={marge}>{commun}
            <Line type="monotone" dataKey="valeur" stroke={INK} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function PersonneScreen({ donnees, lignes }) {
  const [personne, setPersonne] = useState(donnees.personnes[0] ? donnees.personnes[0].initials : null);
  const [style, setStyle] = useState('ligne');
  const [periode, setPeriode] = useState(0);

  if (!donnees.personnes.length) {
    return <Card><p className="text-sm text-center" style={{ color: INK_SOFT }}>Importez une sauvegarde pour commencer.</p></Card>;
  }

  const limite = periode ? Date.now() - periode * 86400000 : 0;
  const siennes = lignes
    .filter((l) => l.initials === personne)
    .map((l) => ({ ...l, points: l.points.filter((p) => !limite || new Date(p.date) >= limite) }));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 no-print">
        {donnees.personnes.map((p) => (
          <button key={p.initials} onClick={() => setPersonne(p.initials)}
            className="rounded-xl px-4 py-2.5 border font-semibold text-sm"
            style={{ fontFamily: F_DISPLAY, borderColor: personne === p.initials ? INK : BORDER,
              backgroundColor: personne === p.initials ? INK : 'transparent', color: personne === p.initials ? '#fff' : INK_SOFT }}>
            {p.initials}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4 no-print">
        {STYLES_GRAPHIQUE.map((g) => (
          <button key={g.k} onClick={() => setStyle(g.k)} className="rounded-lg px-3 py-1.5 text-xs border"
            style={{ borderColor: style === g.k ? INK : BORDER, backgroundColor: style === g.k ? INK : 'transparent', color: style === g.k ? '#fff' : INK_SOFT }}>
            {g.label}
          </button>
        ))}
        <span className="w-px mx-1" style={{ backgroundColor: BORDER }} />
        {PERIODES.map((pe) => (
          <button key={pe.k} onClick={() => setPeriode(pe.k)} className="rounded-lg px-3 py-1.5 text-xs border"
            style={{ borderColor: periode === pe.k ? INK : BORDER, backgroundColor: periode === pe.k ? INK : 'transparent', color: periode === pe.k ? '#fff' : INK_SOFT }}>
            {pe.label}
          </button>
        ))}
      </div>

      {siennes.length === 0 ? (
        <Card><p className="text-sm text-center" style={{ color: INK_SOFT }}>Aucun objectif pour cette personne.</p></Card>
      ) : (
        <div className="space-y-3">
          {siennes.map((l, i) => {
            const et = ETATS[l.etat];
            return (
              <Card key={i}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium break-words">{l.objectif}</div>
                    <div className="text-xs" style={{ color: INK_SOFT }}>
                      {l.points.length} séance{l.points.length !== 1 ? 's' : ''} sur la période
                      {l.threshold != null && ` · seuil ${l.threshold} %`}
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-lg shrink-0"
                    style={{ backgroundColor: et.color, color: '#fff', fontFamily: F_DISPLAY }}>
                    {et.label}
                  </span>
                </div>
                {l.points.length > 0
                  ? <Graphique points={l.points} style={style} seuil={l.threshold} />
                  : <p className="text-xs text-center py-6" style={{ color: INK_SOFT }}>Aucune donnée sur cette période.</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==================== Écran Bilan ==================== */
/* Reconstruit, pour chaque personne et chaque objectif, la série de scores et
   son état. Les objectifs sont retrouvés dans les instantanés conservés au
   sein de chaque séance : c'est la source la plus fiable, elle ne dépend
   d'aucune configuration vivante à synchroniser entre appareils. */
function construireLignes(donnees) {
  const lignes = [];
  donnees.personnes.forEach((p) => {
    const tableParSource = {};
    donnees.sources.forEach((src) => {
      const t = (donnees._idVersInitiales || {})[src] || {};
      const sid = Object.keys(t).find((id) => t[id] === p.initials);
      if (sid) tableParSource[src] = sid;
    });

    const seancesDeLaPersonne = donnees.seances.filter((sess) => {
      const sid = tableParSource[sess.source];
      return sid && (sess.selectedObjectives || {})[sid];
    });

    const objectifsParNom = new Map();
    seancesDeLaPersonne.forEach((sess) => {
      const sid = tableParSource[sess.source];
      (sess.selectedObjectives[sid] || []).forEach((oid) => {
        const snap = (sess.objectiveSnapshot || {})[oid];
        if (snap && !objectifsParNom.has(snap.name)) objectifsParNom.set(snap.name, snap);
      });
    });

    objectifsParNom.forEach((obj) => {
      const statut = statutObjectif(seancesDeLaPersonne, tableParSource, obj, []);
      lignes.push({ initials: p.initials, objectif: obj.name, type: obj.type, ...statut });
    });
  });
  return lignes;
}

function TableauDeBord({ donnees, lignes }) {
  const [filtreEtat, setFiltreEtat] = useState('tous');

  const compteEtat = (e) => lignes.filter((l) => l.etat === e).length;
  const total = lignes.length;

  /* Crises et observations : volume récent et répartition, pour situer d'un
     coup d'œil où en est le collectif. */
  const crises = donnees.crises || [];
  const depuis = (jours) => Date.now() - jours * 86400000;
  const crisesRecentes = crises.filter((c) => new Date(c.date) >= depuis(30) && (c.kind || 'crise') === 'crise');
  const crisesPrecedentes = crises.filter((c) => {
    const t = new Date(c.date);
    return t >= depuis(60) && t < depuis(30) && (c.kind || 'crise') === 'crise';
  });
  const tendance = crisesPrecedentes.length
    ? Math.round(((crisesRecentes.length - crisesPrecedentes.length) / crisesPrecedentes.length) * 100)
    : null;

  const compter = (l) => {
    const m = new Map();
    l.forEach((v) => m.set(v, (m.get(v) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const parComportement = compter(crisesRecentes.flatMap((c) => c.comportementTags || []));
  const parAntecedent = compter(crisesRecentes.flatMap((c) => c.antecedentTags || []));

  const Jauge = ({ etat }) => {
    const n = compteEtat(etat);
    const pct = total ? Math.round((n / total) * 100) : 0;
    return (
      <div className="flex-1 min-w-[110px]">
        <div className="text-2xl font-semibold" style={{ fontFamily: F_MONO, color: ETATS[etat].color }}>{n}</div>
        <div className="text-xs mb-1" style={{ color: INK_SOFT }}>{ETATS[etat].label}</div>
        <div className="h-1.5 rounded-full" style={{ backgroundColor: PAPER }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, backgroundColor: ETATS[etat].color }} />
        </div>
      </div>
    );
  };


  const filtrees = filtreEtat === 'tous' ? lignes : lignes.filter((l) => l.etat === filtreEtat);
  const compte = compteEtat;

  return (
    <div>
      {/* Où en est-on, d'un coup d'œil */}
      <Card className="mb-3">
        <div className="text-xs uppercase tracking-wide mb-3" style={{ color: INK_SOFT }}>Objectifs suivis</div>
        <div className="flex flex-wrap gap-4">
          <Jauge etat="acquis" />
          <Jauge etat="en_cours" />
          <Jauge etat="non_acquis" />
        </div>
      </Card>

      <Card className="mb-4">
        <div className="text-xs uppercase tracking-wide mb-3" style={{ color: INK_SOFT }}>Crises — 30 derniers jours</div>
        <div className="flex flex-wrap items-baseline gap-4 mb-3">
          <span>
            <span className="text-2xl font-semibold" style={{ fontFamily: F_MONO }}>{crisesRecentes.length}</span>
            <span className="text-xs ml-1.5" style={{ color: INK_SOFT }}>crise{crisesRecentes.length !== 1 ? 's' : ''}</span>
          </span>
          {tendance != null && (
            <span className="text-sm" style={{ color: tendance > 0 ? NON_ACQUIS : tendance < 0 ? ACQUIS : INK_SOFT }}>
              {tendance > 0 ? '+' : ''}{tendance} % par rapport aux 30 jours précédents
            </span>
          )}
        </div>
        {parComportement.length > 0 && (
          <div className="text-xs mb-1" style={{ color: INK_SOFT }}>
            Comportement le plus fréquent : <strong style={{ color: INK }}>{parComportement[0][0]}</strong> ({parComportement[0][1]})
          </div>
        )}
        {parAntecedent.length > 0 && (
          <div className="text-xs" style={{ color: INK_SOFT }}>
            Antécédent le plus fréquent : <strong style={{ color: INK }}>{parAntecedent[0][0]}</strong> ({parAntecedent[0][1]})
          </div>
        )}
        {crisesRecentes.length === 0 && (
          <p className="text-xs" style={{ color: INK_SOFT }}>Aucune crise consignée sur la période.</p>
        )}
      </Card>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[
          { k: 'tous', l: 'Tous', n: lignes.length },
          { k: 'acquis', l: 'Acquis', n: compte('acquis') },
          { k: 'en_cours', l: "En cours", n: compte('en_cours') },
          { k: 'non_acquis', l: 'Non acquis', n: compte('non_acquis') },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setFiltreEtat(f.k)}
            className="rounded-lg px-3 py-2 text-xs border"
            style={{
              borderColor: filtreEtat === f.k ? INK : BORDER,
              backgroundColor: filtreEtat === f.k ? INK : 'transparent',
              color: filtreEtat === f.k ? '#fff' : INK_SOFT,
            }}
          >
            {f.l} ({f.n})
          </button>
        ))}
      </div>

      {filtrees.length === 0 ? (
        <Card><p className="text-sm text-center" style={{ color: INK_SOFT }}>Aucun objectif dans cette catégorie.</p></Card>
      ) : (
        <div className="space-y-1.5">
          {filtrees.map((l, i) => {
            const et = ETATS[l.etat];
            return (
              <div key={i} className="rounded-xl border px-3.5 py-3 flex items-center justify-between gap-3" style={{ borderColor: BORDER, backgroundColor: CARD }}>
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold" style={{ fontFamily: F_DISPLAY }}>{l.initials}</span> · {l.objectif}
                  </div>
                  <div className="text-xs" style={{ color: INK_SOFT }}>
                    {l.points.length} séance{l.points.length !== 1 ? 's' : ''} cotée{l.points.length !== 1 ? 's' : ''}
                    {l.streak != null && ` · ${l.streak}/${l.needed} au seuil de ${l.threshold} %`}
                  </div>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-lg shrink-0" style={{ backgroundColor: et.color, color: '#fff', fontFamily: F_DISPLAY }}>
                  {et.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==================== Document imprimable ====================
   L'impression du navigateur sert de génération PDF : « Enregistrer au format
   PDF » figure dans la boîte d'impression de tous les navigateurs. Ce choix
   évite une bibliothèque supplémentaire, gère les accents sans réglage, et
   couvre d'un seul geste l'impression papier comme le fichier à déposer
   dans Airmes. */
function RapportScreen({ donnees, lignes, logo, association, onLogo, onAssociation }) {
  const [personne, setPersonne] = useState('toutes');
  const [inclureNonAcquis, setInclureNonAcquis] = useState(true);

  const retenues = lignes
    .filter((l) => personne === 'toutes' || l.initials === personne)
    .filter((l) => inclureNonAcquis || l.etat !== 'non_acquis');

  const parPersonne = new Map();
  retenues.forEach((l) => {
    if (!parPersonne.has(l.initials)) parPersonne.set(l.initials, []);
    parPersonne.get(l.initials).push(l);
  });

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
        <div className="text-sm font-semibold mb-3" style={{ fontFamily: F_DISPLAY }}>Composer le document</div>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Nom de l'association, en en-tête</div>
          <input
            value={association}
            onChange={(e) => onAssociation(e.target.value)}
            placeholder="Nom de votre association"
            className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent"
            style={{ borderColor: BORDER, color: INK }}
          />
        </div>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Logo, repris sur chaque document</div>
          <div className="flex items-center gap-3">
            {logo && <img src={logo} alt="Logo" style={{ height: 48, objectFit: 'contain' }} />}
            <input type="file" accept="image/*" onChange={(e) => chargerLogo(e.target.files && e.target.files[0])} className="text-sm" />
            {logo && <Btn variant="ghost" onClick={() => onLogo(null)} className="text-xs py-1.5">Retirer</Btn>}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Personne concernée</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setPersonne('toutes')} className="rounded-lg px-3 py-1.5 text-xs border"
              style={{ borderColor: personne === 'toutes' ? INK : BORDER, backgroundColor: personne === 'toutes' ? INK : 'transparent', color: personne === 'toutes' ? '#fff' : INK_SOFT }}>
              Toutes
            </button>
            {donnees.personnes.map((p) => (
              <button key={p.initials} onClick={() => setPersonne(p.initials)} className="rounded-lg px-3 py-1.5 text-xs border"
                style={{ borderColor: personne === p.initials ? INK : BORDER, backgroundColor: personne === p.initials ? INK : 'transparent', color: personne === p.initials ? '#fff' : INK_SOFT }}>
                {p.initials}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => setInclureNonAcquis((v) => !v)} className="flex items-center gap-1.5 text-xs mb-3" style={{ color: INK_SOFT }}>
          <span className="w-9 h-5 rounded-full relative shrink-0" style={{ backgroundColor: inclureNonAcquis ? INK : BORDER }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white" style={{ left: inclureNonAcquis ? '1.25rem' : '0.125rem', transition: 'left .15s' }} />
          </span>
          Inclure les objectifs sans donnée
        </button>

        <Btn onClick={() => window.print()} className="w-full">
          Imprimer ou enregistrer en PDF
        </Btn>
        <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
          Dans la fenêtre d'impression, choisissez votre imprimante, ou « Enregistrer au format PDF »
          pour obtenir un fichier à déposer dans Airmes.
        </p>
      </Card>

      {/* Le document lui-même : c'est cette partie qui part à l'impression */}
      <div className="rounded-2xl border p-6" style={{ borderColor: BORDER, backgroundColor: CARD }}>
        <div className="flex items-start justify-between gap-4 pb-4 mb-4" style={{ borderBottom: `2px solid ${INK}` }}>
          <div className="min-w-0">
            <div className="text-lg font-semibold" style={{ fontFamily: F_DISPLAY }}>
              {association || 'Bilan de suivi'}
            </div>
            <div className="text-sm" style={{ color: INK_SOFT }}>
              Bilan des objectifs · {aujourdhui}
            </div>
          </div>
          {logo && <img src={logo} alt="" style={{ height: 56, objectFit: 'contain' }} />}
        </div>

        {parPersonne.size === 0 ? (
          <p className="text-sm" style={{ color: INK_SOFT }}>Aucun objectif à présenter.</p>
        ) : (
          Array.from(parPersonne.entries()).map(([initiales, objs]) => (
            <div key={initiales} className="mb-6" style={{ breakInside: 'avoid' }}>
              <div className="text-base font-semibold mb-2" style={{ fontFamily: F_DISPLAY }}>{initiales}</div>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <th className="text-left py-1.5 font-medium" style={{ color: INK_SOFT }}>Objectif</th>
                    <th className="text-right py-1.5 font-medium" style={{ color: INK_SOFT }}>Séances</th>
                    <th className="text-right py-1.5 font-medium" style={{ color: INK_SOFT }}>Dernier</th>
                    <th className="text-right py-1.5 font-medium" style={{ color: INK_SOFT }}>État</th>
                  </tr>
                </thead>
                <tbody>
                  {objs.map((l, i) => {
                    const dernier = l.points.length ? l.points[l.points.length - 1].value : null;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td className="py-1.5 pr-2">{l.objectif}</td>
                        <td className="py-1.5 text-right" style={{ fontFamily: F_MONO }}>{l.points.length}</td>
                        <td className="py-1.5 text-right" style={{ fontFamily: F_MONO }}>{dernier != null ? `${dernier} %` : '—'}</td>
                        <td className="py-1.5 text-right" style={{ color: ETATS[l.etat].color, fontWeight: 600 }}>
                          {ETATS[l.etat].label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}

        <p className="text-xs mt-6 pt-3" style={{ color: INK_SOFT, borderTop: `1px solid ${BORDER}` }}>
          Document établi à partir des cotations relevées sur DatABA. Les états sont calculés selon
          le critère d'acquisition défini pour chaque objectif.
        </p>
      </div>
    </div>
  );
}

/* ==================== Application ==================== */
const SECU_KEY = 'aba-cadre:securite';

export default function App() {
  const [donnees, setDonnees] = useState(VIDE);
  const [loaded, setLoaded] = useState(false);
  const [securite, setSecurite] = useState({ pinHash: null, pinSalt: null });
  const [secuLue, setSecuLue] = useState(false);
  const [verrouille, setVerrouille] = useState(true);
  const [tab, setTab] = useState('import');
  const [toast, setToast] = useState('');
  const [logo, setLogo] = useState(null);
  const [association, setAssociation] = useState('');

  /* Logo et nom d'association : réglages de présentation, conservés à part
     des données de suivi. */
  useEffect(() => {
    try {
      setLogo(window.localStorage.getItem('aba-cadre:logo') || null);
      setAssociation(window.localStorage.getItem('aba-cadre:association') || '');
    } catch (e) { /* stockage indisponible */ }
  }, []);
  function enregistrerLogo(v) {
    setLogo(v);
    try {
      if (v) window.localStorage.setItem('aba-cadre:logo', v);
      else window.localStorage.removeItem('aba-cadre:logo');
    } catch (e) { /* image trop volumineuse pour le stockage */ }
  }
  function enregistrerAssociation(v) {
    setAssociation(v);
    try { window.localStorage.setItem('aba-cadre:association', v); } catch (e) {}
  }

  const lignes = React.useMemo(() => construireLignes(donnees), [donnees]);

  /* Les réglages de sécurité se lisent en clair, avant tout déverrouillage.
     Les données, elles, attendent la clé dérivée du mot de passe. */
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(SECU_KEY);
      if (brut) setSecurite(JSON.parse(brut));
    } catch (e) { /* réglages illisibles : on repart d'une création */ }
    setSecuLue(true);
  }, []);

  async function deverrouiller(motDePasse) {
    let sec = securite;
    if (!sec.dataSalt) {
      sec = { ...sec, dataSalt: newSalt() };
      setSecurite(sec);
      window.localStorage.setItem(SECU_KEY, JSON.stringify(sec));
    }
    if (sec.failedAttempts || sec.lockUntil) {
      sec = { ...sec, failedAttempts: 0, lockUntil: 0 };
      setSecurite(sec);
      window.localStorage.setItem(SECU_KEY, JSON.stringify(sec));
    }
    dataKey = await deriveDataKey(motDePasse, sec.dataSalt);
    setVerrouille(false);
    setDonnees(await chargerDonnees());
    setLoaded(true);
  }

  function echecSaisie(failedAttempts, lockUntil) {
    const suite = { ...securite, failedAttempts, lockUntil };
    setSecurite(suite);
    window.localStorage.setItem(SECU_KEY, JSON.stringify(suite));
  }

  /* Verrouillage automatique à la mise en veille et après inactivité */
  useEffect(() => {
    if (!securite.pinHash || verrouille) return undefined;
    let minuteur = null;
    const INACTIF_MS = 15 * 60 * 1000;
    const relancer = () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => setVerrouille(true), INACTIF_MS);
    };
    const surVisibilite = () => { if (document.visibilityState === 'hidden') setVerrouille(true); };
    document.addEventListener('visibilitychange', surVisibilite);
    ['mousedown', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, relancer));
    relancer();
    return () => {
      clearTimeout(minuteur);
      document.removeEventListener('visibilitychange', surVisibilite);
      ['mousedown', 'keydown', 'touchstart'].forEach((e) => document.removeEventListener(e, relancer));
    };
  }, [securite.pinHash, verrouille]);

  useEffect(() => {
    if (loaded) sauverDonnees(donnees);
  }, [donnees, loaded]);

  function onImported(fusion) {
    setDonnees(fusion);
    setToast(`${fusion.nbNouvellesSeances} nouvelle(s) séance(s), ${fusion.nbNouvellesCrises} nouvelle(s) crise(s)`);
    setTimeout(() => setToast(''), 4000);
    setTab('bilan');
  }

  if (!secuLue) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: PAPER }}>Chargement…</div>;
  }

  if (verrouille || !securite.pinHash) {
    return (
      <LockScreen
        security={securite}
        onUnlock={deverrouiller}
        onFailedAttempt={echecSaisie}
        onSetup={async (pinHash, pinSalt, motDePasse) => {
          const dataSalt = newSalt();
          const suite = { pinHash, pinSalt, dataSalt, failedAttempts: 0, lockUntil: 0 };
          setSecurite(suite);
          window.localStorage.setItem(SECU_KEY, JSON.stringify(suite));
          dataKey = await deriveDataKey(motDePasse, dataSalt);
          setVerrouille(false);
          setDonnees(await chargerDonnees());
          setLoaded(true);
        }}
      />
    );
  }

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: PAPER }}>Chargement…</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK, fontFamily: F_BODY }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-1 no-print" style={{ fontFamily: F_DISPLAY }}>DatABA Manager</h1>
        <p className="text-sm mb-6 no-print" style={{ color: INK_SOFT }}>
          {donnees.personnes.length} personne{donnees.personnes.length !== 1 ? 's' : ''} · {donnees.seances.length} séance{donnees.seances.length !== 1 ? 's' : ''} importée{donnees.seances.length !== 1 ? 's' : ''}
        </p>

        <div className="flex flex-wrap gap-2 mb-6 no-print">
          {[
            { k: 'import', l: 'Importer' },
            { k: 'bilan', l: 'Tableau de bord' },
            { k: 'personnes', l: 'Par personne' },
            { k: 'accord', l: 'Accord observateurs' },
            { k: 'rapport', l: 'Document' },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className="rounded-xl px-4 py-2.5 text-sm font-medium border"
              style={{
                fontFamily: F_DISPLAY,
                borderColor: tab === t.k ? INK : BORDER,
                backgroundColor: tab === t.k ? INK : 'transparent',
                color: tab === t.k ? '#fff' : INK_SOFT,
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'import' && <ImportScreen donnees={donnees} onImported={onImported} />}
        {tab === 'bilan' && <TableauDeBord donnees={donnees} lignes={lignes} />}
        {tab === 'personnes' && <PersonneScreen donnees={donnees} lignes={lignes} />}
        {tab === 'accord' && <AccordScreen donnees={donnees} />}
        {tab === 'rapport' && (
          <RapportScreen
            donnees={donnees} lignes={lignes}
            logo={logo} association={association}
            onLogo={enregistrerLogo} onAssociation={enregistrerAssociation}
          />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg" style={{ backgroundColor: INK }}>
          {toast}
        </div>
      )}
    </div>
  );
}
