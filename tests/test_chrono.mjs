let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

const SERIES_MAX=6;
const INTENSITES={1:{label:'Légère'},2:{label:'Modérée'},3:{label:'Forte'}};
function cleAgregation(date,g){const d=new Date(date);
  if(g==='mois')return new Date(d.getFullYear(),d.getMonth(),1).getTime();
  if(g==='semaine'){const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));x.setHours(0,0,0,0);return x.getTime();}
  return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();}

function valeurs(d,c,seg){
  switch(seg){
    case 'intensite': return c.intensite?[`${c.intensite} · ${INTENSITES[c.intensite].label}`]:[];
    case 'personne': {const i=(d._idVersInitiales[c.source]||{})[c.studentId];return i?[i]:[];}
    case 'antecedent': return c.antecedentTags||[];
    case 'comportement': return c.comportementTags||[];
    default: return ['Total'];
  }
}
function chrono(d,crises,g,seg,mesure='nombre'){
  const paquets=new Map(),totaux=new Map();
  const poids=c=>mesure==='duree'?Math.round((c.durationMs||0)/60000):1;
  crises.forEach(c=>{const k=cleAgregation(c.date,g);
    if(!paquets.has(k))paquets.set(k,{});
    const b=paquets.get(k);const p=poids(c);
    valeurs(d,c,seg).forEach(v=>{b[v]=(b[v]||0)+p;totaux.set(v,(totaux.get(v)||0)+p);});});
  const classees=Array.from(totaux.entries()).sort((a,b)=>b[1]-a[1]);
  const gardees=classees.slice(0,SERIES_MAX).map(([v])=>v);
  const regroupe=classees.length>SERIES_MAX;
  const series=regroupe?[...gardees,'Autres']:gardees;
  const donnees=Array.from(paquets.entries()).sort((a,b)=>a[0]-b[0]).map(([k,b])=>{
    const l={cle:k};series.forEach(v=>{l[v]=0;});
    Object.entries(b).forEach(([v,n])=>{const cible=gardees.includes(v)?v:'Autres';l[cible]=(l[cible]||0)+n;});
    return l;});
  return {donnees,series,regroupe};
}

const d={_idVersInitiales:{tabA:{a1:'L.M.',a2:'T.B.'}}};
const crises=[
  {date:'2026-07-06',source:'tabA',studentId:'a1',intensite:1,antecedentTags:['Transition'],durationMs:5*60000},
  {date:'2026-07-08',source:'tabA',studentId:'a1',intensite:3,antecedentTags:['Transition','Attente'],durationMs:20*60000},
  {date:'2026-07-14',source:'tabA',studentId:'a2',intensite:1,antecedentTags:['Refus'],durationMs:3*60000},
  {date:'2026-07-15',source:'tabA',studentId:'a1',intensite:3,antecedentTags:[],durationMs:0},
];

/* Segmentation par intensité */
const r1=chrono(d,crises,'semaine','intensite');
t('deux semaines distinctes', r1.donnees.length, 2);
t('deux séries d intensité', r1.series.sort(), ['1 · Légère','3 · Forte']);
t('semaine 1 : une légère', r1.donnees[0]['1 · Légère'], 1);
t('semaine 1 : une forte', r1.donnees[0]['3 · Forte'], 1);
t('semaine 2 : une de chaque', [r1.donnees[1]['1 · Légère'],r1.donnees[1]['3 · Forte']], [1,1]);

/* Segmentation par personne */
const r2=chrono(d,crises,'semaine','personne');
t('séries par personne', r2.series.sort(), ['L.M.','T.B.']);
t('L.M. a deux crises la première semaine', r2.donnees[0]['L.M.'], 2);
t('T.B. aucune la première semaine', r2.donnees[0]['T.B.'], 0);

/* Dimension à valeurs multiples : le total dépasse le nombre de crises */
const r3=chrono(d,crises,'mois','antecedent');
const totalEmpile=r3.series.reduce((a,s)=>a+r3.donnees[0][s],0);
t('un mois unique', r3.donnees.length, 1);
t('le total empilé dépasse les 4 crises', totalEmpile, 4);
t('Transition compté deux fois', r3.donnees[0]['Transition'], 2);
t('la crise sans antécédent ne crée pas de série vide', r3.series.includes(''), false);

/* Granularité */
t('par jour : quatre points', chrono(d,crises,'jour','aucune').donnees.length, 4);
t('par semaine : deux points', chrono(d,crises,'semaine','aucune').donnees.length, 2);
t('par mois : un point', chrono(d,crises,'mois','aucune').donnees.length, 1);
t('sans segmentation : une seule série', chrono(d,crises,'mois','aucune').series, ['Total']);

/* Regroupement au-delà de six séries */
const nombreuses=Array.from({length:9},(_,i)=>({date:'2026-07-06',source:'tabA',studentId:'a1',antecedentTags:[`A${i}`]}));
const r4=chrono(d,nombreuses,'mois','antecedent');
t('sept séries au maximum', r4.series.length, 7);
t('la dernière est le regroupement', r4.series[6], 'Autres');
t('regroupement signalé', r4.regroupe, true);
t('aucune crise perdue', r4.series.reduce((a,s)=>a+r4.donnees[0][s],0), 9);

/* Filtrage par personne */
const parPersonne=(l,ini)=>l.filter(c=>(d._idVersInitiales[c.source]||{})[c.studentId]===ini);
t('filtre sur L.M.', parPersonne(crises,'L.M.').length, 3);
t('filtre sur T.B.', parPersonne(crises,'T.B.').length, 1);

/* Mesure par durée cumulée : une semaine peu fournie mais longue doit peser
   davantage qu'une semaine à plusieurs crises brèves. */
const d1=chrono(d,crises,'semaine','aucune','nombre');
const d2=chrono(d,crises,'semaine','aucune','duree');
t('en nombre : 2 crises la semaine 1', d1.donnees[0]['Total'], 2);
t('en durée : 25 min la semaine 1', d2.donnees[0]['Total'], 25);
t('en nombre : 2 crises la semaine 2', d1.donnees[1]['Total'], 2);
t('en durée : 3 min la semaine 2', d2.donnees[1]['Total'], 3);
t('la semaine la plus longue n est pas la plus fournie',
  d2.donnees[0]['Total'] > d2.donnees[1]['Total'] && d1.donnees[0]['Total'] === d1.donnees[1]['Total'], true);

/* Une crise sans durée (observation ABC) pèse zéro sans disparaître du compte */
const d3=chrono(d,crises,'mois','intensite','duree');
t('intensité 3 : 20 min cumulées', d3.donnees[0]['3 · Forte'], 20);
t('intensité 1 : 8 min cumulées', d3.donnees[0]['1 · Légère'], 8);

/* Durées agrégées telles que les affiche la carte de synthèse */
const minutes=c=>Math.round((c.durationMs||0)/60000);
const chronometrees=crises.filter(c=>(c.durationMs||0)>0);
t('durée cumulée', crises.reduce((a,c)=>a+minutes(c),0), 28);
t('moyenne sur les seules chronométrées', Math.round(chronometrees.reduce((a,c)=>a+minutes(c),0)/chronometrees.length), 9);
t('trois enregistrements chronométrés sur quatre', chronometrees.length, 3);
t('la plus longue', Math.max(...chronometrees.map(minutes)), 20);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
