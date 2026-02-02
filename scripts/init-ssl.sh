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
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/conf.d/10-ssl.conf.template > nginx/conf.d/10-ssl.conf
echo "Создан nginx/conf.d/10-ssl.conf для домена: $DOMAIN"

docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx
echo "Nginx перезагружен."
