#!/bin/sh
# entrypoint.sh

SSL_DIR="/etc/nginx/ssl"
CRT="$SSL_DIR/selfsigned.crt"
KEY="$SSL_DIR/selfsigned.key"
CONF="$SSL_DIR/ssl.conf"

# Generate certificate if missing
if [ ! -f "$CRT" ] || [ ! -f "$KEY" ]; then
  echo "Generating self-signed certificate..."
  mkdir -p "$SSL_DIR"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY" -out "$CRT" \
    -subj "/C=US/ST=State/L=City/O=Company/OU=Org/CN=103.102.234.6" \
    -addext "keyUsage=digitalSignature,keyEncipherment,nonRepudiation" \
    -addext "extendedKeyUsage=serverAuth" \
    -addext "basicConstraints=critical,CA:FALSE" \
    -addext "subjectAltName=DNS:localhost,IP:103.102.234.6"
fi
#    -config "$sslconf" -extensions v3_req

# Start backend services and nginx
java -Ddb.file.path=/backend/probsol.db -jar /backend/app.jar &
/opt/whisper.cpp/build/bin/whisper-server -m /opt/whisper.cpp/models/ggml-base.en.bin --port 8082 -l en &
uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-certfile=/etc/nginx/ssl/selfsigned.crt --ssl-keyfile=/etc/nginx/ssl/selfsigned.key
sleep 5
nginx -g 'daemon off;'
