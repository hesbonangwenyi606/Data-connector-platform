#!/bin/bash
set -e

echo "Waiting for postgres..."
while ! python -c "import psycopg2; psycopg2.connect(host='$POSTGRES_HOST', port='$POSTGRES_PORT', dbname='$POSTGRES_DB', user='$POSTGRES_USER', password='$POSTGRES_PASSWORD')" 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL is up."

echo "Creating migrations..."
python manage.py makemigrations accounts connectors extractions storage --noinput

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting server..."
exec python manage.py runserver 0.0.0.0:8000
