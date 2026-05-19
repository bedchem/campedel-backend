#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Campedèl · Cloudflare Named Tunnel Setup
# Läuft auf Linux — installiert cloudflared und richtet alles ein
# Nutzung: ./setup-cloudflare.sh [hostname]
#          TUNNEL_NAME=myapp ./setup-cloudflare.sh api.domain.com
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Farben ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Konfiguration ──────────────────────────────────────────────────
TUNNEL_NAME="${TUNNEL_NAME:-campedel}"
SERVICE_PORT="${SERVICE_PORT:-3001}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${DATA_DIR:-$PROJECT_DIR/data}"
STATE_FILE="$DATA_DIR/cloudflared-state.json"
ENV_FILE="$PROJECT_DIR/.env"
CF_DIR="$HOME/.cloudflared"
LOG_FILE="$CF_DIR/tunnel.log"
HOSTNAME_ARG="${1:-}"

# ── Hilfsfunktionen ────────────────────────────────────────────────
step()  { echo -e "\n${BOLD}${BLUE}▸ Schritt $1: $2${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail()  { echo -e "\n  ${RED}✗ FEHLER: $1${NC}\n"; exit 1; }
info()  { echo -e "  ${CYAN}→${NC} $1"; }
hr()    { echo -e "${BLUE}──────────────────────────────────────────${NC}"; }

write_state() {
  mkdir -p "$DATA_DIR"
  cat > "$STATE_FILE" << EOF
{
  "installed": $1,
  "authenticated": $2,
  "tunnelId": "$3",
  "tunnelName": "$4",
  "hostname": "$5",
  "configured": $6,
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

# ── Header ─────────────────────────────────────────────────────────
echo ""
hr
echo -e "${BOLD}${CYAN}  Campedèl · Cloudflare Tunnel Setup${NC}"
hr
echo ""

# ════════════════════════════════════════════════════════════════════
# SCHRITT 1: cloudflared installieren
# ════════════════════════════════════════════════════════════════════
step 1 "cloudflared installieren"

install_cloudflared() {
  # Architektur erkennen
  local arch
  case "$(uname -m)" in
    x86_64)        arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    armv7l)        arch="arm"   ;;
    *) fail "Nicht unterstützte Architektur: $(uname -m)" ;;
  esac
  info "Architektur: $arch"

  # Neueste Version
  local latest_url="https://github.com/cloudflare/cloudflared/releases/latest"
  local version
  version=$(curl -fsSIL "$latest_url" 2>/dev/null | grep -i "^location:" \
    | grep -oE "v[0-9]+\.[0-9]+\.[0-9]+" | tail -1 || echo "latest")
  info "Installiere Version: $version"

  local base="https://github.com/cloudflare/cloudflared/releases/latest/download"
  local tmp_dir
  tmp_dir=$(mktemp -d)
  trap "rm -rf $tmp_dir" EXIT

  if command -v dpkg &>/dev/null && [[ "$arch" != "arm" ]]; then
    # Debian / Ubuntu
    info "Lade .deb-Paket..."
    curl -fsSL "$base/cloudflared-linux-${arch}.deb" -o "$tmp_dir/cloudflared.deb"
    if [[ $EUID -eq 0 ]]; then
      dpkg -i "$tmp_dir/cloudflared.deb"
    else
      sudo dpkg -i "$tmp_dir/cloudflared.deb"
    fi
  elif command -v rpm &>/dev/null && [[ "$arch" != "arm" ]]; then
    # RHEL / CentOS / Fedora
    info "Lade .rpm-Paket..."
    curl -fsSL "$base/cloudflared-linux-${arch}.rpm" -o "$tmp_dir/cloudflared.rpm"
    if [[ $EUID -eq 0 ]]; then
      rpm -iv "$tmp_dir/cloudflared.rpm"
    else
      sudo rpm -iv "$tmp_dir/cloudflared.rpm"
    fi
  else
    # Generisches Binary
    info "Lade Binary direkt..."
    curl -fsSL "$base/cloudflared-linux-${arch}" -o "$tmp_dir/cloudflared"
    chmod +x "$tmp_dir/cloudflared"
    if [[ $EUID -eq 0 ]]; then
      mv "$tmp_dir/cloudflared" /usr/local/bin/cloudflared
    else
      sudo mv "$tmp_dir/cloudflared" /usr/local/bin/cloudflared
    fi
  fi
}

