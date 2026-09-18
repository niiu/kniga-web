# Книга

Веб-мастерская и каталог интерактивных книг. Пишете в мастерской, читаете и публикуете в каталоге.

Десктопный редактор живёт отдельно: [niiu/kniga-engine](https://github.com/niiu/kniga-engine). Этот репозиторий — серверная версия: каталог, мастерская и проигрыватель в браузере.

## Что внутри

- **Каталог** — список опубликованных книг, загрузка `.story` / HTML, чтение
- **Мастерская** (`/editor`) — сцены, диалоги, характеристики, инвентарь, броски, предпросмотр
- **Черновики** — несколько книг сохраняются в мастерской и открываются из списка «Мои книги»
- **HTML-экспорт** — самостоятельная игра для читателя
- **Маркер подлинности** `KNIGA-ENGINE-v1` — в каталог принимаются только книги Книги, не случайные HTML-файлы

Каталог и мастерская не смешаны: писать можно локально или в мастерской, публиковать — на сайте.

## Формат книги

- `.story` — JSON истории (`title`, `scenes`, выборы, условия, эффекты, `rollTiers`)
- `.html` — самостоятельная игра с маркером `data-kniga-engine="KNIGA-ENGINE-v1"` и блоком `#kniga-story-data`

Старые `.story` без маркера, если в них есть `scenes[]`, по-прежнему открываются.

## Запуск

Локально:

```bash
npm install
npm run dev
```

Откроется каталог. Мастерская — `/editor`.

```bash
npm run typecheck
npm test
npm run build
```

Учётные записи выключены. Опубликованные книги пишутся в общую таблицу `published_books` (Postgres или встроенный PGLite). Черновики мастерской живут в браузере, не в каталоге.

## На сервер (Ubuntu)

Нужен Node 22 или Docker. Каталог без учёток: любой, у кого есть адрес, может читать и публиковать книги.

### Docker

```bash
git clone https://github.com/niiu/kniga-web.git
cd kniga-web
./deploy.sh
```

Сайт: `http://IP:8080`. Другой порт:

```bash
PORT=3000 ./deploy.sh
```

Скрипт сам выбирает `docker compose`, `docker-compose` или обычный `docker run`. Не используйте `docker -d` — короткий флаг `-d` у самого `docker` не существует.

Остановить: `docker compose down` (или `docker rm -f kniga`). Обновить: `git pull && ./deploy.sh`.

### Без Docker

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
git clone https://github.com/niiu/kniga-web.git /opt/kniga
cd /opt/kniga
npm ci
npm run build:server
sudo mkdir -p /var/lib/kniga
sudo chown "$USER" /var/lib/kniga
PGLITE_DATA_DIR=/var/lib/kniga PORT=8080 npm start
```

Чтобы крутилось после перезагрузки, скопируйте `deploy/kniga.service` в `/etc/systemd/system/` и выполните `systemctl enable --now kniga`.

Перед nginx / HTTPS подставьте свой домен в `deploy/nginx.conf` и включите его в `sites-enabled`. Сертификат — certbot.

### Postgres вместо файла

Если каталог должен жить в отдельной базе, задайте `DATABASE_URL` (Postgres). Без этой переменной используется встроенный PGLite, данные — в `PGLITE_DATA_DIR`.

Учётные записи не включайте: `VITE_AUTH_ENABLED=false` уже в сборке.

## Стек

TanStack Start, React 19, Tailwind v4, Zustand, движок историй из kniga-engine.
