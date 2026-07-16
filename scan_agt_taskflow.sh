#!/bin/bash

# ============================================================
#  AGT-TASKFLOW — Script de scan & analyse du projet
#  Usage : bash scan_agt_taskflow.sh [chemin/vers/AGT-TASKFLOW-main]
#  Auteur : généré par Claude (Anthropic)
# ============================================================

set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; MAGENTA='\033[0;35m'
BOLD='\033[1m'; RESET='\033[0m'

# ── Répertoire du projet ──────────────────────────────────
PROJECT_DIR="${1:-$(pwd)}"
REPORT_FILE="$(pwd)/rapport_agt_taskflow_$(date +%Y%m%d_%H%M%S).txt"

log()   { echo -e "${CYAN}${BOLD}[INFO]${RESET} $*"; }
warn()  { echo -e "${YELLOW}${BOLD}[WARN]${RESET} $*"; }
title() { echo -e "\n${BLUE}${BOLD}══════════════════════════════════════════${RESET}"; \
          echo -e "${BLUE}${BOLD}  $*${RESET}"; \
          echo -e "${BLUE}${BOLD}══════════════════════════════════════════${RESET}"; }
ok()    { echo -e "${GREEN}${BOLD}[OK]${RESET} $*"; }

# Tee vers terminal + fichier
exec > >(tee -a "$REPORT_FILE") 2>&1

echo -e "${MAGENTA}${BOLD}"
cat << 'EOF'
  █████╗  ██████╗ ████████╗    ████████╗ █████╗ ███████╗██╗  ██╗███████╗██╗      ██████╗ ██╗    ██╗
 ██╔══██╗██╔════╝ ╚══██╔══╝    ╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██╔════╝██║     ██╔═══██╗██║    ██║
 ███████║██║  ███╗   ██║          ██║   ███████║███████╗█████╔╝ █████╗  ██║     ██║   ██║██║ █╗ ██║
 ██╔══██║██║   ██║   ██║          ██║   ██╔══██║╚════██║██╔═██╗ ██╔══╝  ██║     ██║   ██║██║███╗██║
 ██║  ██║╚██████╔╝   ██║          ██║   ██║  ██║███████║██║  ██╗██║     ███████╗╚██████╔╝╚███╔███╔╝
 ╚═╝  ╚═╝ ╚═════╝    ╚═╝          ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝
EOF
echo -e "${RESET}"
echo -e "${BOLD}  Rapport généré le : $(date '+%d/%m/%Y à %H:%M:%S')${RESET}"
echo -e "${BOLD}  Projet scanné     : ${PROJECT_DIR}${RESET}"
echo -e "${BOLD}  Rapport sauvé     : ${REPORT_FILE}${RESET}\n"

# ── 0. Vérification du répertoire ───────────────────────
title "0. VÉRIFICATION DU RÉPERTOIRE"
if [ ! -d "$PROJECT_DIR" ]; then
  echo -e "${RED}[ERREUR] Répertoire introuvable : $PROJECT_DIR${RESET}"
  echo "Usage : bash scan_agt_taskflow.sh /chemin/vers/AGT-TASKFLOW-main"
  exit 1
fi
ok "Répertoire trouvé : $PROJECT_DIR"

cd "$PROJECT_DIR"

# ── 1. Structure globale ─────────────────────────────────
title "1. STRUCTURE GLOBALE DU PROJET"
find . -maxdepth 4 \
  -not -path '*/node_modules/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/.git/*' \
  -not -path '*/venv/*' \
  -not -path '*/.venv/*' \
  -not -path '*/migrations/__pycache__/*' \
  | sort | head -120

# ── 2. Fichiers racine importants ────────────────────────
title "2. FICHIERS CLÉS À LA RACINE"
for f in docker-compose.yml docker-compose.yaml .env .env.example README.md taskflow_dump.db; do
  if [ -f "$f" ]; then
    ok "Trouvé : $f  ($(du -sh "$f" 2>/dev/null | cut -f1))"
  else
    warn "Absent : $f"
  fi
done

# ── 3. Lecture du README ─────────────────────────────────
title "3. README.md"
if [ -f README.md ]; then
  cat README.md
else
  warn "Pas de README.md"
fi

# ── 4. docker-compose ────────────────────────────────────
title "4. DOCKER-COMPOSE (architecture des services)"
if [ -f docker-compose.yml ]; then
  cat docker-compose.yml
elif [ -f docker-compose.yaml ]; then
  cat docker-compose.yaml
else
  warn "Pas de docker-compose trouvé"
fi

# ── 5. BACKEND ───────────────────────────────────────────
title "5. ANALYSE DU BACKEND"

