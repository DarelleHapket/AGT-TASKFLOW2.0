#!/bin/sh
set -e
echo "Attente de Postgres…"
until python -c "import socket; socket.create_connection(('${POSTGRES_HOST:-db}', 5432), 2)" 2>/dev/null; do
  sleep 1
done
python manage.py migrate --noinput
python manage.py bootstrap_superadmin
python manage.py collectstatic --noinput > /dev/null
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
