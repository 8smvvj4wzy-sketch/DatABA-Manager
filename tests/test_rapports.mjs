let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

/* ==================== Sélection des blocs du bilan ==================== */
/* La liste se lit dans src/App.jsx au lieu d'être recopiée : recopiée, elle a
   survécu au retrait du bloc « Rappel sur l'interprétation » et le test
   validait une liste que l'application ne proposait plus. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'App.jsx'), 'utf8');
const declaration = source.slice(source.indexOf('const BLOCS_CRISE = ['));
const TOUS = [...declaration.slice(0, declaration.indexOf('];')).matchAll(/\bk: '([^']+)'/g)].map((m) => m[1]);
t('la liste des blocs est bien lue dans src/App.jsx', TOUS.length > 0 && TOUS[0], 'chronologie');
t("le rappel sur l'interprétation n'est plus un bloc", TOUS.includes('avertissement'), false);
const actif=(cfg,k)=>(cfg.blocs||TOUS).includes(k);
const basculer=(cfg,k)=>({...cfg,blocs:(cfg.blocs||[]).includes(k)?cfg.blocs.filter(x=>x!==k):[...(cfg.blocs||[]),k]});

let cfg={blocs:[...TOUS]};
t('tout est inclus au départ', TOUS.every(k=>actif(cfg,k)), true);
cfg=basculer(cfg,'consequence');
t('une conséquence décochée disparaît', actif(cfg,'consequence'), false);
t('les autres blocs restent', actif(cfg,'antecedent'), true);
cfg=basculer(cfg,'fonction');
t('les fonctions supposées se retirent aussi', actif(cfg,'fonction'), false);
cfg=basculer(cfg,'consequence');
t('et se remettent', actif(cfg,'consequence'), true);
t('le minimum ne garde que deux blocs', {blocs:['chronologie','synthese']}.blocs.length, 2);
/* Une liste vide doit rester vide, et non retomber sur « tout » */
t('aucun bloc coché = document sans bloc', actif({blocs:[]},'chronologie'), false);

/* ==================== Filtrage commun écran / rapport ====================
   Le bilan imprimé doit porter exactement sur les mêmes enregistrements que
   celui composé à l'écran. */
const donnees={_idVersInitiales:{tabA:{a1:'L.M.',a2:'T.B.'}}};
const crises=[
  {date:'2026-07-05',source:'tabA',studentId:'a1',kind:'crise'},
  {date:'2026-07-06',source:'tabA',studentId:'a2',kind:'crise'},
  {date:'2026-07-07',source:'tabA',studentId:'a1',kind:'abc'},
  {date:'2026-01-01',source:'tabA',studentId:'a1',kind:'crise'},
];
const dans=(d,p)=>!p.min||new Date(d).getTime()>=p.min;
function retenues(cfg,p){
  const ini=c=>(donnees._idVersInitiales[c.source]||{})[c.studentId];
  return crises
    .filter(c=>cfg.type==='tout'||(c.kind||'crise')===cfg.type)
    .filter(c=>!(cfg.personnes||[]).length||cfg.personnes.includes(ini(c)))
    .filter(c=>dans(c.date,p));
}
const p={min:new Date('2026-07-01').getTime()};
t('crises seules', retenues({type:'crise',personnes:[]},p).length, 2);
t('observations seules', retenues({type:'abc',personnes:[]},p).length, 1);
t('les deux', retenues({type:'tout',personnes:[]},p).length, 3);
t('filtré sur une personne', retenues({type:'crise',personnes:['L.M.']},p).length, 1);
t('filtré sur deux personnes', retenues({type:'crise',personnes:['L.M.','T.B.']},p).length, 2);
t('la période exclut janvier', retenues({type:'crise',personnes:['L.M.']},{min:0}).length, 2);
t('aucune personne sélectionnée = toutes', retenues({type:'tout',personnes:[]},p).length, 3);

