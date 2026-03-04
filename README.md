# Education Center Backend (NestJS + GraphQL)

Бэкенд системы управления образовательными программами, пользователями, заказами и коммуникацией. **GraphQL API** (code-first) на NestJS, MongoDB, Redis; оплата (T-Bank EACQ, счета), загрузка файлов в S3, чат по WebSocket, новости из VK.

---

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Framework | NestJS 11 |
| API | GraphQL (Apollo Server 5, code-first) |
| БД | MongoDB 7 + Mongoose |
| Кеш | Redis (ioredis) |
| Аутентификация | JWT (access + refresh) в httpOnly cookies |
| Реальное время | Socket.IO (чат) |
| Почта | Nodemailer (SMTP) |
| Файлы | Yandex Object Storage (S3-compatible), Sharp (изображения) |
| Документы | PDF (PDFKit), DOCX (docx) |
| Инструменты | ESLint, Prettier, Jest |

---

## Основные возможности

- **GraphQL (code-first)** — типы и инпуты в TypeScript, схема генерируется автоматически.
- **Аутентификация**
  - JWT (access + refresh), ротация и ревокация семейств refresh-токенов.
  - Регистрация и подтверждение email (verify-link, повторная отправка с rate-limit).
  - Сброс пароля (одноразовый токен с TTL).
  - Админ: создание пользователя с временным паролем, флаг `mustChangePassword`.
- **Каталог**
  - Иерархические категории и типы категорий.
  - Программы: поиск, фильтр по категориям, пагинация (`programsPage { items, total }`), сортировка, скрытие цен для неавторизованных.
  - Рейтинг по просмотрам (`viewsRating`), топ программ `topPrograms(limit)`.
- **Кеш** — Redis для результатов фильтрации программ с инвалидацией при изменениях.
- **Файлы** — загрузка в Yandex Object Storage, обработка изображений (Sharp: resize, compress, webp).
- **Корзина и заказы**
  - Корзина, создание заказа из корзины.
  - Статусы: AWAITING_PAYMENT, PAID, IN_PROGRESS, COMPLETED, CANCELLED.
  - Оплата картой: T-Bank EACQ (Init → редирект/iframe → webhook). Уникальный OrderId на попытку оплаты.
  - Редиректы после оплаты: бэкенд `GET /orders/:id/payment-success` / `payment-fail` → фронт.
  - T-Bank счета (T-API) и SBP.
- **Документы** — генерация документов по заказу (PDF/DOCX), образование (education-document).
- **Организации** — DaData, места работы.
- **Новости** — импорт постов из VK (стена сообщества).
- **Чат** — WebSocket (Socket.IO), сообщения, админ-резолверы.
- **Админ**
  - Метрики (admin-metrics).
  - Уведомления (admin-notifications).
- **Nginx** — конфиги в репозитории: прокси на бэкенд (/graphql, /upload, /payment, редиректы) и фронт; Cache-Control для bfcache.

---

## Быстрый старт (локально)

### Требования

- Node.js 18+
- Docker и Docker Compose (для MongoDB и Redis)

### 1. Установка зависимостей

```bash
npm install
```

После установки выполняется `postinstall`: скачивание шрифта PT Serif для генерации PDF (в `assets/fonts/`).

### 2. Запуск MongoDB и Redis

```bash
docker compose up -d mongo redis
```

### 3. Replica set (для транзакций MongoDB)

```bash
docker exec -it education-center-mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
docker exec -it education-center-mongo mongosh --eval 'rs.status().ok'
```

### 4. Переменные окружения

Скопируй `.env.example` в `.env` и заполни значения. Минимум для запуска:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/education-center?replicaSet=rs0
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
JWT_SECRET=change-me
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Полный список переменных (SMTP, S3, T-Bank, DaData, VK и т.д.) — в `.env.example`.

### 5. Запуск приложения

```bash
npm run start:dev
```

- GraphQL: `http://localhost:3000/graphql`
- WebSocket (чат): тот же хост, путь настраивается в Apollo/клиенте.

Если фронт получает `ERR_CONNECTION_REFUSED` на `/graphql` — проверь, что бэкенд запущен и порт в `.env` совпадает с тем, на который ходит фронт.

---

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run start:dev` | Запуск в режиме разработки (watch) |
| `npm run start` | Обычный запуск |
| `npm run start:prod` | Запуск собранного приложения (`node dist/main`) |
| `npm run build` | Сборка |
| `npm run lint` | ESLint с автофиксом |
| `npm run format` | Prettier по `src` и `test` |
| `npm run test` | Unit-тесты (Jest) |
| `npm run test:e2e` | E2E-тесты |
| `npm run migrate:order-statuses` | Миграция статусов заказов |

---

## Структура проекта

```text
src/
  app.module.ts              # Корневой модуль: Config, Mongoose, GraphQL
  main.ts                    # Bootstrap, CORS, cookie-parser, Socket.IO adapter
  app.controller.ts
  graphql/                   # GraphQL options (schema, контекст)
  cache/                     # Redis: кеш и rate-limit
  category/                  # Категории (schema, service, resolver)
  programs/                  # Программы (schema, service, resolver, кеш, рейтинг)
  user/                      # Пользователи и auth
    auth/                    # Регистрация, verify, reset password
    admin/                   # Админ-репозитории и запросы
    profile/                 # Профиль
    resolvers/               # GraphQL: auth, profile, admin, address-suggestions
    schemas/                 # Mongoose: user, refresh, reset token и др.
  organization/              # Организации (DaData), места работы
  education-document/        # Документы об образовании
  upload/                    # Загрузка и обработка файлов (S3, Sharp)
  storage/                   # Модуль хранилища
  cart/                      # Корзина
  order/                     # Заказы, редиректы оплаты, T-Bank EACQ webhook
  order-document/            # Генерация документов по заказу (PDF/DOCX)
  payment/                   # T-Bank EACQ (Init/GetState), T-Bank Invoice/SBP
  news/                      # Новости (VK API)
  chat/                      # Чат (Socket.IO, резолверы)
  admin-metrics/             # Метрики для админки
  admin-notifications/       # Уведомления для админки
  common/
    guards/                  # JWT guards (обязательный/опциональный)
    interceptors/
    mappers/
    validators/
    decorators/
nginx/conf.d/                # Nginx: HTTP, SSL, прокси, Cache-Control
scripts/
  ensure-pdf-font.js         # Скачивание шрифта для PDF (postinstall)
  migrate-order-statuses.js # Миграция статусов заказов
```

---

## GraphQL: примеры запросов

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

### Сброс пароля

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

### Программы: пагинация и фильтр

```graphql
query ProgramsPage($filter: ProgramFilterInput) {
  programsPage(filter: $filter) {
    total
    items {
      id
      title
      category
      pricing { hours price }
    }
  }
}
```

Переменная `filter`: `search`, `categoryIds`, `limit`, `offset`, `sortBy` (title | views | createdAt), `sortOrder`.

---

## Деплой

- **DEPLOY.md** — деплой на VPS (Docker, Nginx, Let's Encrypt).
- **SERVER_STEPS.md** — чеклист при смене домена или окружения на сервере.

---

## Контакты

- **GitHub**: [github.com/art-goryanskiy](https://github.com/art-goryanskiy)
- **Telegram**: @artemgoryanskiy
- **Email**: artem.goryanskiy@gmail.com
