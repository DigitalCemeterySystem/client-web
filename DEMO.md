# Демо-режим

`client-web` может работать как автономное демонстрационное приложение без развернутых серверных сервисов.

Публичное демо: https://digital-cemetery-demo.vercel.app

## Запуск локально

PowerShell:

```powershell
$env:DCS_DEMO_MODE = 'true'
$env:NEXT_PUBLIC_DCS_DEMO_MODE = 'true'
$env:SESSION_COOKIE_SECURE = 'false'
npm run dev
```

Bash:

```bash
DCS_DEMO_MODE=true NEXT_PUBLIC_DCS_DEMO_MODE=true SESSION_COOKIE_SECURE=false npm run dev
```

## Деплой на Vercel

Для Vercel достаточно импортировать репозиторий `client-web`. Файл `vercel.json` уже включает:

- `DCS_DEMO_MODE=true`;
- `NEXT_PUBLIC_DCS_DEMO_MODE=true`;
- `SESSION_COOKIE_SECURE=true`.

В этом режиме Next.js Route Handlers отдают демонстрационный API для кладбищ, захоронений, авторизации, заявок, поиска информации и генерации биографий. Локальный полный режим остаётся обычным режимом работы, если `DCS_DEMO_MODE` не включён.

## Демо-аккаунты

- `user@demo.local` / `demo12345`;
- `moderator@demo.local` / `demo12345`;
- `admin@demo.local` / `demo12345`.