/* ==================== Enregistrement des rapports ==================== */
function enregistrer(liste,nom,sel){
  const titre=String(nom||'').trim();
  if(!titre)return liste;
  const entree={id:'x',nom:titre,majLe:'2026-07-31',...sel};
  return [entree,...liste.filter(r=>r.nom!==titre)];
}
let liste=[];
liste=enregistrer(liste,'Bilan L.M.',{personne:'L.M.',objectifs:['A'],bilanCrises:null});
t('un rapport est enregistré', liste.length, 1);
liste=enregistrer(liste,'Bilan T.B.',{personne:'T.B.',objectifs:[],bilanCrises:{blocs:['chronologie']}});
t('un second s ajoute', liste.length, 2);
t('le plus récent est en tête', liste[0].nom, 'Bilan T.B.');
/* Réenregistrer sous un nom existant remplace, sans créer d'homonyme */
liste=enregistrer(liste,'Bilan L.M.',{personne:'L.M.',objectifs:['A','B'],bilanCrises:null});
t('pas de doublon de nom', liste.filter(r=>r.nom==='Bilan L.M.').length, 1);
t('la version remplaçante est retenue', liste.find(r=>r.nom==='Bilan L.M.').objectifs, ['A','B']);
t('un nom vide n enregistre rien', enregistrer(liste,'   ',{}).length, liste.length);
t('le bilan de crise est conservé avec le rapport', liste.find(r=>r.nom==='Bilan T.B.').bilanCrises.blocs, ['chronologie']);
/* Suppression */
liste=liste.filter(r=>r.nom!=='Bilan T.B.');
t('suppression ciblée', liste.map(r=>r.nom), ['Bilan L.M.']);

/* ==================== Titre du document ====================
   Distinct de `nom` (clé de la liste, jamais imprimé — voir ci-dessus) :
   `titre` est ce qui s'affiche en en-tête du document, saisi dans l'écran
   Rapport, enregistré avec la composition et restauré à l'ouverture. Un
   rapport enregistré avant l'ajout de ce champ n'a pas de `titre` : la
   lecture doit retomber sur le défaut plutôt que d'afficher un titre vide. */
const TITRE_DEFAUT='Bilan de suivi';
function enregistrerAvecTitre(liste,nom,sel){
  const cle=String(nom||'').trim();
  if(!cle)return liste;
  const entree={id:'x',nom:cle,majLe:'2026-07-31',...sel,titre:sel.titre||TITRE_DEFAUT};
  return [entree,...liste.filter(r=>r.nom!==cle)];
}
function ouvrirAvecTitre(r){
  return {personne:r.personne,objectifs:r.objectifs||[],titre:r.titre||TITRE_DEFAUT};
}

let listeTitres=[];
listeTitres=enregistrerAvecTitre(listeTitres,'Bilan L.M.',{personne:'L.M.',objectifs:['A'],titre:'Bilan trimestriel'});
t('le titre du document est enregistré avec le rapport', listeTitres[0].titre, 'Bilan trimestriel');
t('le nom reste la clé de la liste, distinct du titre', listeTitres[0].nom, 'Bilan L.M.');
listeTitres=enregistrerAvecTitre(listeTitres,'Bilan T.B.',{personne:'T.B.',objectifs:[]});
t('sans titre saisi, le défaut est enregistré', listeTitres[0].titre, TITRE_DEFAUT);
t('un rapport ancien sans champ titre retombe sur le défaut à l ouverture', ouvrirAvecTitre({personne:'X',objectifs:[]}).titre, TITRE_DEFAUT);
t('un rapport avec titre le restaure tel quel', ouvrirAvecTitre({personne:'X',objectifs:[],titre:'Bilan trimestriel'}).titre, 'Bilan trimestriel');
/* Réenregistrer sous le même nom mais un titre différent remplace le titre,
   comme le reste de la composition */
listeTitres=enregistrerAvecTitre(listeTitres,'Bilan T.B.',{personne:'T.B.',objectifs:[],titre:'Bilan de fin d’année'});
t('réenregistrer remplace aussi le titre', listeTitres.find(r=>r.nom==='Bilan T.B.').titre, 'Bilan de fin d’année');

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
