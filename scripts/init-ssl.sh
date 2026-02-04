#!/bin/sh
# Генерирует nginx/conf.d/10-ssl.conf из шаблона и перезагружает nginx.
# Запускать после успешного получения сертификата (см. DEPLOY.md).

set -e

cd "$(dirname "$0")/.."

if [ -z "$DOMAIN" ]; then
  echo "Укажите DOMAIN (например: export DOMAIN=www.new.standart82.ru)"
  exit 1
fi

mkdir -p nginx/conf.d
# non-www: убираем префикс www. (www.new.standart82.ru → new.standart82.ru)
NON_WWW="${DOMAIN#www.}"
if [ -z "$NON_WWW" ]; then NON_WWW="new.standart82.ru"; fi
sed -e "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" -e "s/NON_WWW_PLACEHOLDER/$NON_WWW/g" nginx/conf.d/10-ssl.conf.template > nginx/conf.d/10-ssl.conf
echo "Создан nginx/conf.d/10-ssl.conf для домена: $DOMAIN (non-www $NON_WWW → https://$DOMAIN)"

docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx
echo "Nginx перезагружен."