if [ -d backend ]; then
  log "Structure du backend :"
  find backend -maxdepth 4 \
    -not -path '*/node_modules/*' \
    -not -path '*/__pycache__/*' \
    -not -path '*/venv/*' \
    -not -path '*/.venv/*' \
    | sort

  echo ""
  # Détection du langage / framework
  log "--- Détection du framework backend ---"
  [ -f backend/requirements.txt ]      && ok "Python/Django ou FastAPI (requirements.txt)"     && cat backend/requirements.txt
  [ -f backend/requirements-dev.txt ]  && ok "Requirements dev :" && cat backend/requirements-dev.txt
  [ -f backend/Pipfile ]               && ok "Pipfile trouvé"     && cat backend/Pipfile
  [ -f backend/pyproject.toml ]        && ok "pyproject.toml :"   && cat backend/pyproject.toml
  [ -f backend/package.json ]          && ok "Node.js backend"    && cat backend/package.json
  [ -f backend/pom.xml ]               && ok "Java/Maven"
  [ -f backend/go.mod ]                && ok "Go module"          && cat backend/go.mod
  [ -f backend/Dockerfile ]            && log "Dockerfile backend :" && cat backend/Dockerfile

  echo ""
  log "--- Fichiers Python principaux ---"
  find backend -name "*.py" \
    -not -path '*/__pycache__/*' \
    -not -path '*/migrations/*' \
    -not -path '*/venv/*' \
    | sort | while read -r pyfile; do
      lines=$(wc -l < "$pyfile" 2>/dev/null || echo 0)
      echo "  📄 $pyfile  ($lines lignes)"
  done

  echo ""
  log "--- Modèles de données (models.py) ---"
  find backend -name "models.py" -not -path '*/venv/*' | while read -r mf; do
    echo -e "\n${YELLOW}>>> $mf${RESET}"
    cat "$mf"
  done

  echo ""
  log "--- Vues / Controllers (views.py / routes) ---"
  find backend -name "views.py" -o -name "routes.py" -o -name "router.py" \
    -not -path '*/venv/*' 2>/dev/null | while read -r vf; do
    echo -e "\n${YELLOW}>>> $vf${RESET}"
    cat "$vf"
  done

  echo ""
  log "--- Serializers ---"
  find backend -name "serializers.py" -not -path '*/venv/*' 2>/dev/null | while read -r sf; do
    echo -e "\n${YELLOW}>>> $sf${RESET}"
    cat "$sf"
  done

  echo ""
  log "--- URLs / Endpoints ---"
  find backend -name "urls.py" -not -path '*/venv/*' 2>/dev/null | while read -r uf; do
    echo -e "\n${YELLOW}>>> $uf${RESET}"
    cat "$uf"
  done

  echo ""
  log "--- Settings / Configuration ---"
  find backend -name "settings.py" -o -name "config.py" -o -name ".env" \
    -not -path '*/venv/*' 2>/dev/null | while read -r cf; do
    echo -e "\n${YELLOW}>>> $cf${RESET}"
    # Masquer les secrets éventuels
    grep -v -i 'secret\|password\|token\|key' "$cf" || true
  done

  echo ""
  log "--- Migrations (liste) ---"
  find backend -path '*/migrations/*.py' -not -name '__init__.py' \
    -not -path '*/venv/*' | sort | head -30 | while read -r mig; do
    echo "  🗄  $mig"
  done

else
  warn "Dossier backend/ introuvable"
fi

# ── 6. FRONTEND ──────────────────────────────────────────
title "6. ANALYSE DU FRONTEND"

if [ -d frontend ]; then
  log "Structure du frontend :"
  find frontend -maxdepth 4 \
    -not -path '*/node_modules/*' \
    -not -path '*/.git/*' \
    -not -path '*/dist/*' \
    -not -path '*/build/*' \
    | sort

  echo ""
  log "--- package.json ---"
  [ -f frontend/package.json ] && cat frontend/package.json || warn "Pas de package.json"

  echo ""
  log "--- Fichier de config (vite/webpack/next) ---"
  for cfg in frontend/vite.config.* frontend/webpack.config.* frontend/next.config.* \
              frontend/angular.json frontend/vue.config.*; do
    [ -f "$cfg" ] && echo -e "\n${YELLOW}>>> $cfg${RESET}" && cat "$cfg"
  done

  echo ""
  log "--- Dockerfile frontend ---"
  [ -f frontend/Dockerfile ] && cat frontend/Dockerfile || warn "Pas de Dockerfile frontend"

  echo ""
  log "--- Point d'entrée (src/main / index / App) ---"
  for ep in frontend/src/main.jsx frontend/src/main.tsx frontend/src/main.js \
             frontend/src/index.js frontend/src/App.jsx frontend/src/App.tsx \
             frontend/src/App.vue; do
    [ -f "$ep" ] && echo -e "\n${YELLOW}>>> $ep${RESET}" && cat "$ep"
  done

  echo ""
  log "--- Composants principaux ---"
  find frontend/src -name "*.jsx" -o -name "*.tsx" -o -name "*.vue" \
    -not -path '*/node_modules/*' 2>/dev/null | sort | while read -r comp; do
    lines=$(wc -l < "$comp" 2>/dev/null || echo 0)
    echo "  🧩 $comp  ($lines lignes)"
  done

  echo ""
  log "--- Pages / Routes frontend ---"
  find frontend/src -name "*.jsx" -o -name "*.tsx" | \
    grep -i 'page\|route\|view\|screen' 2>/dev/null | sort | while read -r page; do
    echo -e "\n${YELLOW}>>> $page${RESET}"
    cat "$page"
  done

