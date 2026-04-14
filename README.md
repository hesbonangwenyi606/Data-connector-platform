# Data Connector Platform

A web app that lets you connect to different databases, pull out data, edit it, and save it — all from a clean browser interface.

---

## Screenshots

### Login
![Login](docs/screenshots/login.png)

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Connections
![Connections](docs/screenshots/connections.png)

### Extract — Configure
![Extract Configure](docs/screenshots/extract-configure.png)

### Extract — Review & Edit
![Extract Review](docs/screenshots/extract-review.png)

### Extract — Complete
![Extract Complete](docs/screenshots/extract-complete.png)

### Files
![Files](docs/screenshots/files.png)

### Django Admin Panel
![Django Admin](docs/screenshots/admin-panel.png)

### Django Admin — Users
![Django Admin Users](docs/screenshots/admin-users.png)

---

## What does it do?

1. You add a database connection (PostgreSQL, MySQL, MongoDB, or ClickHouse) by entering the host, port, and credentials
2. You pick a table from that database and choose how many rows to pull
3. The data shows up in an editable table — click any cell to change it
4. When you're happy with your edits, you hit Submit — the changes are saved to the app's database **and** exported as both a JSON file and a CSV file automatically
5. You can download those files later, or share them with other users

There are two types of users: **admins** (see everything) and **regular users** (see only their own data).

---

## What's it built with?

- **Frontend** — Next.js 14, TypeScript, Tailwind CSS
- **Backend** — Django 4.2, Django REST Framework
- **Login system** — JWT tokens (you stay logged in, no page reloads needed)
- **Databases it can connect to** — PostgreSQL, MySQL, MongoDB, ClickHouse
- **Runs via** — Docker + Docker Compose (one command starts everything)

---

## How to run it

### Step 1 — Make sure Docker Desktop is running

