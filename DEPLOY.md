# Деплой бэкенда (Docker + Nginx + Let's Encrypt)

## Требования

- VPS с доступом по SSH (IP: 83.222.17.192)
- Docker и Docker Compose на сервере
- Домен www.new.standart82.ru с A-записью на IP сервера

---

## Пошаговый первый деплой

Выполняйте команды по порядку **на своём компьютере** (где есть SSH) и **на сервере** (где будет работать приложение).

### Шаг 0. Подготовка (до захода на сервер)

1. **DNS:** в панели домена standart82.ru создайте A-запись:
   - Имя: `www.new` (или полное имя, как требует панель)
   - Значение: `83.222.17.192`
   - Подождите 5–30 минут, пока запись обновится.

2. **SSH-ключ:** на сервере должен быть настроен вход по ключу (или запомните пароль пользователя).

### Шаг 1. Подключение к серверу и установка Docker (если ещё не установлен)

На своём компьютере:

```bash
ssh ваш_пользователь@83.222.17.192
```

На сервере (если Docker ещё не стоит):

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Выйдите и зайдите снова по SSH, чтобы группа docker применилась
exit
ssh ваш_пользователь@83.222.17.192
```

### Шаг 2. Клонирование репозитория и настройка .env

На сервере:

```bash
cd ~
git clone https://github.com/ВАШ_ЛОГИН/back-new.git
# или: git clone git@github.com:ВАШ_ЛОГИН/back-new.git
cd back-new
```

Создайте `.env` из примера и отредактируйте:

```bash
cp .env.example .env
nano .env
```

Обязательно задайте:

- `DOMAIN=www.new.standart82.ru`
- `CERTBOT_EMAIL=ваш@email.ru`
- `MONGODB_URI=mongodb://mongo:27017/education-center?replicaSet=rs0`
- `REDIS_HOST=redis`
- `JWT_SECRET=длинная_случайная_строка_для_продакшена`

Сохраните и выйдите (Ctrl+O, Enter, Ctrl+X в nano).

### Шаг 3. Инициализация MongoDB (один раз)

На сервере, в каталоге `back-new`:

```bash
docker compose up -d mongo
sleep 5
docker compose exec mongo mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]})"
```

Должно появиться `ok: 1`.

### Шаг 4. Запуск всего стека (HTTP)

На сервере:

```bash
docker compose up -d
```

Проверка: откройте в браузере `http://www.new.standart82.ru/graphql` или `http://83.222.17.192/graphql`. Должен отвечать бэкенд (GraphQL).

### Шаг 5. Получение SSL-сертификата (Let's Encrypt)

Только после того, как по домену открывается сайт (шаг 4), на сервере в каталоге `back-new`:

```bash
export DOMAIN=www.new.standart82.ru
export CERTBOT_EMAIL=ваш@email.ru

docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --non-interactive
```

Если в конце написано «Successfully received certificate» — всё ок.

### Шаг 6. Включение HTTPS в Nginx

На сервере, в каталоге `back-new`:

```bash
export DOMAIN=www.new.standart82.ru
chmod +x scripts/init-ssl.sh
./scripts/init-ssl.sh
```

Проверка: откройте `https://www.new.standart82.ru/graphql`. Должен открываться GraphQL по HTTPS.

После этого первый деплой завершён. Дальше при изменениях кода — только обновление (см. ниже и раздел про GitHub Actions).

---

## GitHub Actions (автодеплой при push)

При push в ветку `main` можно автоматически обновлять приложение на сервере: зайти по SSH, выполнить `git pull`, пересобрать и перезапустить контейнер `app`.

### 1. Секреты в репозитории GitHub

В репозитории: **Settings → Secrets and variables → Actions → New repository secret.** Добавьте:

| Имя секрета       | Значение | Описание |
|-------------------|----------|----------|
| `DEPLOY_SSH_KEY`  | Содержимое **приватного** SSH-ключа (весь текст, включая `-----BEGIN ... END ...-----`) | Ключ, которым заходите на сервер |
| `DEPLOY_HOST`     | `83.222.17.192` | IP или домен сервера |
| `DEPLOY_USER`     | Имя пользователя SSH (например `root` или `ubuntu`) | Пользователь на сервере |
| `DEPLOY_PATH`     | Полный путь к проекту на сервере (например `/home/ubuntu/back-new`) | Каталог, где лежит `back-new` с `docker-compose.yml` |

Если `DEPLOY_PATH` не задан, workflow использует `~/back-new` (относительно домашнего каталога пользователя).

### 2. Файл workflow

В репозитории уже есть файл `.github/workflows/deploy.yml`. Он:

- Запускается при **push в ветку `main`** и по кнопке **Run workflow** (Actions → Deploy → Run workflow).
- Подключается к серверу по SSH с ключом из `DEPLOY_SSH_KEY`.
- В каталоге `DEPLOY_PATH` выполняет: `git pull`, `docker compose build app`, `docker compose up -d app`.

Никаких паролей в коде нет — только секреты GitHub.

### 3. Проверка

1. Внесите небольшое изменение в код и сделайте push в `main`.
2. Откройте вкладку **Actions** в репозитории — должен запуститься workflow **Deploy**.
3. После успешного завершения на сервере будет запущена новая версия приложения.

При ошибке (например, «Permission denied» или «Host key verification failed») проверьте: ключ в `DEPLOY_SSH_KEY` соответствует публичному ключу на сервере, `DEPLOY_USER` и `DEPLOY_HOST` верные, путь в `DEPLOY_PATH` существует и там есть `docker-compose.yml`.

---

## 1. Подготовка на сервере (кратко)

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
