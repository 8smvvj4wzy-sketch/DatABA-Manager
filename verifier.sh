#!/bin/bash
# Vérification avant livraison — à lancer depuis la racine d'un dépôt.
#   usage : ./verifier.sh
#
# Contrôles, dans l'ordre où ils attrapent le plus de choses. La numérotation
# suit celle de DatABA (verifier.sh) pour les contrôles communs aux deux
# dépôts — 2 ter (finalizeSession) n'a pas d'équivalent ici, tabette
# uniquement, donc pas de trou comblé artificiellement :
#   1. syntaxe et références (tsc en mode JS permissif — le projet n'est pas
#      en TypeScript, tsc ne sert ici que de vérificateur)
#   2. doublons de premier niveau (function, const) ET blocs de rendu dupliqués
#   2 bis. hooks appelés après un retour anticipé
#   2 quater. renommages laissés incomplets (vocabulaire résiduel)
#   2 quinquies. imports dupliqués
#   2 sexies. couleur hexadécimale hors palette catégorielle
#   2 septies. localStorage touché sans passer par le préfixe aba-cadre:
#   2 octies. écriture du bloc consolidé hors de sa couche de stockage
#   3. suite de tests Node autonome

set -u
RACINE="$(cd "$(dirname "$0")" && pwd)"
CIBLE="${1:-.}"
cd "$CIBLE" || exit 1
ECHECS=0
NOM="$(basename "$PWD")"

echo "════════ Vérification : $NOM ════════"

