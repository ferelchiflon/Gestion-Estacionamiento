# Sistema de Gestión de Estacionamiento

Aplicación PHP (MVC artesanal) para la administración de un estacionamiento:
movimientos de vehículos, alquileres de plazas, caja, contable/impositivo (IVA,
IIBB, ARCA) y asistente de ayuda (bot).

## Servidor de base de datos

- Motor: **PostgreSQL 18** (instalación **Postgres.app**), escuchando en `127.0.0.1:5432`.
- Binarios cliente: `/Applications/Postgres.app/Contents/Versions/18/bin` (`psql`, `pg_dump`).
- Data dir de Postgres.app: `~/Library/Application Support/Postgres/var-18`.
- Los archivos SQL bajo `database/` en dialecto MySQL (`schema.sql`,
  `2026-10-2x-*.sql`) quedan como **histórico del esquema original**; el esquema
  vigente de PostgreSQL se gestiona con las migraciones de `database/migrations/`
  y el runner de Node (`scripts/`).

## Estructura de migraciones

| Archivo | Contenido |
|---|---|
| `database/migrations/001_initial_schema.sql` | Esquema completo: dinero `NUMERIC(14,2)`, soft-delete (`eliminado_en`), CHECKs de valores permitidos, índice único parcial de movimientos abiertos, EXCLUDE de contratos solapados (btree_gist), auditoría inmutable por triggers. |
| `database/migrations/002_seed.sql` | Semilla: tipos_alquiler (Diario/Mensual/Anual), configuracion_fiscal id=1 vacía, 8 categorías de gasto. |
| `database/migrations/003_roles_permisos.sql` | Rol `app_estacionamiento` con mínimo privilegio (sin DELETE ni TRUNCATE; auditoría solo SELECT/INSERT; secuencias con USAGE/SELECT; ALTER DEFAULT PRIVILEGES). |

El runner registra `version`, `checksum` (sha256 del archivo) y `applied_at` en
`schema_migrations`, y aborta si un archivo ya aplicado cambia su checksum.

## Configuración

Crear `.env.local` en la raíz (no se versiona; ya está en `.gitignore`):

```
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=gestion_estacionamiento
PGADMIN_USER=macbook
APP_DB_PASSWORD=<generar con: openssl rand -base64 32>
```

El nombre de la base de test (`gestion_estacionamiento_test`) y el del rol de
aplicación (`app_estacionamiento`) están definidos como constantes en
`scripts/test-db.js` y `database/migrations/003_roles_permisos.sql`
respectivamente.

El password del rol de aplicación **nunca** se escribe en las migraciones: se
pasa por variable (`psql -v app_password="..."`) o lo lee el runner desde
`.env.local`.

## Comandos

```bash
npm install          # instala pg (cliente PostgreSQL para Node)
npm run migrate      # aplica migraciones pendientes a $PGDATABASE
npm run test:db      # recrea $PGDATABASE_TEST, aplica migraciones y corre pruebas de integridad
```

## Rol de aplicación

`app_estacionamiento`: LOGIN con password (definido en `.env.local`),
SELECT/INSERT/UPDATE sobre tablas operativas y contables, sin DELETE ni
TRUNCATE, y solo SELECT/INSERT en `auditoria_cambios` (además inmutable por
triggers). Nota: con la configuración por defecto de Postgres.app, las
conexiones desde `127.0.0.1` usan `trust` en `pg_hba.conf`; el password queda
configurado para cuando se endurezca el acceso local/red.

## Verificación de checksums

```bash
shasum -a 256 database/migrations/*.sql
psql -d gestion_estacionamiento -c "SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version;"
```
