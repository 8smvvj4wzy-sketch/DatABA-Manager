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

function BilanScreen({ lignes }) {
  const [filtreEtat, setFiltreEtat] = useState('tous');

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
export default function App() {
  const [donnees, setDonnees] = useState({ personnes: [], seances: [], crises: [], sources: [] });
  const [loaded, setLoaded] = useState(false);
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
        <h1 className="text-2xl font-semibold mb-1 no-print" style={{ fontFamily: F_DISPLAY }}>DatABA Manager</h1>
        <p className="text-sm mb-6 no-print" style={{ color: INK_SOFT }}>
          {donnees.personnes.length} personne{donnees.personnes.length !== 1 ? 's' : ''} · {donnees.seances.length} séance{donnees.seances.length !== 1 ? 's' : ''} importée{donnees.seances.length !== 1 ? 's' : ''}
        </p>

        <div className="flex flex-wrap gap-2 mb-6 no-print">
          {[
            { k: 'import', l: 'Importer' },
            { k: 'bilan', l: 'Bilan' },
            { k: 'personnes', l: 'Par personne' },
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
        {tab === 'bilan' && <BilanScreen lignes={lignes} />}
        {tab === 'personnes' && <PersonneScreen donnees={donnees} lignes={lignes} />}
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
