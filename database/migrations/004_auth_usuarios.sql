-- ============================================================================
-- Migración 004 · Módulo 1: usuarios, roles, sesión e inactivación lógica
-- No edita 001/002/003: agrega columnas y índices requeridos por la app.
-- ============================================================================

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS eliminado_en timestamp with time zone;

DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'usuarios_token_version_check'
          AND conrelid = 'usuarios'::regclass
    ) THEN
        ALTER TABLE usuarios
            ADD CONSTRAINT usuarios_token_version_check CHECK (token_version >= 1);
    END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS idx_usuarios_rol_activo
    ON usuarios (rol)
    WHERE activo = true AND eliminado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueo
    ON usuarios (bloqueado_hasta)
    WHERE bloqueado_hasta IS NOT NULL;
