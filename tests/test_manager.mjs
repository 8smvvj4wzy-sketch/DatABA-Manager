let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

/* --- Classification à six états --- */
const PLATEAU_MIN=6, PLATEAU_ECART=20, DORMANT=21;
function classer(points, crit){
  if(!points.length) return 'non_acquis';
  let streak=0;
  if(crit){for(let i=points.length-1;i>=0;i--){if(points[i].value>=crit.threshold)streak++;else break;}}
  const jours=Math.floor((Date.now()-new Date(points[points.length-1].date))/86400000);
  if(crit&&streak>=crit.needed)return 'acquis';
  if(jours>=DORMANT)return 'dormant';
  if(crit&&crit.needed>1&&streak>=crit.needed-1)return 'bientot';
  if(crit&&points.length>=PLATEAU_MIN){
    const c=points.slice(-5);const moy=Math.round(c.reduce((a,p)=>a+p.value,0)/c.length);
    const ecart=crit.threshold-moy;if(ecart>0&&ecart<=PLATEAU_ECART)return 'plateau';}
  return 'en_cours';
}
const j=n=>new Date(Date.now()-n*86400000).toISOString();
const crit={threshold:80,needed:3};

t('acquis', classer([{date:j(3),value:85},{date:j(2),value:90},{date:j(1),value:82}],crit), 'acquis');
t('bientôt acquis', classer([{date:j(3),value:40},{date:j(2),value:90},{date:j(1),value:82}],crit), 'bientot');
t('plateau juste sous le seuil',
  classer([{date:j(6),value:70},{date:j(5),value:65},{date:j(4),value:72},{date:j(3),value:68},{date:j(2),value:70},{date:j(1),value:66}],crit), 'plateau');
t('loin du seuil : en cours',
  classer([{date:j(6),value:20},{date:j(5),value:25},{date:j(4),value:22},{date:j(3),value:18},{date:j(2),value:20},{date:j(1),value:26}],crit), 'en_cours');
t('dormant', classer([{date:j(40),value:90},{date:j(35),value:85}],crit), 'dormant');
t('aucune donnée', classer([],crit), 'non_acquis');
t('la priorité de dormant sur bientôt est respectée',
  classer([{date:j(40),value:90},{date:j(38),value:95}],crit), 'dormant');

/* Le rapport ne retient que trois états */
const ETAT_RAPPORT={acquis:'Acquis',bientot:"En cours d'acquisition",plateau:"En cours d'acquisition",
  en_cours:"En cours d'acquisition",dormant:"En cours d'acquisition",non_acquis:'Non acquis'};
t('acquis reste acquis', ETAT_RAPPORT.acquis, 'Acquis');
t('plateau devient en cours', ETAT_RAPPORT.plateau, "En cours d'acquisition");
t('dormant devient en cours', ETAT_RAPPORT.dormant, "En cours d'acquisition");
t('non acquis reste non acquis', ETAT_RAPPORT.non_acquis, 'Non acquis');
t('seulement trois libellés distincts', new Set(Object.values(ETAT_RAPPORT)).size, 3);

/* --- Libellés personnalisés --- */
const cle=(i,o)=>`${i}|${o}`;
const alias={personnes:{'L.M.':'Lucas M.'},objectifs:{'L.M.|Couleurs':'Discrimination des couleurs primaires'}};
const nom=(a,i)=>(a.personnes||{})[i]||i;
const lib=(a,i,o)=>(a.objectifs||{})[cle(i,o)]||o;
t('nom personnalisé', nom(alias,'L.M.'), 'Lucas M.');
t('repli sur les initiales', nom(alias,'T.B.'), 'T.B.');
t('libellé personnalisé', lib(alias,'L.M.','Couleurs'), 'Discrimination des couleurs primaires');
t('repli sur l intitulé tablette', lib(alias,'L.M.','Tri'), 'Tri');
t('le libellé est propre à la personne', lib(alias,'T.B.','Couleurs'), 'Couleurs');

/* --- Export sélectif --- */
function construire(donnees, retenues){
  const garder=retenues.length?new Set(retenues):null;
  const ini=(src,sid)=>(donnees._idVersInitiales[src]||{})[sid];
  return {
    personnes: donnees.personnes.filter(p=>!garder||garder.has(p.initials)),
    seances: donnees.seances.filter(s=>!garder||(s.studentIds||[]).some(sid=>garder.has(ini(s.source,sid)))),
    crises: donnees.crises.filter(c=>!garder||garder.has(ini(c.source,c.studentId))),
  };
}
const d={
  personnes:[{initials:'L.M.'},{initials:'T.B.'}],
  seances:[{id:'s1',source:'tabA',studentIds:['a1']},{id:'s2',source:'tabA',studentIds:['a2']},{id:'s3',source:'tabA',studentIds:['a1','a2']}],
  crises:[{id:'c1',source:'tabA',studentId:'a1'},{id:'c2',source:'tabA',studentId:'a2'}],
  _idVersInitiales:{tabA:{a1:'L.M.',a2:'T.B.'}},
};
t('export complet sans sélection', construire(d,[]).seances.length, 3);
t('une seule personne : ses séances', construire(d,['L.M.']).seances.map(s=>s.id), ['s1','s3']);
t('la séance partagée est incluse', construire(d,['T.B.']).seances.map(s=>s.id), ['s2','s3']);
t('crises filtrées', construire(d,['L.M.']).crises.map(c=>c.id), ['c1']);
t('personnes filtrées', construire(d,['L.M.']).personnes.map(p=>p.initials), ['L.M.']);

/* --- Radar : au moins trois objectifs --- */
const radarPossible=l=>l.filter(x=>x.points.length).length>=3;
t('deux objectifs : pas de radar', radarPossible([{points:[1]},{points:[1]}]), false);
t('trois objectifs : radar possible', radarPossible([{points:[1]},{points:[1]},{points:[1]}]), true);
t('objectif sans point non compté', radarPossible([{points:[1]},{points:[1]},{points:[]}]), false);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