if command -v cloudflared &>/dev/null; then
  CF_VER=$(cloudflared --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "?")
  ok "cloudflared ist bereits installiert (v$CF_VER)"

  # Update-Angebot
  LATEST_VER=$(curl -fsSIL "https://github.com/cloudflare/cloudflared/releases/latest" 2>/dev/null \
    | grep -i "^location:" | grep -oE "v[0-9]+\.[0-9]+\.[0-9]+" | tail -1 \
    | tr -d 'v' || echo "")
  if [[ -n "$LATEST_VER" && "$CF_VER" != "$LATEST_VER" ]]; then
    warn "Update verfügbar: v$CF_VER → v$LATEST_VER"
    read -rp "  Jetzt updaten? [j/N] " do_update || do_update="N"
    if [[ "${do_update,,}" == "j" || "${do_update,,}" == "y" ]]; then
      install_cloudflared
      CF_VER=$(cloudflared --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "?")
      ok "Update abgeschlossen: v$CF_VER"
    fi
  fi
else
  info "cloudflared nicht gefunden — installiere..."
  install_cloudflared

  if ! command -v cloudflared &>/dev/null; then
    fail "Installation fehlgeschlagen. Bitte manuell installieren:\nhttps://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/"
  fi
  CF_VER=$(cloudflared --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "?")
  ok "cloudflared installiert: v$CF_VER"
fi

write_state true false "" "" "" false

# ════════════════════════════════════════════════════════════════════
# SCHRITT 2: Cloudflare Account authentifizieren
# ════════════════════════════════════════════════════════════════════
step 2 "Cloudflare Account verifizieren"

mkdir -p "$CF_DIR"

if [[ -f "$CF_DIR/cert.pem" ]]; then
  ok "Bereits authentifiziert (cert.pem vorhanden)"
else
  echo ""
  echo -e "  ${BOLD}Browser-Authentifizierung erforderlich:${NC}"
  echo "  1. Ein Login-Link wird gleich angezeigt"
  echo "  2. Öffne den Link im Browser"
  echo "  3. Melde dich mit deinem Cloudflare-Account an"
  echo "  4. Wähle die Domain aus, die du nutzen möchtest"
  echo "  5. Das Script wartet automatisch auf die Bestätigung"
  echo ""
  read -rp "  [Enter] drücken um fortzufahren..." _

  echo ""
  info "Starte cloudflared tunnel login..."
  echo "  ─────────────────────────────────────"

  # cloudflared login blockiert, bis der User im Browser bestätigt
  # Der Login-Link erscheint automatisch in der Ausgabe
  if cloudflared tunnel login 2>&1; then
    if [[ -f "$CF_DIR/cert.pem" ]]; then
      ok "Authentifizierung erfolgreich!"
    else
      fail "cert.pem wurde nicht erstellt. Bitte nochmals versuchen."
    fi
  else
    fail "cloudflared tunnel login ist fehlgeschlagen."
  fi
fi

write_state true true "" "" "" false

# ════════════════════════════════════════════════════════════════════
# SCHRITT 3: Hostname eingeben
# ════════════════════════════════════════════════════════════════════
step 3 "Hostname festlegen"

if [[ -z "$HOSTNAME_ARG" ]]; then
  echo ""
  echo "  Die Domain muss in Cloudflare als Nameserver eingetragen sein."
  echo ""
  read -rp "  Hostname eingeben (z.B. api.yourdomain.com): " HOSTNAME_ARG