# ── 1. Syntaxe et références ───────────────────────────────────────────
echo
echo "── 1. Syntaxe (tsc) ──"
TMP="$(mktemp -d)"
cat > "$TMP/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "noEmit": true,
    "allowJs": true,
    "checkJs": false,
    "jsx": "preserve",
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "noResolve": true,
    "types": []
  }
}
EOF
for f in src/*.jsx src/*.js; do
  [ -e "$f" ] || continue
  cp "$f" "$TMP/$(basename "$f")"
done
if tsc --project "$TMP/tsconfig.json" 2>&1 | grep -v "Cannot find module" | grep -v "^$" | grep .; then
  echo "  ✗ erreurs de syntaxe"
  ECHECS=$((ECHECS + 1))
else
  echo "  ✓ syntaxe correcte"
fi

# Références inconnues : attrape une variable, une fonction ou une icône
# utilisée mais jamais définie ni importée. C'est ce qui reste après un
# copier-coller partiel, et le grep de doublons ne le voit pas.
cat > "$TMP/tsconfig-refs.json" <<'EOF'
{
  "compilerOptions": {
    "noEmit": true, "allowJs": true, "checkJs": true, "jsx": "react",
    "target": "ES2020", "module": "ESNext", "moduleResolution": "bundler",
    "skipLibCheck": true, "noResolve": true, "types": [],
    "strict": false, "noImplicitAny": false
  }
}
EOF
INCONNUS=$(tsc --project "$TMP/tsconfig-refs.json" 2>&1 | grep -E "Cannot find name" | head -20)
if [ -n "$INCONNUS" ]; then
  echo "  ✗ références inconnues :"
  echo "$INCONNUS" | sed 's/^/      /'
  ECHECS=$((ECHECS + 1))
else
  echo "  ✓ aucune référence inconnue"
fi
rm -rf "$TMP"

# ── 2. Doublons ────────────────────────────────────────────────────────
echo
echo "── 2. Doublons ──"
DOUBLONS=0
for f in src/App.jsx; do
  [ -e "$f" ] || continue
  D_FN=$(grep -oP "^function \K\w+" "$f" | sort | uniq -d)
  D_CO=$(grep -oP "^const \K\w+" "$f" | sort | uniq -d)
  D_CL=$(grep -oP "^class \K\w+" "$f" | sort | uniq -d)
  [ -n "$D_FN" ] && { echo "  ✗ fonctions en double : $D_FN"; DOUBLONS=1; }
  [ -n "$D_CO" ] && { echo "  ✗ constantes en double : $D_CO"; DOUBLONS=1; }
  [ -n "$D_CL" ] && { echo "  ✗ classes en double : $D_CL"; DOUBLONS=1; }

  # Blocs de rendu conditionnels dupliqués : {vue === 'x' && …} écrit deux fois
  # dans le même composant produit deux affichages superposés. Le grep de
  # premier niveau ne les voit pas — c'est ce qui a laissé passer un doublon de
  # sous-vue dans la fiche personne.
  # La garde doit être seule — « {vue === 'x' && ( » en début de ligne. Sans
  # cette exigence, deux conditions différentes qui commencent pareil
  # ({mode === 'export' && (} et {mode === 'export' && p1.length > 0 && (})
  # seraient signalées à tort. La variable reste dans la clé, pour ne pas
  # confondre vue === 'crises' de la fiche personne avec tab === 'crises' de
  # la navigation.
  D_VUE=$(grep -oP "^\s*\{\K(vue|tab|ecran|mode) === '[a-zA-Z_]+'(?= && \()" "$f" | sort | uniq -d)
  [ -n "$D_VUE" ] && { echo "  ✗ blocs de rendu en double : $D_VUE"; DOUBLONS=1; }
done
[ "$DOUBLONS" -eq 0 ] && echo "  ✓ aucun doublon" || ECHECS=$((ECHECS + 1))

# ── 2 bis. Hooks après un retour anticipé ──────────────────────────────
# React exige que les hooks soient appelés dans le même ordre à chaque rendu.
# Un useState ou useEffect placé après un « if (…) return <Empty/> » casse
# cette règle dès que la condition devient vraie, et le plantage n'arrive
# qu'à ce moment-là — donc jamais pendant les essais.
echo
echo "── 2 bis. Ordre des hooks ──"
FAUTIFS=$(awk '
  /^function [A-Z]/ { split($2, a, "("); fn = a[1]; apresRetour = 0; garde = 0; next }
  /^}/ { fn = ""; apresRetour = 0; garde = 0; next }
  fn == "" { next }
  # Garde de premier niveau ouverte sur plusieurs lignes : « if (…) { » indenté
  # de deux espaces, refermée par un « } » au même niveau. Seul un return SITUÉ
  # DEDANS est un retour anticipé. Compter tout return indenté de quatre espaces
  # attrapait aussi ceux des callbacks — un « return undefined » dans un
  # useEffect faisait alors passer tout le reste du composant pour fautif, et le
  # contrôle ne protégeait plus rien.
  # Motifs sans \< ni \> : mawk, l awk par défaut d Ubuntu, ne les connaît pas.
  garde == 0 && /^  if .*\{[ ]*$/ { garde = 1; next }
  garde == 1 && /^  \}/ { garde = 0; next }
  garde == 1 && /return/ { apresRetour = 1; next }
  # Garde tenant sur une seule ligne, ou sortie sèche du corps.
  /^  if .*return/ || /^  return/ { apresRetour = 1; next }
  apresRetour && /use(State|Effect|Memo|Ref|Reducer|Callback)[ ]*\(/ {
    print "      " fn " ligne " NR " : " $0
  }
' src/App.jsx | head -10)
if [ -n "$FAUTIFS" ]; then
  echo "  ✗ hook appelé après un retour anticipé :"
  echo "$FAUTIFS"
  ECHECS=$((ECHECS + 1))
else
  echo "  ✓ hooks appelés inconditionnellement"
fi

# ── 2 quater. Renommages laissés incomplets ────────────────────────────
# Un renommage à l'échelle du fichier laisse facilement une trace : un
# libellé, un commentaire, un nom de fonction oublié pendant qu'un autre a
# bien été renommé. Registre des renommages déjà vérifiés, avec leurs
# exceptions légitimes — même principe que côté DatABA.
echo
echo "── 2 quater. Renommages laissés incomplets ──"
RENOMMAGES=0

# Groupe → Classe (lot classes du rattrapage). Seule exception légitime : le
# commentaire qui documente la migration elle-même sur nomClasseDe.
RESIDUS_GROUPE=$(grep -n '\bGroupe\b' src/App.jsx | grep -v 'migré Groupe → Classe')
if [ -n "$RESIDUS_GROUPE" ]; then
  echo "  ✗ vocabulaire « Groupe » résiduel (Classe attendu) :"
  echo "$RESIDUS_GROUPE" | sed 's/^/      /' | head -10
  RENOMMAGES=1
fi

# EFL → code de curriculum (lot suivi & rapports). L'identifiant `codesEfl` ne
# matche pas \bEFL\b (pas de frontière de mot avant le E de Efl) et n'a donc
# pas besoin d'exception explicite ; seule celle qui documente pourquoi la clé
# ne suit pas le renommage doit rester tolérée.
RESIDUS_EFL=$(grep -n '\bEFL\b' src/App.jsx | grep -v 'un renommage de clé casserait')
if [ -n "$RESIDUS_EFL" ]; then
  echo "  ✗ vocabulaire « EFL » résiduel (code de curriculum attendu) :"
  echo "$RESIDUS_EFL" | sed 's/^/      /' | head -10
  RENOMMAGES=1
fi

[ "$RENOMMAGES" -eq 0 ] && echo "  ✓ aucun résidu détecté" || ECHECS=$((ECHECS + 1))

# ── 2 quater bis. Score de cotation lu par le mauvais bout ─────────────
# `objectiveScoreValue` est l'auxiliaire interne de `valeurCotation` : il ne
# sait calculer que les modes dont le score est un pourcentage DIRECT et rend
# null pour l'occurrence comme pour l'intervalle. L'appeler depuis un écran y
# fait donc disparaître ces deux modes, sans le moindre signal — et c'est
# arrivé à trois endroits à la fois : le détail d'une séance affichait
# « non coté » sur plus d'une cotation sur trois, le compteur de la liste des
# séances sous-comptait les 134 séances du jeu de démonstration, et la table
# de faits sortait les cotations en Intervalle du taux d'autonomie. Les 24
# suites étaient vertes pendant ce temps : la faute n'est pas dans le calcul,
# elle est dans le choix de la fonction appelée.
#
# Un seul appel est légitime, celui que `valeurCotation` fait lui-même.
# Contrôle validé par test négatif : rétablir un des trois appels d'origine
# fait bien échouer la ligne ci-dessous.
echo
echo "── 2 quater bis. Aiguillage du score de cotation ──"
APPELS=$(grep -n 'objectiveScoreValue(' src/App.jsx \
  | grep -v '^[0-9]*:function objectiveScoreValue(' \
  | grep -v '^[0-9]*: *\*' \
  | grep -v '^[0-9]*: *//')
