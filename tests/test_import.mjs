let ok=0,ko=0;const t=(n,a,e)=>{const p=JSON.stringify(a)===JSON.stringify(e);console.log(`${p?'OK  ':'ECHEC'} ${n}`+(p?'':` → ${JSON.stringify(a)}`));p?ok++:ko++;};

/* Reconnaissance du format au contenu, pas à l'extension */
function reconnaitre(nom, contenu) {
  if (/\.(xlsx|xls|csv)$/i.test(nom)) return 'tableur';
  if (!contenu) return 'illisible';
  if (contenu.format === 'aba-backup-encrypted') return 'chiffre';
  if (contenu.format === 'aba-backup') return 'clair';
  if (contenu.format === 'aba-config') return 'config-seule';
  return 'inconnu';
}
t('rapport Excel refusé avec explication', reconnaitre('rapport-2026-07-29.xlsx', null), 'tableur');
t('CSV refusé aussi', reconnaitre('donnees.csv', null), 'tableur');
t('sauvegarde chiffrée : clé demandée', reconnaitre('sauvegarde.json',{format:'aba-backup-encrypted'}), 'chiffre');
t('sauvegarde en clair : import direct', reconnaitre('sauvegarde.json',{format:'aba-backup'}), 'clair');
t('configuration seule signalée', reconnaitre('configuration.json',{format:'aba-config'}), 'config-seule');
t('fichier illisible', reconnaitre('truc.json', null), 'illisible');
t('extension inhabituelle mais contenu valide',
  reconnaitre('sauvegarde.txt',{format:'aba-backup'}), 'clair');

/* Fenêtre temporelle */
function filtrer(points, jours) {
  const limite = jours ? Date.now() - jours*86400000 : 0;
  return points.filter(p => !limite || new Date(p.date) >= limite);
}
const j = n => new Date(Date.now()-n*86400000).toISOString();
const pts = [{date:j(200)},{date:j(100)},{date:j(20)},{date:j(2)}];
t('30 jours', filtrer(pts,30).length, 2);
t('3 mois', filtrer(pts,90).length, 2);
t('6 mois', filtrer(pts,180).length, 3);
t('tout', filtrer(pts,0).length, 4);

console.log(`\n${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
