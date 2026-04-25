# Miz — образовательная CRM-платформа для репетиторов

MVP-платформа: учитель ведёт учеников, курсы, домашки, календарь, финансы и общение в одном месте.

## Стек

- **Backend:** NestJS + Prisma + PostgreSQL (Railway)
- **Frontend:** React + TypeScript + Vite (Vercel)
- **Auth:** JWT
- **Realtime:** Socket.IO (для чата)

## Структура

```
miz/
├── backend/      # NestJS API
│   ├── prisma/   # схема БД и миграции
│   └── src/      # модули
└── frontend/     # React SPA
    └── src/      # страницы, компоненты, store
```

## Локальный запуск

### Backend
```bash
cd backend
npm install
# создать .env (см. .env.example)
npx prisma migrate dev
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
# создать .env (см. .env.example)
npm run dev
```

## Деплой

- **Backend (Railway):** подключить репозиторий, добавить PostgreSQL plugin, переменные окружения из `backend/.env.example`. Railway сам ставит зависимости и запускает `npm run start:prod`.
- **Frontend (Vercel):** подключить репозиторий, root directory = `frontend`, build command = `npm run build`, output = `dist`. Переменная `VITE_API_URL` = публичный URL backend на Railway.

## Роли

- **Админ Miz** — управляет учителями, видит всю систему.
- **Учитель** — главная роль MVP: ведёт учеников, курсы, календарь, финансы.
- **Ученик** — личный кабинет: курсы, домашки, прогресс, чат.

## Демо-логины (после `npm run seed`)

- Админ: `admin` / `admin123`
- Учитель: `teacher` / `teacher123`
- Ученик: `student` / `student123`
