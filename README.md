# Neon Trigger Online

Бесплатный тестовый WebSocket-сервер для Neon Trigger. Лимит — **10 игроков в одной комнате**.

## Что реализовано на сервере
- WebSocket endpoint: `/ws`
- HTTP health/status endpoint: `/health`
- Счётчик подключённых игроков онлайн
- Создание комнат при первом входе и удаление пустых комнат
- Вход в комнату по коду, максимум 10 игроков
- События входа/выхода, движения, выстрела и чата
- Heartbeat для обнаружения отключившихся клиентов

## Развёртывание на Render
1. Открой https://render.com/ и войди через GitHub.
2. Нажми **New → Web Service**.
3. Выбери репозиторий `vpvanchick/neon-trigger-online`.
4. Render должен определить настройки из `render.yaml`. Если нет: Runtime **Node**, Build Command `npm install`, Start Command `npm start`, Health Check Path `/health`.
5. Выбери Free и нажми Deploy.
6. После развёртывания адрес WebSocket будет `wss://ИМЯ-СЕРВИСА.onrender.com/ws`.

## Протокол клиента
Подключение: `wss://ИМЯ-СЕРВИСА.onrender.com/ws`

Отправить JSON:
- Войти: `{"type":"join","room":"ABCD","name":"Игрок"}`
- Движение: `{"type":"move","x":120,"y":80,"angle":1.2}`
- Выстрел: `{"type":"shoot","x":120,"y":80,"angle":1.2}`
- Чат: `{"type":"chat","text":"Привет!"}`
- Выйти: `{"type":"leave"}`

Основные ответы: `welcome`, `online`, `joined`, `player-joined`, `player-left`, `player-moved`, `player-shot`, `chat`, `error`.

## Важно
Это серверная основа для комнат, присутствия и ретрансляции событий. Она **ещё не подключена к HTML/EXE-клиенту игры**; попадания, урон, античит и авторитетная симуляция матча пока не реализованы. После публикации сервера потребуется интегрировать WebSocket-клиент в Neon Trigger. Бесплатный Render может усыплять сервис после периода бездействия; первый запуск после сна будет медленнее.
