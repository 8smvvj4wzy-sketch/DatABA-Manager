let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

/* ==================== Droite de tendance ==================== */
function tendanceLineaire(valeurs){
  const n=valeurs.length;
  if(n<3)return null;
  const sx=(n-1)*n/2;
  const sy=valeurs.reduce((a,v)=>a+v,0);
  const sxy=valeurs.reduce((a,v,i)=>a+i*v,0);
  const sxx=valeurs.reduce((a,_,i)=>a+i*i,0);
  const denom=n*sxx-sx*sx;
  if(!denom)return null;
  const pente=(n*sxy-sx*sy)/denom;
  const origine=(sy-pente*sx)/n;
  return valeurs.map((_,i)=>Math.round((origine+pente*i)*100)/100);
}

t('série trop courte : pas de tendance', tendanceLineaire([2,5]), null);
t('trois points suffisent', tendanceLineaire([1,2,3]), [1,2,3]);
t('série parfaitement croissante', tendanceLineaire([0,2,4,6]), [0,2,4,6]);
t('série plate', tendanceLineaire([3,3,3,3]), [3,3,3,3]);

/* Le sens de la pente est ce qui est affiché : hausse, baisse, ou rien.
   Double condition — au moins une crise d'écart, et au moins un quart de la
   moyenne : un écart absolu seul ne veut rien dire sans son échelle. */
function sensTendance(valeurs){
  const a=tendanceLineaire(valeurs);
  if(!a)return null;
  const ecart=a[a.length-1]-a[0];
  const moyenne=valeurs.reduce((x,v)=>x+v,0)/valeurs.length;
  if(Math.abs(ecart)<1||Math.abs(ecart)<0.25*moyenne)return null;
  return ecart>0?'en hausse':'en baisse';
}
const sens=sensTendance;
t('crises qui augmentent', sens([1,2,4,5]), 'en hausse');
t('crises qui diminuent', sens([6,5,3,1]), 'en baisse');
t('crises stables : aucun sens annoncé', sens([3,3,3,3]), null);
t('bruit sans tendance nette', sens([2,2,2,2,2]), null);
/* Une hausse ne doit pas être annoncée sur un simple soubresaut */
t('un pic isolé ne fait pas une tendance', sens([1,1,1,1,1,1,1,1,1,2]), null);
/* Ni sur une variation minuscule au regard du volume habituel */
t('+3 sur une vingtaine par semaine : rien d annonce', sens([20,21,22,23]), null);
t('mais un doublement, oui', sens([10,15,20,25]), 'en hausse');
t('une baisse franche est annoncée', sens([12,9,6,2]), 'en baisse');

/* ==================== Codes EFL ====================
   Rattachés à l'objectif, jamais au couple personne-objectif : deux personnes
   qui travaillent la même compétence partagent le même code. */
const codeEflDe=(d,objectif)=>((d.codesEfl||{})[objectif]||'').trim();

const donnees={codesEfl:{'Demander de l’aide':'G12','Attendre son tour':'  H3  ','Se laver les mains':''}};
t('code repris tel quel', codeEflDe(donnees,'Demander de l’aide'), 'G12');
t('espaces parasites retirés', codeEflDe(donnees,'Attendre son tour'), 'H3');
t('code vide = pas de code', codeEflDe(donnees,'Se laver les mains'), '');
t('objectif inconnu = pas de code', codeEflDe(donnees,'Ranger'), '');
t('absence totale de table', codeEflDe({},'Ranger'), '');
t('le code ne dépend pas de la personne',
  [codeEflDe(donnees,'Attendre son tour'),codeEflDe(donnees,'Attendre son tour')], ['H3','H3']);

/* Fusion à l'import d'un autre Manager : les codes reçus complètent les nôtres */
const fusion=(a,b)=>({...a,codesEfl:{...(a.codesEfl||{}),...(b.codesEfl||{})}});
const r=fusion({codesEfl:{A:'1',B:'2'}},{codesEfl:{B:'22',C:'3'}});
t('codes fusionnés', r.codesEfl, {A:'1',B:'22',C:'3'});
t('un export restreint emporte tous les codes',
  Object.keys(fusion({codesEfl:{}},{codesEfl:donnees.codesEfl}).codesEfl).length, 3);

/* ==================== Retrait d'une séance ====================
   Seule la séance visée disparaît ; crises, personnes et sources restent. */
const base={
  personnes:[{id:'p1',initials:'L.M.'}],
  seances:[{id:'s1',date:'2026-07-01'},{id:'s2',date:'2026-07-02'},{id:'s3',date:'2026-07-03'}],
  crises:[{id:'c1'},{id:'c2'}],
  sources:['tabA'],
};
const retirer=(d,id)=>({...d,seances:d.seances.filter(s=>s.id!==id)});
const apres=retirer(base,'s2');
t('la séance visée est retirée', apres.seances.map(s=>s.id), ['s1','s3']);
t('les crises ne bougent pas', apres.crises.length, 2);
t('les personnes ne bougent pas', apres.personnes.length, 1);
t('les sources ne bougent pas', apres.sources, ['tabA']);
t('retirer un identifiant absent ne casse rien', retirer(base,'zzz').seances.length, 3);
t('l original n est pas modifié', base.seances.length, 3);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
