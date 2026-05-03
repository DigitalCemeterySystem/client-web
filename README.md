# Digital Cemetery System: клиентское веб-приложение

Публичный веб-интерфейс Digital Cemetery System. Репозиторий можно запускать как обычный клиент для полного контура с серверными сервисами или как автономное демо для Vercel без деплоя серверной части.

## Возможности

- карта кладбищ с границами, кварталами и маркерами захоронений;
- реестр захоронений, поиск и карточки захоронений;
- вход, регистрация, подтверждение почты и профиль пользователя;
- создание заявок на добавление и изменение захоронений;
- просмотр, согласование и отклонение заявок для модератора и администратора;
- демонстрационные административные разделы поиска информации и генерации биографий.

## Стек

- Next.js 16, React 18, TypeScript;
- Tailwind CSS и lucide-react;
- MapLibre GL для карты;
- Axios для клиентского REST-слоя;
- Next.js Route Handlers для проксирования API, сессий и демонстрационного API.

## Быстрый деплой на Vercel

1. Загрузите содержимое `client-web` в отдельный GitHub-репозиторий.
2. В Vercel выберите `Add New Project` и импортируйте этот репозиторий.
3. Оставьте стандартные настройки Next.js:
   - Framework Preset: `Next.js`;
   - Install Command: `npm ci`;
   - Build Command: `npm run build`.
4. Нажмите `Deploy`.

В репозитории есть `vercel.json`, который включает демо-режим для Vercel:

- `DCS_DEMO_MODE=true`;
- `NEXT_PUBLIC_DCS_DEMO_MODE=true`;
- `SESSION_COOKIE_SECURE=true`.

Серверная часть на Vercel не нужна: в демо-режиме все нужные маршруты обслуживаются через Next.js Route Handlers внутри `client-web`.

## Демо-аккаунты

- пользователь: `user@demo.local` / `demo12345`;
- модератор: `moderator@demo.local` / `demo12345`;
- администратор: `admin@demo.local` / `demo12345`.

## Локальный запуск демо-режима

PowerShell:

```powershell
npm install
$env:DCS_DEMO_MODE = 'true'
$env:NEXT_PUBLIC_DCS_DEMO_MODE = 'true'
$env:SESSION_COOKIE_SECURE = 'false'
npm run dev
```

Bash:

```bash
npm install
DCS_DEMO_MODE=true NEXT_PUBLIC_DCS_DEMO_MODE=true SESSION_COOKIE_SECURE=false npm run dev
```

После запуска откройте `http://localhost:3000`.

## Локальный полный режим

Если `DCS_DEMO_MODE` не включён, клиент работает с настоящей серверной частью через API Gateway. Для запуска всей системы используйте корневой `docker-compose.yml` основного проекта:

```powershell
cd D:\NSU\Diploma\DigitalCemeterySystem
docker compose up -d --build
```

В Docker Compose для `client-web` должен быть указан `API_URL=http://api-gateway:8080`. При отдельном запуске клиента рядом с локальной серверной частью можно использовать:

```powershell
$env:API_URL = 'http://localhost:8080'
$env:NEXT_PUBLIC_API_URL = 'http://localhost:8080'
npm run dev
```

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `DCS_DEMO_MODE` | Включает демонстрационный API на стороне Next.js. |
| `NEXT_PUBLIC_DCS_DEMO_MODE` | Дублирует демо-режим для клиентского кода, если это потребуется. |
| `SESSION_COOKIE_SECURE` | Включает secure-cookie для HTTPS. На Vercel должно быть `true`, локально обычно `false`. |
| `API_URL` | Внутренний URL API Gateway для серверных запросов Next.js. |
| `NEXT_PUBLIC_API_URL` | Публичный URL API Gateway для локальных сценариев и совместимости. |
| `DCS_LEGACY_API_REWRITES` | Включает старое правило Next.js для перенаправления `/api/*` на серверную часть. По умолчанию выключено. |

## Проверки перед публикацией

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

Для проверки Vercel-режима локально:

```bash
DCS_DEMO_MODE=true NEXT_PUBLIC_DCS_DEMO_MODE=true SESSION_COOKIE_SECURE=false npm run build
```

## Демо-данные

Демо-режим использует данные из `src/demo-data`:

- `TEST_cemetery_boundaries.json`;
- `YUZHNOE_cemetery_boundaries.json`;
- `graves_data.json`.

Границы кладбищ отображаются как отдельные кладбища, `quarterBoundaries` используются как кварталы, а захоронения из `graves_data.json` привязываются к кладбищам и кварталам по координатам.
