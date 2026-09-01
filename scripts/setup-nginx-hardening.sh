#!/bin/bash

# Role Reactor Bot - Nginx L7/DDoS Hardening Installer
#
# Installs nginx/ddos-limits.conf + hardened nginx.conf for api.rolereactor.xyz.
# Idempotent (safe to re-run). Auto-detects where the server block currently
# lives. Backs up everything it touches. NEVER reloads unless `nginx -t` passes.
#
# Usage (on the VPS):
#   sudo ./scripts/setup-nginx-hardening.sh            # install + reload
#   sudo ./scripts/setup-nginx-hardening.sh --dry-run  # show what it would do
#   sudo ./scripts/setup-nginx-hardening.sh --revert   # restore from backup

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

DOMAIN="api.rolereactor.xyz"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
SRC_SERVER="$REPO_DIR/nginx.conf"
SRC_LIMITS="$REPO_DIR/nginx/ddos-limits.conf"

SNIPPETS_DIR="/etc/nginx/snippets"
LIMITS_DEST="$SNIPPETS_DIR/ddos-limits.conf"
MAIN_CONF="/etc/nginx/nginx.conf"
HTTP_INCLUDE_LINE="include $LIMITS_DEST;"
BACKUP_DIR="/etc/nginx/rolereactor-hardening-backup"
STAMP="$(date +%Y%m%d-%H%M%S)"

MODE="install"
case "${1:-}" in
    --dry-run) MODE="dry-run" ;;
    --revert)  MODE="revert"  ;;
    "")        ;;
    *)         error "Unknown option: $1 (use --dry-run or --revert)" ;;
esac

show_banner() {
    echo ""
    echo "╭─────────────────────────────────────────────────────────────╮"
    echo "│      Role Reactor Bot - Nginx Hardening Installer           │"
    echo "╰─────────────────────────────────────────────────────────────╯"
    echo ""
}

# --- Preconditions -----------------------------------------------------------
require_root() {
    if [[ $EUID -ne 0 ]]; then
        error "Run as root: sudo $0 ${1:-}"
    fi
}

require_cmd() {
    command -v nginx >/dev/null 2>&1 || error "nginx not found on this system"
}

# Find which file currently defines our server_name. Prefers a file that also
# holds a listen directive for the domain. Prints path, or nothing if absent.
detect_server_file() {
    local f
    # Search conf.d and sites-enabled (follow symlinks in sites-enabled)
    for f in $(nginx -T 2>/dev/null | awk '/# configuration file/{file=$NF} /'"$DOMAIN"'/{print file}' | sort -u); do
        # Skip the main nginx.conf; we want the server-block file
        [[ "$f" == "$MAIN_CONF" ]] && continue
        if grep -q "server_name[[:space:]]*$DOMAIN" "$f" 2>/dev/null; then
            echo "$f"
            return 0
        fi
    done
    # Fallback: common locations
    for f in /etc/nginx/conf.d/rolereactor.conf /etc/nginx/conf.d/$DOMAIN.conf \
             /etc/nginx/sites-enabled/rolereactor /etc/nginx/sites-enabled/rolereactor.conf; do
        [[ -f "$f" ]] && { echo "$f"; return 0; }
    done
    return 1
}

# --- Revert ------------------------------------------------------------------
do_revert() {
    info "Reverting from latest backup in $BACKUP_DIR..."
    [[ -d "$BACKUP_DIR" ]] || error "No backup directory found at $BACKUP_DIR"
    local latest
    latest="$(ls -1dt "$BACKUP_DIR"/*/ 2>/dev/null | head -1)"
    [[ -n "$latest" ]] || error "No timestamped backup found"
    info "Restoring: $latest"

    [[ -f "$latest/main.conf.bak" ]] && { cp "$latest/main.conf.bak" "$MAIN_CONF"; info "restored nginx.conf"; } || true
    if [[ -f "$latest/limits.conf.bak" ]]; then cp "$latest/limits.conf.bak" "$LIMITS_DEST"; info "restored snippet";
    elif [[ -f "$latest/limits.absent" ]]; then rm -f "$LIMITS_DEST"; info "removed snippet"; fi
    # Server block file
    local map="$latest/server-file.txt"
    if [[ -f "$map" ]]; then
        local target; target="$(cat "$map")"
        [[ -f "$latest/server.conf.bak" && -n "$target" ]] && { cp "$latest/server.conf.bak" "$target"; info "restored $target"; }
    fi

    nginx -t && systemctl reload nginx && success "Reverted and reloaded." \
        || error "nginx config test FAILED after revert — inspect manually. Backup: $latest"
}

