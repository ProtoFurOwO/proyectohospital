#!/bin/bash
echo "Borrando tablas duplicadas..."
docker exec hospital-mysql-citas mysql -uhospital -phospital123 -e "USE citas; DROP TABLE IF EXISTS citas_legacy;"
docker exec hospital-postgres-expedientes psql -U hospital -d expedientes -c "DROP TABLE IF EXISTS historias_clinicas;"
docker exec hospital-mariadb-quirofanos mysql -uhospital -phospital123 -e "USE quirofanos; DROP TABLE IF EXISTS ocupacion_salas;"
docker exec hospital-redis-personal redis-cli -a hospital123 FLUSHALL
echo "Tablas borradas. Re-creando desde cero..."
source .venv/bin/activate
python3 scripts/seed_5dbs.py
echo "Listo! Base de datos limpia."
