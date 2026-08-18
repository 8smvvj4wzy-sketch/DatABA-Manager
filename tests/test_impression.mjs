let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

/* Reproduction minimale du DOM de Manager pour vérifier la règle de masquage.
   Structure réelle : body > div.app > div.conteneur > div.no-print(onglets)
                                                     > div(contenu) > Card > div.zone */
const noeud=(nom,enfants=[])=>({nom,classes:new Set(),enfants,parent:null});
const brancher=(p)=>{p.enfants.forEach(e=>{e.parent=p;brancher(e);});return p;};

const zone=noeud('zone');
const carte=noeud('carte',[noeud('commandes'),zone]);
const contenu=noeud('contenu',[carte]);
/* Tous les onglets vivent dans un conteneur marqué no-print : c'est lui qui
   produisait des pages blanches, en masquant la zone avec le reste. */
contenu.classes.add('no-print');
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
  /* .no-print:not(.chemin-impression) { display:none } */
  if(n.classes.has('no-print')&&!n.classes.has('chemin'))return true;
  const p=n.parent;
  if(!p)return false;
  return p.classes.has('chemin')&&!n.classes.has('chemin')&&!n.classes.has('zone');
}
/* Un nœud est absent du rendu si lui ou un ancêtre est masqué */
function absent(n){let x=n;while(x){if(masque(x))return true;x=x.parent;}return false;}

t('un conteneur no-print sur le chemin ne masque plus la zone', absent(zone), false);
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
/* Seules les classes posées pour l'impression doivent disparaître ; no-print
   appartient au balisage permanent et reste en place. */
const restantes=[];(function parcours(n){
  if(n.classes.has('chemin')||n.classes.has('zone'))restantes.push(n.nom);
  n.enfants.forEach(parcours);})(body);
t('aucune classe d impression ne subsiste', restantes, []);
t('et tout redevient visible', [absent(onglets),absent(toast)], [false,false]);
/* Hors impression ciblée, le conteneur no-print doit redevenir masquant */
t('le no-print reprend son effet une fois le chemin nettoyé', absent(zone), true);

/* ==================== Le tableau de la Revue ====================
   Seconde cible d'impression ciblée, ajoutée au Tableau de bord. Sa structure
   diffère de la première sur deux points qui sont précisément ceux qui cassent
   l'impression, d'où ce second modèle plutôt qu'une assertion de plus :
   - la cible est un div à l'intérieur d'une Card, donc un niveau plus bas que
     la zone d'origine (`Card` est un composant fonction : il ne reçoit pas de
     `ref`, la cible ne peut pas être la Card elle-même) ;
   - elle a pour frère une barre de commandes qui porte le bouton PDF, lequel
     ne doit évidemment pas figurer sur le document qu'il déclenche.
   Le conteneur d'onglets marqué no-print est reconduit : c'est lui qui a déjà
   produit des pages blanches une fois. */
const table=noeud('table');
const divRevue=noeud('divRevue',[table]);
const carteRevue=noeud('carteRevue',[divRevue]);
const btnPdf=noeud('btnPdf');btnPdf.classes.add('no-print');
const barreTitre=noeud('barreTitre',[btnPdf]);
const carteArbitrage=noeud('carteArbitrage');
const selecteur=noeud('selecteur');selecteur.classes.add('no-print');
const bord=noeud('bord',[selecteur,carteArbitrage,barreTitre,carteRevue]);
const sectionOnglet=noeud('sectionOnglet',[bord]);sectionOnglet.classes.add('no-print');
const conteneur2=noeud('conteneur',[sectionOnglet]);
const app2=noeud('app',[conteneur2]);
const body2=brancher(noeud('body',[app2]));

/* Même marquage et mêmes règles que plus haut, sur ce second arbre. */
function marquer2(cible){let n=cible.parent;while(n&&n!==body2){n.classes.add('chemin');n=n.parent;}body2.classes.add('chemin');cible.classes.add('zone');}
function masque2(n){if(n.classes.has('no-print')&&!n.classes.has('chemin'))return true;const p=n.parent;if(!p)return false;return p.classes.has('chemin')&&!n.classes.has('chemin')&&!n.classes.has('zone');}
function absent2(n){let x=n;while(x){if(masque2(x))return true;x=x.parent;}return false;}
marquer2(divRevue);

t('le tableau de la Revue est imprimé', absent2(divRevue), false);
t('son contenu aussi', absent2(table), false);
t('la Card qui l entoure reste, comme ancêtre du chemin', absent2(carteRevue), false);
t('le conteneur d onglet no-print ne masque pas la cible', absent2(sectionOnglet), false);
t('la barre de commandes voisine est retirée', absent2(barreTitre), true);
t('le bouton PDF ne s imprime pas lui-meme', absent2(btnPdf), true);
t('la file A arbitrer est retiree', absent2(carteArbitrage), true);
t('le selecteur de periode est retire', absent2(selecteur), true);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