fi

[[ -z "$HOSTNAME_ARG" ]] && fail "Kein Hostname angegeben."

# Einfache Validierung
if ! echo "$HOSTNAME_ARG" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)+$'; then
  fail "Ungültiger Hostname: '$HOSTNAME_ARG'\nBeispiel: api.yourdomain.com"
fi

ok "Hostname: $HOSTNAME_ARG"

# ════════════════════════════════════════════════════════════════════
# SCHRITT 4: Named Tunnel erstellen
# ════════════════════════════════════════════════════════════════════
step 4 "Named Tunnel erstellen"

TUNNEL_ID=""

# Prüfe ob Tunnel mit diesem Namen schon existiert
EXISTING_LIST=$(cloudflared tunnel list 2>/dev/null || echo "")
if echo "$EXISTING_LIST" | grep -q "$TUNNEL_NAME"; then
  TUNNEL_ID=$(echo "$EXISTING_LIST" | awk -v name="$TUNNEL_NAME" '$0 ~ name {print $1}' | head -1)
  if [[ -n "$TUNNEL_ID" ]]; then
    ok "Tunnel '$TUNNEL_NAME' existiert bereits (ID: $TUNNEL_ID)"
  fi
fi

if [[ -z "$TUNNEL_ID" ]]; then
  info "Erstelle neuen Tunnel '$TUNNEL_NAME'..."
  CREATE_OUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1)
  echo "$CREATE_OUT" | sed 's/^/    /'

  # UUID aus Ausgabe extrahieren
  TUNNEL_ID=$(echo "$CREATE_OUT" \
    | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' \
    | head -1)

  [[ -z "$TUNNEL_ID" ]] && fail "Konnte Tunnel-ID nicht ermitteln.\nAusgabe: $CREATE_OUT"
  ok "Tunnel erstellt: $TUNNEL_ID"
fi

write_state true true "$TUNNEL_ID" "$TUNNEL_NAME" "$HOSTNAME_ARG" false

# ════════════════════════════════════════════════════════════════════
# SCHRITT 5: config.yml erstellen
# ════════════════════════════════════════════════════════════════════
step 5 "Konfigurationsdatei erstellen"

CREDS_FILE="$CF_DIR/${TUNNEL_ID}.json"
if [[ ! -f "$CREDS_FILE" ]]; then
  warn "Credentials-Datei nicht gefunden: $CREDS_FILE"
fi

cat > "$CF_DIR/config.yml" << CONFIGEOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS_FILE}
logfile: ${LOG_FILE}

ingress:
  - hostname: ${HOSTNAME_ARG}
    service: http://localhost:${SERVICE_PORT}
  - service: http_status:404
CONFIGEOF

ok "config.yml erstellt: $CF_DIR/config.yml"
echo ""
cat "$CF_DIR/config.yml" | sed 's/^/    /'

# ════════════════════════════════════════════════════════════════════
# SCHRITT 6: DNS CNAME konfigurieren
# ════════════════════════════════════════════════════════════════════
step 6 "DNS konfigurieren"

info "Erstelle CNAME: $HOSTNAME_ARG → ${TUNNEL_ID}.cfargotunnel.com"

