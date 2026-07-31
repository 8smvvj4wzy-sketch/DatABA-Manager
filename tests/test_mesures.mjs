let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)} au lieu de ${JSON.stringify(e)}`));p?ok++:ko++;};

/* ==================== Extraction des valeurs brutes ====================
   Les quatre types que objectiveScoreValue ignorait. */
const UNITES_BRUTES={
  occurrence:{unite:'occurrences',cumulable:true,hausseFavorable:true},
  timer:{unite:'min',cumulable:true,hausseFavorable:true},
  latency:{unite:'s',cumulable:false,hausseFavorable:false},
  interval:{unite:'%',cumulable:false,hausseFavorable:true},
};
function parseHM(v){if(!v||typeof v!=='string')return null;const m=v.match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;return Number(m[1])*60+Number(m[2]);}
function partNiveauCible(obj,entry){
  const c=(obj&&obj.config)||{};
  const pas=c.intervalSeconds||(c.intervalMinutes||5)*60;
  const totaux={};
  Object.values(entry.marks||{}).forEach(lid=>{if(lid)totaux[lid]=(totaux[lid]||0)+pas;});
  (entry.segments||[]).forEach(s=>{
    const a=parseHM(s.start),b=parseHM(s.end);
    const d=a===null||b===null||b<=a?0:(b-a)*60;
    if(d>0&&s.levelId)totaux[s.levelId]=(totaux[s.levelId]||0)+d;
  });
  const total=Object.values(totaux).reduce((a,b)=>a+b,0);
  if(!total)return null;
  const niveaux=c.levels||[];
  const cible=c.targetLevelId||(niveaux[0]&&niveaux[0].id);
  return Math.round(((totaux[cible]||0)/total)*100);
}
function valeurCotation(obj,entry,score=null){
  if(!obj||!entry)return null;
  if(score!=null)return{valeur:score,unite:'%',cumulable:false,hausseFavorable:true};
  if(obj.type==='occurrence'){if(typeof entry.count!=='number')return null;return{valeur:entry.count,...UNITES_BRUTES.occurrence};}
  if(obj.type==='timer'){if(typeof entry.elapsedMs!=='number'||entry.elapsedMs<=0)return null;return{valeur:Math.round(entry.elapsedMs/60000),...UNITES_BRUTES.timer};}
  if(obj.type==='latency'){if(!Array.isArray(entry.latencies)||!entry.latencies.length)return null;
    const m=entry.latencies.reduce((a,b)=>a+b,0)/entry.latencies.length;return{valeur:Math.round(m/100)/10,...UNITES_BRUTES.latency};}
  if(obj.type==='interval'){const p=partNiveauCible(obj,entry);if(p==null)return null;return{valeur:p,...UNITES_BRUTES.interval};}
  return null;
}

t('occurrence : le compteur est la valeur', valeurCotation({type:'occurrence'},{count:12}).valeur, 12);
t('occurrence : zéro reste une mesure, pas une absence', valeurCotation({type:'occurrence'},{count:0}).valeur, 0);
t('occurrence : rien de relevé', valeurCotation({type:'occurrence'},{}), null);
t('occurrence : unité', valeurCotation({type:'occurrence'},{count:3}).unite, 'occurrences');
t('occurrence : une hausse est un progrès', valeurCotation({type:'occurrence'},{count:3}).hausseFavorable, true);

t('timer : converti en minutes', valeurCotation({type:'timer'},{elapsedMs:5*60000}).valeur, 5);
t('timer : chrono jamais lancé', valeurCotation({type:'timer'},{elapsedMs:0}), null);

t('latence : moyenne en secondes', valeurCotation({type:'latency'},{latencies:[2000,4000]}).valeur, 3);
t('latence : une hausse n est pas un progrès', valeurCotation({type:'latency'},{latencies:[2000]}).hausseFavorable, false);
t('latence : liste vide', valeurCotation({type:'latency'},{latencies:[]}), null);

/* Intervalle : part du niveau cible sur le temps observé, relevés en direct et
   périodes saisies confondus — comme le calcule DatABA. */
const objInt={type:'interval',config:{intervalMinutes:5,levels:[{id:'L1'},{id:'L2'}],targetLevelId:'L1'}};
t('intervalle : trois pas sur quatre au niveau cible',
  valeurCotation(objInt,{marks:{1:'L1',2:'L1',3:'L1',4:'L2'}}).valeur, 75);
t('intervalle : une période saisie s ajoute aux relevés',
  valeurCotation(objInt,{marks:{1:'L1'},segments:[{start:'10:00',end:'10:15',levelId:'L2'}]}).valeur, 25);
t('intervalle : rien d observé', valeurCotation(objInt,{marks:{}}), null);
t('intervalle : horaire mal formé ignoré',
  valeurCotation(objInt,{marks:{1:'L1'},segments:[{start:'nawak',end:'10:15',levelId:'L2'}]}).valeur, 100);

/* Un type à pourcentage ne doit jamais passer par la voie brute */
t('un score en % garde son unité', valeurCotation({type:'trials'},{trials:['I']},87).unite, '%');

/* ==================== Moyenne par jour ==================== */
function cleAgregation(date){const d=new Date(date);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();}
function moyennesParJour(mesures){
  const parJour=new Map();
  mesures.forEach(m=>{const c=cleAgregation(m.date);if(!parJour.has(c))parJour.set(c,[]);parJour.get(c).push(m.value);});
  return Array.from(parJour.entries()).sort((a,b)=>a[0]-b[0])
    .map(([c,v])=>({date:new Date(c).toISOString(),value:Math.round((v.reduce((a,x)=>a+x,0)/v.length)*10)/10,seances:v.length}));
}

const brutes=[
  {date:'2026-07-01T09:00:00',value:10},
  {date:'2026-07-01T14:00:00',value:20},
  {date:'2026-07-02T09:00:00',value:6},
];
const parJour=moyennesParJour(brutes);
t('deux cotations le même jour donnent une seule valeur', parJour.length, 2);
t('la journée est moyennée, pas cumulée', parJour[0].value, 15);
t('le nombre de séances du jour est conservé', parJour[0].seances, 2);
t('une seule cotation reste elle-même', parJour[1].value, 6);
/* Sans ce regroupement, un jour à trois cotations pèserait trois fois plus */
t('les jours sont dans l ordre', parJour[0].date < parJour[1].date, true);
t('aucune mesure : aucune journée', moyennesParJour([]), []);

/* ==================== Évolution en pourcentage ==================== */
function tendanceLineaire(valeurs){
  const n=valeurs.length;if(n<3)return null;
  const sx=(n-1)*n/2,sy=valeurs.reduce((a,v)=>a+v,0);
  const sxy=valeurs.reduce((a,v,i)=>a+i*v,0),sxx=valeurs.reduce((a,_,i)=>a+i*i,0);
  const den=n*sxx-sx*sx;if(!den)return null;
  const p=(n*sxy-sx*sy)/den,o=(sy-p*sx)/n;
  return valeurs.map((_,i)=>Math.round((o+p*i)*100)/100);
}
const MIN_JOURS_EVOLUTION=5;
function evolutionMoyenne(j){
  if(j.length<MIN_JOURS_EVOLUTION)return null;
  const a=tendanceLineaire(j.map(x=>x.value));if(!a)return null;
  const r=x=>Math.round(x*10)/10;
  const d=a[0],f=a[a.length-1];
  return{depart:r(d),arrivee:r(f),pct:d>0?Math.round(((f-d)/d)*100):null,jours:j.length};
}
const jours=(vals)=>vals.map(v=>({value:v}));

t('moins de cinq journées : aucun pourcentage annoncé', evolutionMoyenne(jours([1,2,3,4])), null);
t('cinq journées suffisent', evolutionMoyenne(jours([10,10,10,10,10])).jours, 5);
t('une série plate n évolue pas', evolutionMoyenne(jours([10,10,10,10,10])).pct, 0);
t('un doublement franc', evolutionMoyenne(jours([10,12,14,16,18,20])).pct, 100);
t('une baisse est négative', evolutionMoyenne(jours([20,18,16,14,12,10])).pct, -50);
/* Un départ à zéro ne peut pas donner de pourcentage : division par zéro */
const depuisZero=evolutionMoyenne(jours([0,1,2,3,4,5]));
t('départ à zéro : pas de pourcentage', depuisZero.pct, null);
t('mais les deux bouts restent disponibles', [depuisZero.depart,depuisZero.arrivee], [0,5]);
/* La tendance, et non les extrémités brutes : un jour exceptionnel au départ
   inverserait sinon complètement le sens annoncé. */
const avecPic=evolutionMoyenne(jours([30,5,6,7,8,9]));
t('un pic initial ne fait pas basculer le sens', avecPic.pct < 0, true);
t('mais la tendance reste plus douce que les extrêmes', avecPic.pct > -83, true);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