else
  warn "Dossier frontend/ introuvable"
fi

# ── 7. BASE DE DONNÉES ───────────────────────────────────
title "7. BASE DE DONNÉES (taskflow_dump.db)"

if command -v sqlite3 &>/dev/null; then
  if [ -f taskflow_dump.db ]; then
    ok "SQLite3 disponible — analyse de taskflow_dump.db"
    echo ""
    log "Tables présentes :"
    sqlite3 taskflow_dump.db ".tables"
    echo ""
    log "Schéma complet :"
    sqlite3 taskflow_dump.db ".schema"
    echo ""
    log "Nombre de lignes par table :"
    sqlite3 taskflow_dump.db ".tables" | tr ' ' '\n' | grep -v '^$' | while read -r tbl; do
      count=$(sqlite3 taskflow_dump.db "SELECT COUNT(*) FROM \"$tbl\";" 2>/dev/null || echo "?")
      echo "  📊 $tbl : $count enregistrements"
    done
    echo ""
    log "Aperçu des données (5 lignes par table) :"
    sqlite3 taskflow_dump.db ".tables" | tr ' ' '\n' | grep -v '^$' | while read -r tbl; do
      echo -e "\n${YELLOW}>>> TABLE: $tbl${RESET}"
      sqlite3 -header -column taskflow_dump.db "SELECT * FROM \"$tbl\" LIMIT 5;" 2>/dev/null || true
    done
  else
    warn "taskflow_dump.db introuvable"
  fi
else
  warn "sqlite3 non installé — installer avec : sudo apt install sqlite3"
  if [ -f taskflow_dump.db ]; then
    log "Taille du fichier DB : $(du -sh taskflow_dump.db | cut -f1)"
    log "Tentative de lecture brute (strings) :"
    strings taskflow_dump.db | grep -E 'CREATE TABLE|INSERT INTO' | head -50 || true
  fi
fi

# ── 8. STATISTIQUES DE CODE ──────────────────────────────
title "8. STATISTIQUES DU CODE SOURCE"

log "Comptage par type de fichier :"
echo ""
declare -A ext_count ext_lines

while IFS= read -r file; do
  ext="${file##*.}"
  ext="${ext,,}"
  lines=$(wc -l < "$file" 2>/dev/null || echo 0)
  ext_count[$ext]=$(( ${ext_count[$ext]:-0} + 1 ))
  ext_lines[$ext]=$(( ${ext_lines[$ext]:-0} + lines ))
