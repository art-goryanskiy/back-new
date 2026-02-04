## Education Center Backend (NestJS + GraphQL)

Backend для системы управления образовательными программами и пользователями. Проект построен как **GraphQL-only API** (code-first) на NestJS и MongoDB, с кешированием в Redis и интеграцией с SMTP/объектным хранилищем.

### Ключевые возможности (для портфолио)

- **GraphQL (code-first)**: типы/инпуты описаны в TypeScript, схема собирается автоматически.
- **JWT auth в httpOnly cookies**:
  - Access + Refresh токены
  - ротация refresh-токенов и ревокация семейств
- **Регистрация + подтверждение email**:
  - отправка verify-link по email
  - повторная отправка письма с rate-limit
- **Сброс пароля (password reset)**:
  - выдача одноразового токена с TTL
  - защита от повторного использования
- **Админ-сценарии**:
  - создание пользователя с временным паролем
  - флаг `mustChangePassword` для принудительной смены на первом входе
- **Категории и программы**:
  - иерархические категории и типы категорий
  - поиск по названию/сортировка/пагинация
  - скрытие цен для неавторизованных пользователей
  - фильтр по нескольким категориям: `ProgramFilterInput.categoryIds`
  - корректная пагинация для UI: `programsPage { items, total }`
  - рейтинг по просмотрам: поле `viewsRating` (0–5) на основе `views`
  - топ программ: `topPrograms(limit)` по просмотрам
- **Redis caching**:
  - кеширование результатов фильтрации программ
  - инвалидация кеша на изменениях
- **Файлы/изображения**:
  - загрузка в Yandex Object Storage (S3)
  - обработка изображений через Sharp (resize/compress/webp)
- **Заказы и оплата**:
  - заказы из корзины, статусы (AWAITING_PAYMENT, PAID, IN_PROGRESS, COMPLETED, CANCELLED)
  - оплата картой: T-Bank EACQ (Init → редирект → уведомление), уникальный OrderId на каждую попытку оплаты (повторная оплата из ЛК без ошибки «Неверный статус транзакции»)
  - редиректы после оплаты: бэкенд `orders/:id/payment-success` / `payment-fail` → фронт `orders/:id/success` / `fail`
- **Nginx (конфиги в репозитории)**:
  - прокси на бэкенд (/graphql, /upload, /payment/, редиректы оплаты) и на фронт (location /)
  - Cache-Control для ответов фронта: `proxy_hide_header` + `add_header` (bfcache)

---

## Технологический стек

- **Framework**: NestJS 11
- **API**: GraphQL (Apollo, code-first)
- **DB**: MongoDB 7 + Mongoose
- **Cache**: Redis (ioredis)
- **Auth**: JWT (access/refresh) + httpOnly cookies
- **Mail**: Nodemailer (SMTP)
- **Storage**: Yandex Object Storage (S3-compatible)
- **Tooling**: ESLint, Prettier, Jest

---

## Архитектурные акценты

- **Модульность**: доменные модули `user`, `programs`, `category`, `upload`, `cache`.
- **Разделение ответственности**: сервисы и вспомогательные файлы для query/validation/repo частей.
- **Транзакции MongoDB** используются там, где нужно атомарно создать/обновить связанные сущности (нужен replica set).

---

## Быстрый старт (локально)

### Требования

- Node.js 18+
- Docker + Docker Compose

### 1) Установка зависимостей

```bash
npm install
```

### 2) Запуск MongoDB + Redis

```bash
docker compose up -d
```

### 3) Инициализация replica set (обязательно для транзакций)

```bash
docker exec -it education-center-mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
docker exec -it education-center-mongo mongosh --eval 'rs.status().ok'
```

### 4) Переменные окружения

Создай `.env` по примеру ниже (значения — плейсхолдеры, реальные секреты не коммить):

