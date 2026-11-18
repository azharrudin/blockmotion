#!/usr/bin/env bash
set -euo pipefail

: "${FTP_SERVER:?Set the FTP_SERVER secret}"
: "${FTP_USERNAME:?Set the FTP_USERNAME secret}"
: "${FTP_PASSWORD:?Set the FTP_PASSWORD secret}"
: "${FTP_SERVER_DIR:?Set the FTP_SERVER_DIR variable}"
FTP_PORT=${FTP_PORT:-21}
FTP_PROTOCOL=${FTP_PROTOCOL:-ftp}

# These values are inserted into lftp commands; reject command syntax.
[[ "$FTP_SERVER" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Invalid FTP_SERVER hostname'; exit 1; }
[[ "$FTP_USERNAME" =~ ^[a-zA-Z0-9_.@+-]+$ ]] || { echo 'Unsupported characters in FTP_USERNAME'; exit 1; }
[[ "$FTP_PORT" =~ ^[0-9]+$ ]] && (( 10#$FTP_PORT >= 1 && 10#$FTP_PORT <= 65535 )) || { echo 'Invalid FTP_PORT'; exit 1; }
[[ "$FTP_SERVER_DIR" =~ ^[a-zA-Z0-9_./-]+/$ ]] || { echo 'FTP_SERVER_DIR must end in / and contain only letters, numbers, _, ., / or -'; exit 1; }
[[ "/$FTP_SERVER_DIR" != *'/../'* ]] || { echo 'FTP_SERVER_DIR must not contain .. segments'; exit 1; }
[[ -f dist/index.html ]] || { echo 'Build dist/index.html before deployment'; exit 1; }

ftp_scheme=ftp
ftp_tls=no
case "$FTP_PROTOCOL" in
  ftp) ;;
  ftps) ftp_tls=yes ;; # Explicit TLS on the normal FTP port.
  ftps-legacy) ftp_scheme=ftps; ftp_tls=yes ;; # Implicit TLS.
  *) echo 'FTP_PROTOCOL must be ftp, ftps or ftps-legacy'; exit 1 ;;
esac

# Keep passwords out of command arguments and lftp's command input.
export LFTP_PASSWORD="$FTP_PASSWORD"
lftp --norc <<LFTP
set cmd:fail-exit yes
set cmd:move-background no
set net:timeout 30
set net:max-retries 2
set net:reconnect-interval-base 5
set net:connection-limit 1
set dns:order inet
set ftp:passive-mode yes
set ftp:prefer-epsv no
set ftp:sync-mode yes
set ftp:ssl-allow $ftp_tls
set ftp:ssl-force $ftp_tls
set ftp:ssl-auth TLS
set ftp:ssl-protect-data yes
set ftp:ssl-protect-list yes
# Work around ProFTPD's TLS 1.3 data-transfer incompatibility with older OpenSSL.
# Keep both control and data connections encrypted using TLS 1.2.
set ssl:priority "NORMAL:-VERS-SSL3.0:-VERS-TLS1.0:-VERS-TLS1.1:+VERS-TLS1.2:-VERS-TLS1.3"
# Temporary equivalent of the previously authorized security: loose workaround.
set ssl:verify-certificate no
open --user "$FTP_USERNAME" --env-password -p "$FTP_PORT" "$ftp_scheme://$FTP_SERVER"
mkdir -p "$FTP_SERVER_DIR"
mirror --reverse --verbose --parallel=1 --exclude-glob index.html dist/ "$FTP_SERVER_DIR"
put dist/index.html -o "${FTP_SERVER_DIR}index.html"
bye
LFTP
