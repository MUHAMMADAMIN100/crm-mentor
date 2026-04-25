# Деплой Miz

## 1. Backend на Railway

1. Зарегистрируйтесь на [railway.app](https://railway.app).
2. Создайте проект → **New Project** → **Deploy from GitHub repo** → выберите репозиторий, в Settings проекта установите **Root Directory** = `backend`.
3. Добавьте плагин **PostgreSQL**: `+ New` → `Database` → `PostgreSQL`. Railway автоматически создаст переменную `DATABASE_URL` и подключит её к сервису backend.
4. В сервисе backend добавьте переменные окружения (Settings → Variables):
   - `JWT_SECRET` — длинная случайная строка
   - `JWT_EXPIRES_IN=7d`
   - `CORS_ORIGIN` — URL фронтенда (например `https://miz.vercel.app`)
   - `PORT=3000`
5. После первого деплоя выполните миграцию:
   - Railway автоматически запустит `npx prisma migrate deploy` (см. `railway.json`).
   - Опционально засеять данные: в Railway откройте Shell сервиса и запустите `npm run prisma:seed`.
6. Скопируйте публичный URL backend (Settings → Networking → Generate Domain).

## 2. Frontend на Vercel

1. Зарегистрируйтесь на [vercel.com](https://vercel.com), импортируйте репозиторий.
2. В настройках проекта установите:
   - **Root Directory** = `frontend`
   - **Framework Preset** = Vite (определится автоматически)
   - **Build Command** = `npm run build`
   - **Output Directory** = `dist`
3. Добавьте переменные окружения:
   - `VITE_API_URL` = `https://<ваш-backend>.up.railway.app/api`
   - `VITE_WS_URL` = `https://<ваш-backend>.up.railway.app`
4. Деплой запустится автоматически после каждого push.
5. После деплоя обновите `CORS_ORIGIN` в Railway на адрес Vercel-проекта.

## 3. Проверка

- Откройте URL фронтенда → войдите с `admin` / `admin123`.
- Создайте учителя в разделе «Учителя».
- Войдите учителем → создайте ученика → создайте курс → откройте доступ ученику.
- Войдите учеником → пройдите урок → проверьте дерево мотивации.

## 4. Локальная разработка

### Backend
```bash
cd backend
cp .env.example .env  # настроить DATABASE_URL под локальный Postgres
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev   # http://localhost:3000
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev         # http://localhost:5173
```
