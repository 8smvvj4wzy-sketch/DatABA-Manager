let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

/* Détection automatique des paires de double cotation */
function trouverPaires(seances){
  const cand=seances.filter(s=>s.doubleCotation);
  const parJour=new Map();
  cand.forEach(s=>{const jour=new Date(s.date).toLocaleDateString('fr-FR');
    const cle=`${jour}|${s.atelierId||'libre'}`;
    if(!parJour.has(cle))parJour.set(cle,[]);parJour.get(cle).push(s);});
  const paires=[];
  parJour.forEach((l,cle)=>{for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++){
    if(l[i].source===l[j].source)continue;paires.push({cle,a:l[i].id,b:l[j].id});}});
  return paires;
}

const s = (id,date,src,dbl,atelier='a1')=>({id,date,source:src,doubleCotation:dbl,atelierId:atelier});

t('aucune paire sans le marqueur',
  trouverPaires([s('1','2026-07-20','tabA',false),s('2','2026-07-20','tabB',false)]).length, 0);

t('paire détectée : même jour, deux appareils',
  trouverPaires([s('1','2026-07-20T09:00','tabA',true),s('2','2026-07-20T09:05','tabB',true)]).map(p=>[p.a,p.b]), [['1','2']]);

t('même appareil : ce ne sont pas deux observateurs',
  trouverPaires([s('1','2026-07-20','tabA',true),s('2','2026-07-20','tabA',true)]).length, 0);

t('jours différents : aucune paire',
  trouverPaires([s('1','2026-07-20','tabA',true),s('2','2026-07-21','tabB',true)]).length, 0);

t('ateliers différents le même jour : aucune paire',
  trouverPaires([s('1','2026-07-20','tabA',true,'a1'),s('2','2026-07-20','tabB',true,'a2')]).length, 0);

t('deux paires distinctes sur deux jours',
  trouverPaires([s('1','2026-07-20','tabA',true),s('2','2026-07-20','tabB',true),
                 s('3','2026-07-22','tabA',true),s('4','2026-07-22','tabB',true)]).length, 2);

t('une séance non marquée est ignorée dans le lot',
  trouverPaires([s('1','2026-07-20','tabA',true),s('2','2026-07-20','tabB',true),
                 s('3','2026-07-20','tabC',false)]).length, 1);

/* Accord sur des essais */
function ioa(ea,eb){const n=Math.max(ea.length,eb.length);let p=0,a=0;
  for(let i=0;i<n;i++){const x=ea[i],y=eb[i];if(!x&&!y)continue;p++;if(x===y)a++;}
  return p?Math.round(a/p*100):null;}
t('accord parfait', ioa(['I','GP','I'],['I','GP','I']), 100);
t('deux tiers d accord', ioa(['I','GP','I'],['I','GT','I']), 67);
t('un observateur a coté un essai de plus', ioa(['I','GP'],['I','GP','I']), 67);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
