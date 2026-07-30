let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

function bornesDe(p){
  if(!p)return{min:null,max:null};
  if(p.mode==='dates')return{min:p.debut?new Date(`${p.debut}T00:00:00`).getTime():null,
    max:p.fin?new Date(`${p.fin}T23:59:59`).getTime():null};
  if(p.mode==='mois'){let min=null,max=null;
    if(p.moisDebut)min=new Date(`${p.moisDebut}-01T00:00:00`).getTime();
    if(p.moisFin){const[a,m]=p.moisFin.split('-').map(Number);max=new Date(a,m,0,23,59,59).getTime();}
    return{min,max};}
  return{min:p.jours?Date.now()-p.jours*86400000:null,max:null};
}
const dans=(d,p)=>{const{min,max}=bornesDe(p);const x=new Date(d).getTime();
  return (min==null||x>=min)&&(max==null||x<=max);};

/* Mois calendaires : septembre à janvier */
const scolaire={mode:'mois',moisDebut:'2026-09',moisFin:'2027-01'};
t('1er septembre inclus', dans('2026-09-01T08:00:00',scolaire), true);
t('mi-novembre inclus', dans('2026-11-15T10:00:00',scolaire), true);
t('LE POINT CLÉ : 31 janvier inclus', dans('2027-01-31T22:00:00',scolaire), true);
t('1er février exclu', dans('2027-02-01T08:00:00',scolaire), false);
t('31 août exclu', dans('2026-08-31T22:00:00',scolaire), false);

/* Février d une année bissextile */
t('29 février 2028 inclus', dans('2028-02-29T12:00:00',{mode:'mois',moisDebut:'2028-02',moisFin:'2028-02'}), true);
t('1er mars 2028 exclu', dans('2028-03-01T00:30:00',{mode:'mois',moisDebut:'2028-02',moisFin:'2028-02'}), false);

/* Dates précises */
const plage={mode:'dates',debut:'2026-07-10',fin:'2026-07-12'};
t('premier jour inclus dès le matin', dans('2026-07-10T00:05:00',plage), true);
t('dernier jour inclus jusqu au soir', dans('2026-07-12T23:30:00',plage), true);
t('la veille exclue', dans('2026-07-09T23:00:00',plage), false);
t('borne de début seule', dans('2027-01-01',{mode:'dates',debut:'2026-07-10',fin:''}), true);

/* Raccourcis glissants */
const j=n=>new Date(Date.now()-n*86400000).toISOString();
t('7 jours : hier inclus', dans(j(1),{mode:'raccourci',jours:7}), true);
t('7 jours : il y a 10 jours exclu', dans(j(10),{mode:'raccourci',jours:7}), false);
t('tout : rien n est exclu', dans(j(4000),{mode:'raccourci',jours:0}), true);

/* Granularité d agrégation */
function cle(date,g){const d=new Date(date);
  if(g==='mois')return new Date(d.getFullYear(),d.getMonth(),1).getTime();
  if(g==='semaine'){const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));x.setHours(0,0,0,0);return x.getTime();}
  return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();}

t('jour : deux moments du même jour se regroupent',
  cle('2026-07-20T08:00','jour')===cle('2026-07-20T18:00','jour'), true);
t('jour : deux jours distincts ne se regroupent pas',
  cle('2026-07-20','jour')===cle('2026-07-21','jour'), false);
t('semaine : lundi et dimanche ensemble',
  cle('2026-07-20','semaine')===cle('2026-07-26','semaine'), true);
t('semaine : lundi suivant à part',
  cle('2026-07-26','semaine')===cle('2026-07-27','semaine'), false);
t('mois : début et fin de mois ensemble',
  cle('2026-07-01','mois')===cle('2026-07-31','mois'), true);
t('mois : deux mois distincts',
  cle('2026-07-31','mois')===cle('2026-08-01','mois'), false);

/* Pourcentage et nombre */
const pct=(n,tot)=>Math.round(n/(tot||1)*100);
t('3 sur 12', pct(3,12), 25);
t('division par zéro protégée', pct(0,0), 0);
t('tout', pct(12,12), 100);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
