#!/usr/bin/env bash
set -euo pipefail
ss -tln | grep -q ':9107 '
curl --fail --silent http://127.0.0.1:9107/api/health | grep -q '"db":true'
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://dirigo.craftbay.io/)" = "200"
echo "Dirigo healthcheck passed"
