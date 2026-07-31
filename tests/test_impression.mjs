let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

/* Reproduction minimale du DOM de Manager pour vérifier la règle de masquage.
   Structure réelle : body > div.app > div.conteneur > div.no-print(onglets)
                                                     > div(contenu) > Card > div.zone */
const noeud=(nom,enfants=[])=>({nom,classes:new Set(),enfants,parent:null});
const brancher=(p)=>{p.enfants.forEach(e=>{e.parent=p;brancher(e);});return p;};

const zone=noeud('zone');
const carte=noeud('carte',[noeud('commandes'),zone]);
const contenu=noeud('contenu',[carte]);
const onglets=noeud('onglets');
const entete=noeud('entete');
const conteneur=noeud('conteneur',[entete,onglets,contenu]);
const app=noeud('app',[conteneur]);
const toast=noeud('toast');
const body=brancher(noeud('body',[app,toast]));

/* Marquage, tel que le fait imprimerZone */
function marquer(cible){
  let n=cible.parent;
  while(n&&n!==body){n.classes.add('chemin');n=n.parent;}
  body.classes.add('chemin');
  cible.classes.add('zone');
}
marquer(zone);

/* Règle CSS : .chemin > *:not(.chemin):not(.zone) { display:none } */
function masque(n){
  const p=n.parent;
  if(!p)return false;
  return p.classes.has('chemin')&&!n.classes.has('chemin')&&!n.classes.has('zone');
}
/* Un nœud est absent du rendu si lui ou un ancêtre est masqué */
function absent(n){let x=n;while(x){if(masque(x))return true;x=x.parent;}return false;}

t('la zone est imprimée', absent(zone), false);
t('ses ancêtres aussi', [absent(carte),absent(contenu),absent(conteneur),absent(app)], [false,false,false,false]);
t('les onglets sont retirés', absent(onglets), true);
t('l entête est retiré', absent(entete), true);
t('le toast est retiré', absent(toast), true);
t('les commandes voisines dans la carte sont retirées', absent(carte.enfants[0]), true);

/* Les enfants de la zone doivent rester : ils ne sont pas sur le chemin, mais
   leur parent n'a pas la classe chemin — c'est tout l'intérêt des deux classes */
const enfantZone=noeud('graphique');enfantZone.parent=zone;zone.enfants.push(enfantZone);
t('le contenu de la zone reste', absent(enfantZone), false);

/* Nettoyage : plus aucune classe ne subsiste */
function nettoyer(cible){
  let n=cible.parent;while(n&&n!==body){n.classes.delete('chemin');n=n.parent;}
  body.classes.delete('chemin');cible.classes.delete('zone');
}
nettoyer(zone);
const toutes=[];(function parcours(n){toutes.push(n.classes.size);n.enfants.forEach(parcours);})(body);
t('aucune classe ne subsiste après impression', toutes.every(x=>x===0), true);
t('et tout redevient visible', [absent(onglets),absent(toast)], [false,false]);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
