-- ============================================================================
-- Migración 003 · Rol de aplicación y permisos (mínimo privilegio)
--
-- El password del rol NO está en este archivo: se pasa como variable
--   psql -v app_password="..." -f 003_roles_permisos.sql
-- o, vía npm run migrate, se toma de .env.local (APP_DB_PASSWORD).
-- ============================================================================

-- 1) Rol de aplicación: crear si no existe (sin password en este punto)
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_estacionamiento') THEN
        CREATE ROLE app_estacionamiento NOLOGIN;
    END IF;
END
$do$;

-- 2) LOGIN + password desde variable (nunca versionada)
ALTER ROLE app_estacionamiento LOGIN PASSWORD :'app_password';

-- 3) Tablas operativas y contables: SELECT/INSERT/UPDATE, sin DELETE ni TRUNCATE
GRANT SELECT, INSERT, UPDATE ON
    clientes, vehiculos, plazas, tarifas, tipos_alquiler,
    contratos_alquiler, movimientos, deudas, pagos_alquiler, recibos,
    usuarios, bot_conversaciones, rate_limit,
    configuracion_fiscal, categorias_gasto, gastos_compras, percepciones_iibb, saldos_iva
TO app_estacionamiento;

-- 4) Auditoría: solo SELECT e INSERT (la inmutabilidad la refuerzan los triggers)
GRANT SELECT, INSERT ON auditoria_cambios TO app_estacionamiento;

-- 5) Secuencias: USAGE (nextval/currval) y SELECT en todas
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_estacionamiento;

-- 6) Objetos futuros del esquema public: mismos permisos por defecto
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE ON TABLES TO app_estacionamiento;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_estacionamiento;