done < <(find . \
  -not -path '*/node_modules/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/.git/*' \
  -not -path '*/venv/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/migrations/*' \
  -type f \( \
    -name "*.py" -o -name "*.js" -o -name "*.jsx" \
    -o -name "*.ts" -o -name "*.tsx" -o -name "*.vue" \
    -o -name "*.html" -o -name "*.css" -o -name "*.scss" \
    -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" \
    -o -name "*.md" -o -name "*.sh" -o -name "*.go" \
    -o -name "*.java" -o -name "*.rs" \
  \))

printf "  %-10s %8s %12s\n" "Extension" "Fichiers" "Lignes"
printf "  %-10s %8s %12s\n" "─────────" "────────" "──────────"
for ext in "${!ext_count[@]}"; do
  printf "  %-10s %8d %12d\n" ".$ext" "${ext_count[$ext]}" "${ext_lines[$ext]}"
done | sort -k3 -rn

echo ""
log "Total fichiers (hors node_modules, venv, dist) :"
find . -not -path '*/node_modules/*' -not -path '*/__pycache__/*' \
  -not -path '*/.git/*' -not -path '*/venv/*' -not -path '*/dist/*' \
  -not -path '*/build/*' -type f | wc -l

# ── 9. TECHNOLOGIES DÉTECTÉES ────────────────────────────
title "9. TECHNOLOGIES DÉTECTÉES"

detect() {
  local name="$1"; local check="$2"
  eval "$check" &>/dev/null && ok "$name" || true
}

log "Backend :"
detect "Python"          "find backend -name '*.py' | head -1 | grep -q ."
detect "Django"          "grep -rq 'django' backend/requirements*.txt 2>/dev/null"
detect "FastAPI"         "grep -rq 'fastapi' backend/requirements*.txt 2>/dev/null"
detect "Flask"           "grep -rq 'flask' backend/requirements*.txt 2>/dev/null"
detect "SQLAlchemy"      "grep -rq 'sqlalchemy' backend/requirements*.txt 2>/dev/null"
detect "DRF (Django REST)" "grep -rq 'djangorestframework' backend/requirements*.txt 2>/dev/null"
detect "Celery"          "grep -rq 'celery' backend/requirements*.txt 2>/dev/null"
detect "Redis"           "grep -rq 'redis' backend/requirements*.txt 2>/dev/null || grep -rq 'redis' docker-compose.yml 2>/dev/null"
detect "PostgreSQL"      "grep -rq 'psycopg\|postgres' backend/requirements*.txt 2>/dev/null || grep -rq 'postgres' docker-compose.yml 2>/dev/null"
detect "SQLite"          "find . -name '*.db' | grep -q ."
detect "JWT Auth"        "grep -rq 'jwt\|simplejwt' backend/requirements*.txt 2>/dev/null"
detect "Node.js backend" "[ -f backend/package.json ]"

echo ""
log "Frontend :"
detect "React"            "grep -rq 'react' frontend/package.json 2>/dev/null"
detect "Vue.js"           "grep -rq 'vue' frontend/package.json 2>/dev/null"
detect "Angular"          "grep -rq 'angular' frontend/package.json 2>/dev/null"
detect "Next.js"          "grep -rq 'next' frontend/package.json 2>/dev/null"
detect "Vite"             "grep -rq 'vite' frontend/package.json 2>/dev/null"
detect "TypeScript"       "find frontend/src -name '*.ts' -o -name '*.tsx' | grep -q ."
detect "Tailwind CSS"     "grep -rq 'tailwindcss' frontend/package.json 2>/dev/null"
detect "Axios"            "grep -rq 'axios' frontend/package.json 2>/dev/null"
detect "Redux / Zustand"  "grep -rq 'redux\|zustand\|@reduxjs' frontend/package.json 2>/dev/null"
detect "React Router"     "grep -rq 'react-router' frontend/package.json 2>/dev/null"

echo ""
log "Infrastructure :"
detect "Docker"            "[ -f docker-compose.yml ] || [ -f docker-compose.yaml ]"
detect "Nginx"             "grep -rq 'nginx' docker-compose.yml 2>/dev/null"
detect "Gunicorn"          "grep -rq 'gunicorn' backend/requirements*.txt 2>/dev/null || grep -rq 'gunicorn' docker-compose.yml 2>/dev/null"

# ── 10. ENDPOINTS API ────────────────────────────────────
title "10. INVENTAIRE DES ENDPOINTS API"

log "Endpoints détectés (urls.py / router) :"
find . -name "urls.py" -not -path '*/venv/*' -not -path '*/__pycache__/*' \
  2>/dev/null | while read -r uf; do
  echo -e "\n${YELLOW}>>> $uf${RESET}"
  grep -E "path\(|url\(|router\.register\|include\(" "$uf" || true
done

find . -name "routes.py" -o -name "router.py" \
  -not -path '*/venv/*' 2>/dev/null | while read -r rf; do
  echo -e "\n${YELLOW}>>> $rf${RESET}"
  grep -E "@app\.|@router\.|add_api_route\|prefix=" "$rf" || true
done

# ── 11. RÉSUMÉ EXÉCUTIF ──────────────────────────────────
title "11. RÉSUMÉ EXÉCUTIF AUTOMATIQUE"

echo ""
echo -e "${BOLD}Projet     :${RESET} AGT-TASKFLOW"
echo -e "${BOLD}Rapport    :${RESET} $(date '+%d/%m/%Y')"
echo ""
echo -e "${BOLD}Architecture détectée :${RESET}"
echo "  • Séparation backend / frontend claire"
[ -f docker-compose.yml ] && echo "  • Orchestration Docker Compose"
[ -f taskflow_dump.db ]   && echo "  • Base de données SQLite embarquée (taskflow_dump.db)"
echo ""
echo -e "${BOLD}Prochaines étapes recommandées :${RESET}"
echo "  1. Lire le rapport complet : $REPORT_FILE"
echo "  2. Lancer docker-compose up --build"
echo "  3. Vérifier les variables d'environnement (.env)"
echo "  4. Accéder à l'interface frontend et tester les endpoints"
echo ""

ok "══════════════════════════════════════════════════════════"
ok " Scan terminé ! Rapport complet sauvegardé dans :"
ok " $REPORT_FILE"
ok "══════════════════════════════════════════════════════════"