Download it from [docker.com](https://www.docker.com/products/docker-desktop/) if you don't have it. Open it and wait until the whale icon in your taskbar stops animating. It must be in **Linux containers** mode (right-click the tray icon to check).

### Step 2 — Start everything

Open a terminal in the project folder and run:

```bash
docker compose up --build
```

The first run takes a few minutes — it's downloading and building everything. To run it silently in the background:

```bash
docker compose up --build -d
```

### Step 3 — Open the app

| What | Where |
|---|---|
| The app | http://localhost:3000 |
| Backend API | http://localhost:8000/api |
| Django admin panel | http://localhost:8000/admin |

### Step 4 — Create your first admin account

In a second terminal, run:

```bash
docker compose exec backend python manage.py createsuperuser
```

Follow the prompts to set a username and password. Then log in at http://localhost:3000/login.

---

## Connecting to the built-in Docker databases

When adding connections inside the app, use the **service name** as the host — not `localhost`. `localhost` inside a Docker container refers to the container itself, not your machine.

| Database | Host | Port | Database | Username | Password |
|---|---|---|---|---|---|
| PostgreSQL | `postgres` | `5432` | `appdb` | `postgres` | `postgres` |
| MySQL | `mysql` | `3306` | `mysqldb` | `mysql` | `mysql` |
| MongoDB | `mongo` | `27017` | `admin` | `mongo` | `mongo` |
| ClickHouse | `clickhouse` | `9000` | `default` | `default` | *(empty)* |

---

## How to use the app

### Adding a database connection
Go to **Connections** in the sidebar. Click **Add Connection**, fill in the details, and save. Click **Test** on any connection to verify it's reachable before using it. A blue banner confirms when a connection is successfully created.

### Pulling data
Go to **Extract**. Pick a connection, select a table from the dropdown (it loads automatically after you pick a connection), set how many rows you want (batch size) and where to start from (offset), then click **Extract Data**.

### Editing data
After extracting, the data appears in a table. Click any cell to edit it — press Enter or click away to confirm. Modified rows turn amber so you can see what changed. When done, click **Submit Changes**.

> You must edit at least one cell before submitting.

### Downloading files
Every time you submit, two files are created automatically (one JSON, one CSV). Go to **Files** to see them. You can download any file or share it with another user by entering their username.

### Adding sample data to MongoDB
If MongoDB has no collections yet, insert some via the terminal:

```bash
docker compose exec mongo mongosh -u mongo -p mongo --authenticationDatabase admin --eval "
db = db.getSiblingDB('admin');
db.employees.insertMany([
  {name: 'Alice Kamau', department: 'Engineering', salary: 85000, joined: '2022-01-15'},
  {name: 'Brian Otieno', department: 'Finance', salary: 72000, joined: '2021-06-10'},
  {name: 'Carol Wanjiku', department: 'HR', salary: 65000, joined: '2023-03-01'},
  {name: 'David Mwangi', department: 'Engineering', salary: 90000, joined: '2020-11-20'}
]);
print('Done');
"
```

### Managing users (admin only)
Admins can see the **Users** page in the sidebar, which lists everyone registered on the platform.

---

## Folder layout

```
data-connector/
├── .env                  ← all configuration (passwords, ports, etc.)
├── docker-compose.yml    ← starts all services together
├── backend/              ← Django API
│   ├── accounts/         ← users and authentication
│   ├── connectors/       ← database connection configs and connector logic
│   ├── extractions/      ← batch extraction and data records
│   └── storage/          ← file exports and sharing
└── frontend/             ← Next.js app
    └── src/
        ├── app/          ← pages (dashboard, connections, extract, files, users)
        ├── components/   ← reusable UI (DataGrid, Layout, Modal, etc.)
        ├── context/      ← auth state
        ├── lib/          ← API client, token helpers, utilities
        └── types/        ← TypeScript interfaces
```

---

## Configuration

Everything is configured in the `.env` file. The defaults work out of the box for local development.

| Setting | What it's for | Default |
|---|---|---|
| `SECRET_KEY` | Django's encryption key — change this in production | *(set in .env)* |
| `DEBUG` | Django debug mode | `True` |
| `POSTGRES_PASSWORD` | App database password | `postgres` |
| `MYSQL_PASSWORD` | MySQL connector password | `mysql` |
| `MONGO_PASSWORD` | MongoDB connector password | `mongo` |
| `NEXT_PUBLIC_API_URL` | Where the frontend looks for the API | `http://localhost:8000/api` |

---

## Running the tests

```bash
docker compose exec backend python manage.py test
```

This runs tests for login/registration, database connections, data extraction, file creation, and access permissions.

---

## Stopping the app

```bash
docker compose down
```

To also delete all stored data (database volumes):

```bash
docker compose down -v
```

---

## Why things were built the way they were

**One interface for all database types**
Each database (Postgres, MySQL, etc.) works differently under the hood. Rather than writing messy `if db_type == 'mysql'` checks everywhere, each database has its own self-contained connector class. They all speak the same language to the rest of the app. Adding a new database type in the future means writing one new class and registering it in one place — nothing else changes.

**Files are always created in pairs**
Every time you submit data, the app writes both a JSON file and a CSV file. JSON is great for machines to read; CSV is great for opening in Excel. You get both without having to choose.

**If the file write fails, your data is still saved**
Saving to the database happens first. If writing the file to disk fails for any reason (full disk, permissions, etc.), the database record is kept safe and you get a warning. You never lose data because of a file system problem.

**Passwords are never sent back to you**
When you create a connection, the password is stored but never returned by the API — not in lists, not in detail views. You can update it, but you can't read it back out.

**You stay logged in automatically**
Access tokens expire after 1 day. When that happens, the app silently gets a new one in the background using your refresh token (valid for 7 days). You won't notice — no sudden logouts mid-session.

**Datetime and decimal values are handled automatically**
Databases return values like `2024-01-15 10:30:00` or `85000.00` as special Python types that can't be stored as plain text. The connector layer converts them all to standard strings and numbers before saving, so nothing breaks when the data hits the grid or the export files.
#