DNS_OUT=$(cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME_ARG" 2>&1) && DNS_OK=true || DNS_OK=false

if $DNS_OK; then
  ok "DNS CNAME gesetzt: $HOSTNAME_ARG → ${TUNNEL_ID}.cfargotunnel.com"
else
  warn "DNS-Setup fehlgeschlagen. Bitte manuell im Cloudflare Dashboard einrichten:"
  echo ""
  echo "    Typ:  CNAME"
  echo "    Name: $HOSTNAME_ARG"
  echo "    Ziel: ${TUNNEL_ID}.cfargotunnel.com"
  echo "    Proxy: Ein (orange)"
  echo ""
  echo "  Fehlermeldung: $DNS_OUT"
fi

# ════════════════════════════════════════════════════════════════════
# SCHRITT 7: Tunnel als Dienst starten
# ════════════════════════════════════════════════════════════════════
step 7 "Tunnel starten"

start_as_service() {
  info "Installiere als systemd-Service..."
  if [[ $EUID -eq 0 ]]; then
    cloudflared --config "$CF_DIR/config.yml" service install 2>&1 || true
    systemctl enable cloudflared 2>&1 || true
    systemctl restart cloudflared
  else
    sudo cloudflared --config "$CF_DIR/config.yml" service install 2>&1 || true
    sudo systemctl enable cloudflared 2>&1 || true
    sudo systemctl restart cloudflared
  fi
  sleep 2
  local status
  status=$(systemctl is-active cloudflared 2>/dev/null || echo "unknown")
  if [[ "$status" == "active" ]]; then
    ok "cloudflared läuft als systemd-Service"
    return 0
  fi
  warn "systemd-Service nicht aktiv (Status: $status)"
  return 1
}

start_in_background() {
  info "Starte cloudflared im Hintergrund..."
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || LOG_FILE="/tmp/cloudflared.log"
  nohup cloudflared tunnel --config "$CF_DIR/config.yml" run > "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > /tmp/cloudflared.pid
  sleep 3
  if kill -0 "$pid" 2>/dev/null; then
    ok "cloudflared läuft im Hintergrund (PID: $pid)"
    ok "Log: $LOG_FILE"
    return 0
  fi
  warn "Hintergrundprozess sofort beendet. Log: $LOG_FILE"
  cat "$LOG_FILE" 2>/dev/null | tail -10 | sed 's/^/    /' || true
  return 1
}

if command -v systemctl &>/dev/null; then
  start_as_service || start_in_background
else
  start_in_background
fi

write_state true true "$TUNNEL_ID" "$TUNNEL_NAME" "$HOSTNAME_ARG" true

# ════════════════════════════════════════════════════════════════════
# SCHRITT 8: .env aktualisieren
# ════════════════════════════════════════════════════════════════════
step 8 ".env aktualisieren"

if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^BASE_URL=" "$ENV_FILE"; then
    sed -i "s|^BASE_URL=.*|BASE_URL=https://${HOSTNAME_ARG}|" "$ENV_FILE"
    ok "BASE_URL aktualisiert → https://${HOSTNAME_ARG}"
  else
    echo "BASE_URL=https://${HOSTNAME_ARG}" >> "$ENV_FILE"
    ok "BASE_URL hinzugefügt → https://${HOSTNAME_ARG}"
  fi
else
  warn ".env nicht gefunden ($ENV_FILE) — BASE_URL nicht aktualisiert"
fi

# ════════════════════════════════════════════════════════════════════
# FERTIG
# ════════════════════════════════════════════════════════════════════
echo ""
hr
echo -e "${BOLD}${GREEN}  ✓ Cloudflare Tunnel eingerichtet!${NC}"
hr
echo ""
echo -e "  ${BOLD}URL:${NC}         https://${HOSTNAME_ARG}"
echo -e "  ${BOLD}Admin:${NC}       https://${HOSTNAME_ARG}/admin"
echo -e "  ${BOLD}Tunnel-ID:${NC}   ${TUNNEL_ID}"
echo -e "  ${BOLD}Tunnel-Name:${NC} ${TUNNEL_NAME}"
echo -e "  ${BOLD}Config:${NC}      ${CF_DIR}/config.yml"
echo -e "  ${BOLD}Log:${NC}         ${LOG_FILE}"
echo ""
echo -e "  ${CYAN}Neu starten:${NC}"
echo "    systemctl restart cloudflared"
echo "    # oder: cloudflared tunnel --config $CF_DIR/config.yml run"
echo ""
hr
echo ""
