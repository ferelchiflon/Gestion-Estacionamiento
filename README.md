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
| `database/migrations/004_auth_usuarios.sql` | Módulo 1: `token_version` para invalidar sesiones, `eliminado_en` para borrado lógico de usuarios e índices de rol/bloqueo. |
| `database/migrations/005_contratos_rango_semiabierto.sql` | Módulo 5 (alquileres): vigencia de contratos con rango semiabierto `'[)'` — `fecha_fin` exclusivo = día en que se libera la plaza — y CHECK `fecha_fin > fecha_inicio`. |

El runner registra `version`, `checksum` (sha256 del archivo) y `applied_at` en
`schema_migrations`, y aborta si un archivo ya aplicado cambia su checksum.

### Vigencia de contratos de alquiler: rango semiabierto `'[)'`

Decisión del responsable, implementada en `005_contratos_rango_semiabierto.sql`
(no se editan migraciones ya aplicadas):

- `fecha_fin` es el **día en que se libera la plaza** y es **exclusivo**: esa
  misma fecha puede asignarse a un nuevo contrato.
- Un contrato mensual que empieza el 01/11 y cubre todo noviembre termina el
  **01/12**.
- Con `'[)'`, `daterange(d, d)` sería un rango vacío (no cubriría ningún día),
  por eso el CHECK ahora exige `fecha_fin > fecha_inicio` (antes era `>=` con
  rango cerrado `'[]'`).
- El EXCLUDE `exk_contratos_solapados` sigue ignorando contratos `cancelado` y
  con borrado lógico (`eliminado_en IS NOT NULL`): solo esos pueden solaparse.
- En la UI, la fecha de fin se etiqueta **"Hasta (día de salida)"**.

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

Para la app Next.js crear además `web/.env.local` (no se versiona) con:

```
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=gestion_estacionamiento
APP_DB_USER=app_estacionamiento
APP_DB_PASSWORD=<el mismo password del rol app>
AUTH_SECRET=<generar con: openssl rand -base64 48>
```

El password del rol de aplicación **nunca** se escribe en las migraciones: se
pasa por variable (`psql -v app_password="..."`) o lo lee el runner desde
`.env.local`.

## Aplicación Next.js (módulo 1)

- Next.js App Router + TypeScript + Tailwind CSS.
- Autenticación con cookie `gestion_session` httpOnly, `SameSite=Lax`, firmada con `jose`.
- Expiración de sesión: 8 horas. Cambio de clave, cambio de rol, desactivación y borrado lógico incrementan `token_version` e invalidan el JWT actual.
- Middleware deny-by-default: sólo `/login` y `POST /api/auth/login` son públicos; `/usuarios` y `/api/usuarios` exigen `admin`.
- Cada API vuelve a verificar sesión y rol contra la base; no confía sólo en el middleware.
- Mutaciones verifican `Origin`/`Host`.
- Bloqueo tras 5 intentos fallidos por 15 minutos.
- Auditoría en `auditoria_cambios` para creación, actualización y borrado lógico de usuarios.
- Primer admin local:

```bash
cd web
npm run user:create -- --email admin@estacionamiento.local --password 'AdminLocal2026!'
```

Pantallas de prueba:

- `http://localhost:3000/login`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/usuarios` (sólo admin)

## Comandos

```bash
npm install          # instala pg (cliente PostgreSQL para Node)
npm run migrate      # aplica migraciones pendientes a $PGDATABASE
npm run test:db      # recrea $PGDATABASE_TEST, aplica migraciones y corre pruebas de integridad
npm run test:module1 # recrea la base de test y prueba permisos/auditoría del módulo 1

cd web
npm install
npm run dev          # Next.js en http://localhost:3000
npm run lint
npm test
npm run build
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