# --- Install / dry-run -------------------------------------------------------
install() {
    [[ -f "$SRC_SERVER" ]] || error "Missing $SRC_SERVER (run from repo dir)"
    [[ -f "$SRC_LIMITS" ]] || error "Missing $SRC_LIMITS"

    local server_file
    if server_file="$(detect_server_file)"; then
        info "Server block detected at: $server_file"
    else
        server_file="/etc/nginx/conf.d/rolereactor.conf"
        warn "Existing $DOMAIN server block not found — will create $server_file"
    fi

    local already_included="no"
    grep -qF "$HTTP_INCLUDE_LINE" "$MAIN_CONF" && already_included="yes" || true

    echo ""
    info "Planned changes:"
    echo "    1. mkdir -p $SNIPPETS_DIR"
    echo "    2. write  $LIMITS_DEST"
    echo "    3. http{} include in $MAIN_CONF: $([[ "$already_included" == yes ]] && echo '(already present)' || echo 'ADD')"
    echo "    4. write server block -> $server_file"
    echo "    5. nginx -t && systemctl reload nginx"
    echo ""

    if [[ "$MODE" == "dry-run" ]]; then
        info "Dry run — nothing changed."
        return 0
    fi

    # Backups
    local bdir="$BACKUP_DIR/$STAMP"
    mkdir -p "$bdir"
    echo "$server_file" > "$bdir/server-file.txt"
    [[ -f "$MAIN_CONF" ]] && cp "$MAIN_CONF" "$bdir/main.conf.bak" || true
    if [[ -f "$LIMITS_DEST" ]]; then cp "$LIMITS_DEST" "$bdir/limits.conf.bak"; else touch "$bdir/limits.absent"; fi
    [[ -f "$server_file" ]] && cp "$server_file" "$bdir/server.conf.bak" || true
    info "Backups written to $bdir"

    # 1-2: snippet
    mkdir -p "$SNIPPETS_DIR"
    cp "$SRC_LIMITS" "$LIMITS_DEST"
    info "Installed $LIMITS_DEST"

    # 3: http{} include (idempotent)
    if [[ "$already_included" == "no" ]]; then
        # Insert after the first `http {` line
        awk -v line="$HTTP_INCLUDE_LINE" '
            !done && /^[[:space:]]*http[[:space:]]*\{/ { print; print "    " line; done=1; next }
            { print }
        ' "$MAIN_CONF" > "$MAIN_CONF.tmp"
        mv "$MAIN_CONF.tmp" "$MAIN_CONF"
        info "Added http{} include to $MAIN_CONF"
    else
        info "http{} include already present"
    fi

    # 4: server block
    mkdir -p "$(dirname "$server_file")"
    cp "$SRC_SERVER" "$server_file"
    info "Wrote server block -> $server_file"

    # 5: gate reload on config validity
    if nginx -t; then
        systemctl reload nginx
        success "Nginx reloaded with hardening. Rollback: sudo $0 --revert"
    else
        warn "nginx -t FAILED — reloading aborted. Restoring backups..."
        do_revert || true
        error "Config invalid. Original config restored. Inspect 'nginx -t' output above."
    fi
}

# --- Main --------------------------------------------------------------------
show_banner
require_root
require_cmd

if [[ "$MODE" == "revert" ]]; then
    do_revert
else
    install
fi