# L'appel légitime est celui du corps de valeurCotation ; on le retrouve par sa
# forme exacte plutôt que par un numéro de ligne, qui bougerait à chaque édition.
FAUTIFS=$(echo "$APPELS" | grep -v 'const score = objectiveScoreValue(obj, entry, guidances);' | grep .)
if [ -n "$FAUTIFS" ]; then
  echo "  ✗ objectiveScoreValue appelée hors de valeurCotation :"
  echo "$FAUTIFS" | sed 's/^/      /' | head -10
  echo "      → passer par valeurCotation, sinon l'occurrence et l'intervalle disparaissent."
  ECHECS=$((ECHECS + 1))
else
  echo "  ✓ le score de cotation ne se lit que par valeurCotation"
fi

# Même classe de faute, autre bout : le Tableau de bord porte un sélecteur de
# période et lisait `lignes` NON filtré pour ses sept pastilles, leur
# pourcentage et leur liste dépliée, pendant que le reste de l'écran lisait
# `recentes`. À sept jours, cent objectifs annoncés en haut pour cinquante
# affichés en dessous, et un clic sur une pastille ouvrait des objectifs
# absents de la liste. `lignes` n'a qu'un usage légitime dans ce composant :
# produire `recentes`.
CORPS_BORD=$(awk '
  index($0, "function TableauDeBord(") == 1 { grab = 1 }
  grab { print }
  grab && /^\}/ && index($0, "function TableauDeBord(") != 1 { exit }
