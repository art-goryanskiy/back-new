# Что сделать на сервере: переход на standart82.ru

После выката изменений из репозитория выполните на сервере шаги ниже. Ничего не сломается, если делать по порядку.

---

## 1. DNS (в панели регистратора домена)

Проверьте A-записи для **standart82.ru**:

| Тип | Имя (поддомен) | Значение    | TTL (по желанию) |
|-----|----------------|------------|------------------|
| A   | `@` (или пусто)| 83.222.17.192 | 300–3600       |
| A   | `www`          | 83.222.17.192 | 300–3600       |

- `@` — чтобы открывался `standart82.ru` (без www).
- `www` — чтобы открывался `www.standart82.ru`.

Дождитесь обновления DNS (5–30 минут, иногда до часа). Проверка:

```bash
dig +short standart82.ru
dig +short www.standart82.ru
```

Оба должны вернуть IP сервера.

---

## 2. Обновить код на сервере

```bash
cd ~/back-new   # или ваш DEPLOY_PATH
git pull
```

---

## 3. Обновить .env на сервере

Откройте `.env` и замените старый домен на новый:

```bash
nano .env
```

**Замените (если ещё указан старый домен):**

- `DOMAIN=www.new.standart82.ru` → `DOMAIN=www.standart82.ru`
- `FRONTEND_BASE_URL=https://www.new.standart82.ru` → `FRONTEND_BASE_URL=https://www.standart82.ru`
- `FRONT_URL=https://www.new.standart82.ru` → `FRONT_URL=https://www.standart82.ru`
- `BACKEND_PUBLIC_URL=https://www.new.standart82.ru` → `BACKEND_PUBLIC_URL=https://www.standart82.ru`

Если используете `CORS_ORIGIN` — замените в нём домен на `https://www.standart82.ru` (и при необходимости `https://standart82.ru`).

Сохраните: Ctrl+O, Enter, Ctrl+X.

---

## 4. Получить новый SSL-сертификат (оба имени: www и без www)

Сертификат нужен на **два** имени, чтобы работали и `https://www.standart82.ru`, и редирект с `https://standart82.ru` на www.

```bash
cd ~/back-new   # или ваш каталог проекта

export DOMAIN=www.standart82.ru
export NON_WWW=standart82.ru
export CERTBOT_EMAIL=ваш@email.ru   # тот же, что в .env

docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  -d "$NON_WWW" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --non-interactive
```

В конце должно быть: **Successfully received certificate**.

Если ранее был сертификат только на `www.new.standart82.ru`, старый можно не удалять — certbot создаст новый в каталоге по первому `-d` (обычно `www.standart82.ru`).

---

## 5. Пересобрать конфиг Nginx и перезагрузить

Скрипт подставит `DOMAIN` и `NON_WWW` в шаблон и создаст `nginx/conf.d/10-ssl.conf`:

```bash
export DOMAIN=www.standart82.ru
chmod +x scripts/init-ssl.sh
./scripts/init-ssl.sh
```

Должно вывести что-то вроде: «Создан nginx/conf.d/10-ssl.conf для домена: www.standart82.ru (non-www standart82.ru → https://www.standart82.ru)» и «Nginx перезагружен.»

---

## 6. Перезапустить приложение (чтобы подхватился новый .env)

```bash
docker compose up -d app
```

При необходимости перезапустите и фронт (если он в этом же compose и использует переменные с доменом):

```bash
docker compose up -d
```

---

## 7. Проверки

Сделайте проверки в браузере или curl:

| Запрос | Ожидание |
|--------|----------|
| `http://standart82.ru` | 301 → `https://www.standart82.ru` |
| `http://www.standart82.ru` | 301 → `https://www.standart82.ru` |
| `https://standart82.ru` | 301 → `https://www.standart82.ru` |
| `https://www.standart82.ru` | 200, открывается сайт |
| `https://www.standart82.ru/graphql` | GraphQL отвечает |

Пример с curl:

```bash
curl -sI http://standart82.ru      # должен быть Location: https://www.standart82.ru/
curl -sI http://www.standart82.ru   # должен быть Location: https://www.standart82.ru/
curl -sI https://standart82.ru      # должен быть Location: https://www.standart82.ru/
curl -sI https://www.standart82.ru  # должен быть 200 OK
```

---

## Если что-то пошло не так

- **Certbot пишет про rate limit** — подождите или временно используйте один домен (`-d "$DOMAIN"`), потом добавьте второй.
- **Nginx не перезагружается** — проверьте конфиг:  
  `docker compose exec nginx nginx -t`  
  При ошибках смотрите вывод и исправьте указанный файл (чаще всего путь к сертификату).
- **Сайт открывается по IP, но не по домену** — проверьте DNS (шаг 1) и что в `.env` везде `www.standart82.ru` / `standart82.ru`, без `new.`.

---

## Краткий чеклист

- [ ] DNS: A для `@` и `www` на IP сервера
- [ ] `git pull` в каталоге проекта
- [ ] В `.env`: DOMAIN, FRONTEND_BASE_URL, FRONT_URL, BACKEND_PUBLIC_URL = standart82.ru / www.standart82.ru
- [ ] Certbot: сертификат с `-d www.standart82.ru -d standart82.ru`
- [ ] `./scripts/init-ssl.sh` (DOMAIN=www.standart82.ru)
- [ ] `docker compose up -d app` (и при необходимости фронт)
- [ ] Проверка редиректов и открытия https://www.standart82.ru
