# Деплой бэкенда (Docker + Nginx + Let's Encrypt)

## Требования

- Docker и Docker Compose на сервере
- Домен, указывающий на IP сервера (A-запись)

## 1. Подготовка на сервере

```bash
git clone <ваш-репозиторий> back-new
cd back-new
```

Создайте `.env` из примера и заполните значениями для прода:

```bash
cp .env.example .env
# Отредактируйте .env (JWT_SECRET, MONGODB_URI для Docker, DOMAIN, CERTBOT_EMAIL и т.д.)
```

**Важно для Docker:** в `.env` должны быть:
- `MONGODB_URI=mongodb://mongo:27017/education-center?replicaSet=rs0`
- `REDIS_HOST=redis`
- `DOMAIN=www.new.standart82.ru` — домен для SSL
- `CERTBOT_EMAIL=admin@standart82.ru` — email для Let's Encrypt

## 2. Инициализация MongoDB Replica Set (один раз)

Mongo запущен с `--replSet rs0`. Replica set нужно инициализировать:

```bash
docker compose up -d mongo
sleep 5
docker compose exec mongo mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]})"
```

## 3. Запуск стека (сначала только HTTP)

```bash
docker compose up -d
```

Проверьте: `http://www.new.standart82.ru` или `http://83.222.17.192` — должен открываться бэкенд (GraphQL на `/graphql`).

## 4. Получение SSL-сертификата (Let's Encrypt)

Убедитесь, что домен указывает на сервер, затем:

```bash
export DOMAIN=www.new.standart82.ru
export CERTBOT_EMAIL=admin@standart82.ru

docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --non-interactive
```

Если команда прошла успешно, сертификат лежит в volume `letsencrypt`.

## 5. Включение HTTPS в Nginx

Сгенерируйте конфиг для 443 и перезагрузите nginx:

```bash
export DOMAIN=www.new.standart82.ru
chmod +x scripts/init-ssl.sh
./scripts/init-ssl.sh
```

Проверьте: `https://www.new.standart82.ru/graphql` — должен открываться GraphQL по HTTPS.

## 6. Автообновление сертификата

Контейнер `certbot` в docker-compose каждые 12 часов запускает `certbot renew`. Дополнительно ничего настраивать не нужно.

## 7. Обновление приложения после push в Git

```bash
cd back-new
git pull
docker compose build app
docker compose up -d app
```

При изменении только кода перезапуск nginx не нужен.

## Порты

- **80** — HTTP (редирект на HTTPS после настройки 10-ssl.conf)
- **443** — HTTPS
- **27017** — MongoDB (доступен с хоста при необходимости)
- **6379** — Redis (доступен с хоста при необходимости)

## Структура

- **app** — NestJS-бэкенд (порт 3000 внутри сети)
- **nginx** — проксирует 80/443 на app:3000, отдаёт ACME-challenge для certbot
- **certbot** — обновляет сертификаты Let's Encrypt каждые 12 часов
- **mongo**, **redis** — БД и кэш
