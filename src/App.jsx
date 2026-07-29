import React, { useState, useEffect } from 'react';

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

/* ==================== Stockage local du cadre ====================
   Un seul jeu de données, accumulé au fil des imports. localStorage suffit
   à ce stade ; si le volume devenait important sur plusieurs années et
   plusieurs tablettes, IndexedDB prendrait le relais sans changer l'usage. */
const STORE_KEY = 'aba-cadre:data';

async function chargerDonnees() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { personnes: [], seances: [], crises: [], sources: [] };
    return JSON.parse(raw);
  } catch (e) {
    return { personnes: [], seances: [], crises: [], sources: [] };
  }
}
function sauverDonnees(d) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(d));
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
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function importer() {
    if (!fichier || passphrase.length < 4) return;
    setEnCours(true);
    setErreur('');
    try {
      const texte = await fichier.text();
      const env = JSON.parse(texte);
      if (env.format !== 'aba-backup-encrypted') {
        setErreur("Ce fichier n'est pas une sauvegarde chiffrée reconnue.");
        setEnCours(false);
        return;
      }
      const backup = await decryptEnvelope(env, passphrase);
      const nomSource = fichier.name.replace(/\.json$/i, '');
      const fusion = fusionnerImport(donnees, backup, nomSource);
      onImported(fusion);
      setFichier(null);
      setPassphrase('');
    } catch (e) {
      setErreur('Mot de passe incorrect ou fichier corrompu.');
    }
    setEnCours(false);
  }

  return (
    <Card className="mb-4">
      <div className="text-sm font-semibold mb-2" style={{ fontFamily: F_DISPLAY }}>Importer une sauvegarde de tablette</div>
      <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
        Récupérez le fichier depuis le dossier SharePoint, sélectionnez-le, saisissez la clé fournie par
        l'éducateur. Les séances déjà connues sont mises à jour, les nouvelles s'ajoutent — rien n'est dupliqué.
      </p>
      <input
        type="file"
        accept="application/json,.json"
        onChange={(e) => setFichier(e.target.files && e.target.files[0])}
        className="w-full text-sm mb-2"
      />
      <input
        type="password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        placeholder="Mot de passe de la sauvegarde"
        className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent mb-2"
        style={{ borderColor: BORDER, color: INK }}
      />
      {erreur && <p className="text-xs mb-2" style={{ color: NON_ACQUIS }}>{erreur}</p>}
      <Btn onClick={importer} disabled={!fichier || passphrase.length < 4 || enCours} className="w-full">
        {enCours ? 'Import…' : 'Importer'}
      </Btn>
      {donnees.sources.length > 0 && (
        <p className="text-xs mt-2" style={{ color: INK_SOFT }}>
          Sources déjà importées : {donnees.sources.join(', ')}
        </p>
      )}
    </Card>
  );
}

/* ==================== Écran Bilan ==================== */
function BilanScreen({ donnees }) {
  const [filtreEtat, setFiltreEtat] = useState('tous');

  const lignes = [];

  /* Reconstruction des objectifs d'une personne à partir des instantanés
     conservés dans chaque séance — la source la plus fiable, puisqu'elle ne
     dépend d'aucune configuration vivante à synchroniser. */
  donnees.personnes.forEach((p) => {
    const objectifsParNom = new Map();
    donnees.seances.forEach((s) => {
      const table = (donnees._idVersInitiales || {})[s.source] || {};
      const sid = Object.keys(table).find((id) => table[id] === p.initials);
      if (!sid || !(s.selectedObjectives || {})[sid]) return;
      (s.selectedObjectives[sid] || []).forEach((oid) => {
        const snap = (s.objectiveSnapshot || {})[oid];
        if (snap && !objectifsParNom.has(snap.name)) objectifsParNom.set(snap.name, snap);
      });
    });

    objectifsParNom.forEach((obj) => {
      const seancesDeCettePersonne = donnees.seances.filter((s) => {
        const table = (donnees._idVersInitiales || {})[s.source] || {};
        const sid = Object.keys(table).find((id) => table[id] === p.initials);
        return sid && (s.selectedObjectives || {})[sid];
      });
      const table2 = {};
      donnees.sources.forEach((src) => {
        const t = (donnees._idVersInitiales || {})[src] || {};
        const sid = Object.keys(t).find((id) => t[id] === p.initials);
        if (sid) table2[src] = sid;
      });
      const statut = statutObjectif(seancesDeCettePersonne, table2, obj, []);
      lignes.push({ initials: p.initials, objectif: obj.name, ...statut });
    });
  });

  const filtrees = filtreEtat === 'tous' ? lignes : lignes.filter((l) => l.etat === filtreEtat);
  const compte = (e) => lignes.filter((l) => l.etat === e).length;

  return (
    <div>
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

/* ==================== Application ==================== */
export default function App() {
  const [donnees, setDonnees] = useState({ personnes: [], seances: [], crises: [], sources: [] });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('import');
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      setDonnees(await chargerDonnees());
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) sauverDonnees(donnees);
  }, [donnees, loaded]);

  function onImported(fusion) {
    setDonnees(fusion);
    setToast(`${fusion.nbNouvellesSeances} nouvelle(s) séance(s), ${fusion.nbNouvellesCrises} nouvelle(s) crise(s)`);
    setTimeout(() => setToast(''), 4000);
    setTab('bilan');
  }

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: PAPER }}>Chargement…</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK, fontFamily: F_BODY }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: F_DISPLAY }}>Suivi ABA — cadres pédagogiques</h1>
        <p className="text-sm mb-6" style={{ color: INK_SOFT }}>
          {donnees.personnes.length} personne{donnees.personnes.length !== 1 ? 's' : ''} · {donnees.seances.length} séance{donnees.seances.length !== 1 ? 's' : ''} importée{donnees.seances.length !== 1 ? 's' : ''}
        </p>

        <div className="flex gap-2 mb-6 no-print">
          {[{ k: 'import', l: 'Importer' }, { k: 'bilan', l: 'Bilan' }].map((t) => (
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
        {tab === 'bilan' && <BilanScreen donnees={donnees} />}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg" style={{ backgroundColor: INK }}>
          {toast}
        </div>
      )}
    </div>
  );
}
