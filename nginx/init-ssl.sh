#!/bin/bash
set -e

DOMAINS="thesafespace.blog www.thesafespace.blog mail.thesafespace.blog test.thesafespace.blog"
CERT_PATH="/etc/letsencrypt/live/thesafespace.blog"

echo "=== SSL-Zertifikate initialisieren ==="

# 1. Dummy-Zertifikate erstellen, damit nginx starten kann
echo "[1/4] Erstelle temporäre Dummy-Zertifikate..."
docker compose run --rm --entrypoint "" certbot sh -c "\
  mkdir -p $CERT_PATH && \
  openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout $CERT_PATH/privkey.pem \
    -out $CERT_PATH/fullchain.pem \
    -subj '/CN=thesafespace.blog'"

# 2. Nginx starten (nur nginx)
echo "[2/4] Starte nginx..."
docker compose up -d nginx

# 3. Echte Zertifikate holen
echo "[3/4] Hole Let's Encrypt Zertifikate..."
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d thesafespace.blog \
  -d www.thesafespace.blog \
  -d mail.thesafespace.blog \
  -d test.thesafespace.blog

# 4. Nginx neu laden
echo "[4/4] Lade nginx-Konfiguration neu..."
docker compose exec nginx nginx -s reload

echo "=== Fertig! SSL-Zertifikate sind aktiv. ==="
echo "Starte jetzt alle Services mit: docker compose up -d"
