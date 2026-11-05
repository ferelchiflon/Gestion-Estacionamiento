-- ============================================================================
-- Migración 010 · Columna debe_cambiar_password en usuarios
-- Para forzar cambio de contraseña en primer ingreso tras reset por admin
-- ============================================================================

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS debe_cambiar_password boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_usuarios_debe_cambiar_password
    ON usuarios (debe_cambiar_password)
    WHERE debe_cambiar_password = true AND eliminado_en IS NULL;

COMMENT ON COLUMN usuarios.debe_cambiar_password IS 'Indica si el usuario debe cambiar su contraseña en el próximo ingreso (tras reset por admin)';