```env
PORT=4200
NODE_ENV=development

# MongoDB (replicaSet обязателен для транзакций)
MONGODB_URI=mongodb://127.0.0.1:27017/education-center?replicaSet=rs0

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=3600

# JWT
JWT_SECRET=change-me
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Admin bootstrap (опционально)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me

# SMTP (для подтверждения email / password reset)
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=example
SMTP_PASS=example
SMTP_FROM=example@example.com

# Yandex Object Storage (опционально)
YANDEX_STORAGE_ACCESS_KEY=
YANDEX_STORAGE_SECRET_KEY=
YANDEX_STORAGE_BUCKET=
YANDEX_STORAGE_REGION=ru-central1
YANDEX_STORAGE_ENDPOINT=https://storage.yandexcloud.net
```

Примечание: если на машине был запущен локальный `mongod` на `27017`, он может конфликтовать с Docker Mongo. Убедись, что используется только один экземпляр MongoDB.

### 5) Запуск приложения

```bash
npm run start:dev
```

GraphQL endpoint: `http://localhost:4200/graphql`

**Важно для фронтенда:** если в браузере видишь `POST http://localhost:4200/graphql net::ERR_CONNECTION_REFUSED` — это значит, что бэкенд не запущен или недоступен на этом порту. Запрос до сервера не доходит, проверка авторизации здесь ни при чём. Запусти бэкенд: `npm run start:dev` (в корне этого репозитория), и убедись, что фронт ходит на `http://localhost:4200/graphql` (или на тот порт, что задан в `.env` через `PORT`).

---

## GraphQL API (короткие примеры)

### Регистрация и подтверждение email

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input)
}
```

```graphql
mutation VerifyEmail($input: VerifyEmailInput!) {
  verifyEmail(input: $input)
}
```

### Password reset

```graphql
mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
  requestPasswordReset(input: $input)
}
```

```graphql
mutation ResetPassword($input: ResetPasswordInput!) {
  resetPassword(input: $input)
}
```

### Программы: серверная пагинация + total

```graphql
query ProgramsPage($filter: ProgramFilterInput) {
  programsPage(filter: $filter) {
    total
    items {
      id
      title
      category
      pricing {
        hours
        price
      }
    }
  }
}
```

Фильтр: поиск по названию (`search`), категории (`category` / `categoryIds`), пагинация, сортировка (`sortBy`: `title` | `views` | `createdAt`):

```json
{
  "filter": {
    "search": "ох",
    "categoryIds": ["<catId1>", "<catId2>"],
    "limit": 20,
    "offset": 0,
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }
}
```

---

## Деплой

Конфигурация nginx и шаги деплоя описаны в **DEPLOY.md** (HTTPS, certbot, перезагрузка nginx при изменении конфигов).

---

## Project structure

Ключевые директории:

```text
src/
  app.module.ts                 # корневой модуль: config, mongoose, graphql
  cache/                        # Redis cache service + rate-limit helpers
  category/                     # категории (schema/service/resolver)
  programs/                     # программы (schema/service/resolver + cache/query/rating)
  order/                        # заказы, редиректы оплаты, уведомления T-Bank EACQ
  payment/                      # T-Bank EACQ (Init/GetState), T-Bank Invoice
  upload/                       # загрузка/обработка файлов (S3 + sharp)
  user/                         # auth/profile/admin + email + reset password
    auth/                       # токены/регистрация/подтверждение/сброс пароля
    admin/                      # репозитории/queries для админ-функций
    profile/                    # профиль пользователя (repo/validation)
    resolvers/                  # GraphQL resolvers (auth/profile/admin)
    schemas/                    # mongoose schemas (user, refresh token, profile, reset token, etc.)
  organization/                 # организации (DaData, места работы)
  education-document/           # документы об образовании
  common/
    guards/                     # jwt guards (обязательный/опциональный)
    interceptors/               # логирование/обёртки
    mappers/                    # преобразование Mongoose -> GraphQL entities
    validators/                 # валидаторы входных данных
nginx/conf.d/                   # nginx: 00-http.conf, 10-ssl.conf.template (Cache-Control для фронта)
```

---

## Скрипты

- `npm run start:dev` — запуск в dev режиме
- `npm run build` — сборка
- `npm run lint` — eslint
- `npm run test` — unit tests
- `npm run test:e2e` — e2e tests

---

## Контакты / автор

- **GitHub**: https://github.com/art-goryanskiy  
- **Telegram**: @artemgoryanskiy  
- **Email**: artem.goryanskiy@gmail.com