' src/App.jsx)
if [ -z "$CORPS_BORD" ]; then
  echo "  ✗ composant TableauDeBord introuvable"
  ECHECS=$((ECHECS + 1))
else
  # Seuls les accès `lignes.xxx` sont cherchés : c'est la forme des trois
  # fautes d'origine (`lignes.filter`, `lignes.length`, `lignes.map`). Une prop
  # JSX `lignes={…}` passée à un sous-composant est un autre sujet, et une
  # mention entre accents graves dans un commentaire n'en est pas un.
  BORD_BRUT=$(echo "$CORPS_BORD" | grep -n 'lignes\.' \
    | grep -v 'const recentes = lignes' \
    | grep -v '^[0-9]*: *\*' \
    | grep -v '^[0-9]*: *//')
  if [ -n "$BORD_BRUT" ]; then
    echo "  ✗ TableauDeBord lit \`lignes\` ailleurs que pour produire \`recentes\` :"
    echo "$BORD_BRUT" | sed 's/^/      /' | head -10
    echo "      → passer par \`recentes\`, sinon la période affichée ne s'applique pas."
    ECHECS=$((ECHECS + 1))
  else
    echo "  ✓ le Tableau de bord ne compte que sur la période affichée"
  fi
fi

# ── 2 quinquies. Imports dupliqués ─────────────────────────────────────
# Un identifiant importé deux fois (copier-coller d'une icône déjà présente
# plus haut dans la liste, le plus souvent) est une erreur de syntaxe pour
# le bundler (Babel/esbuild refusent la double déclaration), mais tsc en
# mode noResolve ne la voit pas. Porté de DatABA verifier.sh à l'identique.
echo
echo "── 2 quinquies. Imports dupliqués ──"
TMP_IMPORTS="$(mktemp)"
awk '
  /^import / { buf=""; grab=1 }
  grab { buf = buf " " $0 }
  grab && /from[ ]+.*;[ ]*$/ { print buf; grab=0 }
' src/App.jsx > "$TMP_IMPORTS"
IMPORTS_DOUBLONS=$(sed -E "s/^ *import //; s/from[ ]+'[^']*';?//; s/[{}]//g" "$TMP_IMPORTS" \
  | tr ',' '\n' \
  | awk '{
      line = $0
      sub(/^[ \t]+/, "", line); sub(/[ \t]+$/, "", line)
      if (line ~ / as /) { sub(/.* as /, "", line) }
      gsub(/\*/, "", line)
      sub(/^[ \t]+/, "", line); sub(/[ \t]+$/, "", line)
      if (line != "") print line
    }' \
  | sort | uniq -d)
rm -f "$TMP_IMPORTS"
if [ -n "$IMPORTS_DOUBLONS" ]; then
  echo "  ✗ identifiant importé plusieurs fois : $(echo "$IMPORTS_DOUBLONS" | tr '\n' ' ')"
  ECHECS=$((ECHECS + 1))
else
  echo "  ✓ aucun import dupliqué"
fi

# ── 2 sexies. Couleur hexadécimale hors palette catégorielle ───────────
# C'est la faute qui casse le thème sombre sans prévenir tant qu'on
# développe en clair : un hex écrit en dur ne suit pas la bascule
# [data-theme]. Seules exceptions légitimes : le bloc de constantes CAT_*
# (fixe entre les deux thèmes, par construction) et le hex transmis à
# `meta.setAttribute('content', …)` dans basculerTheme — un attribut DOM
# littéral, pas une couleur d'interface, qui ne peut pas passer par un
# token CSS.
echo
echo "── 2 sexies. Couleur hexadécimale hors palette catégorielle ──"
HEX_HORS_PALETTE=$(grep -n '#[0-9A-Fa-f]\{6\}' src/App.jsx \
  | grep -v "^[0-9]*:const CAT_" \
  | grep -v "meta.setAttribute('content'")
if [ -n "$HEX_HORS_PALETTE" ]; then
  echo "  ✗ couleur en dur hors palette catégorielle :"
  echo "$HEX_HORS_PALETTE" | sed 's/^/      /' | head -10
  ECHECS=$((ECHECS + 1))
else
  echo "  ✓ aucune couleur en dur hors palette"
fi

# ── 2 septies. localStorage sans le préfixe aba-cadre: ─────────────────
# Les deux applications DatABA partagent le même localStorage sous la même
# adresse github.io : un localStorage.clear() global ou une clé posée sans
# le préfixe aba-cadre: a déjà effacé des données de production. Toute
# clé légitime passe par STORE_KEY, SECU_KEY ou un gabarit `${PREFIXE}…` ;
# `removeItem(k)` est la seule exception, k venant d'une boucle déjà
# filtrée sur le préfixe (effacerDonneesManager).
echo
echo "── 2 septies. localStorage sans le préfixe aba-cadre: ──"
LOCALSTORAGE_SANS_PREFIXE=$(grep -n "localStorage\.\(setItem\|getItem\|removeItem\)(" src/App.jsx \
  | grep -v "STORE_KEY\|SECU_KEY\|PREFIXE\|removeItem(k)")
if [ -n "$LOCALSTORAGE_SANS_PREFIXE" ]; then
  echo "  ✗ localStorage touché sans passer par le préfixe aba-cadre: :"
  echo "$LOCALSTORAGE_SANS_PREFIXE" | sed 's/^/      /' | head -10
  ECHECS=$((ECHECS + 1))
else
  echo "  ✓ tout accès localStorage passe par le préfixe"
fi

# ── 2 octies. Écriture du bloc consolidé hors de sa couche ─────────────
# Le bloc consolidé (STORE_KEY) ne s'écrit que par `sauverDonnees`, qui
# essaie IndexedDB puis localStorage et relit ce qu'il vient d'écrire. Un
# `setItem(STORE_KEY, …)` posé ailleurs saute ce contrôle : `retirerProtection`
# le faisait, et sur un bloc trop gros pour le quota de localStorage il
# perdait tout en silence. Seul `ecrireBloc` a le droit de l'appeler ;
# `removeItem` reste libre, il ne peut rien faire perdre d'autre que le
# doublon laissé par l'ancien emplacement.
echo
echo "── 2 octies. Écriture du bloc consolidé hors de sa couche ──"
ECRITURE_DIRECTE=$(grep -n "localStorage.setItem(STORE_KEY" src/App.jsx \
  | grep -v "window.localStorage.setItem(STORE_KEY, charge)")
if [ -n "$ECRITURE_DIRECTE" ]; then
  echo "  ✗ le bloc consolidé est écrit sans passer par sauverDonnees :"
  echo "$ECRITURE_DIRECTE" | sed 's/^/      /' | head -10
  ECHECS=$((ECHECS + 1))
else
  echo "  ✓ le bloc consolidé ne s'écrit que par sauverDonnees"
fi

# ── 3. Tests ───────────────────────────────────────────────────────────
echo
echo "── 3. Tests ──"
if [ -d tests ] && ls tests/*.mjs >/dev/null 2>&1; then
  N_OK=0; N_KO=0
  for t in tests/*.mjs; do
    if SORTIE=$(node "$t" 2>&1); then
      N_OK=$((N_OK + 1))
    else
      N_KO=$((N_KO + 1))
      echo "  ✗ $(basename "$t")"
      echo "$SORTIE" | sed 's/^/      /' | head -12
    fi
  done
  echo "  $N_OK suite(s) au vert, $N_KO en échec"
  [ "$N_KO" -gt 0 ] && ECHECS=$((ECHECS + 1))
else
  echo "  ⚠ aucun test trouvé dans tests/"
fi

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "════════ $NOM : PRÊT À LIVRER ════════"
  exit 0
fi
echo "════════ $NOM : $ECHECS CONTRÔLE(S) EN ÉCHEC — NE PAS LIVRER ════════"
exit 1
