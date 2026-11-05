-- ============================================================================
-- Migración 011 · Permisos y anti-duplicado para GASTOS
-- Requiere 007_gastos y 008_gastos_cuit_unique
-- ============================================================================

-- 1) Permisos: solo admin y contador leen y crean gastos; solo admin elimina
--    (El rol app_estacionamiento ya tiene SELECT/INSERT/UPDATE en gastos_compras)
--    Revocamos DELETE para que solo admin pueda borrar (via SECURITY DEFINER functions o RLS)
--    Nota: app_estacionamiento NO tiene DELETE en gastos_compras por 003_roles_permisos
--    El operador no tiene fiscal.read ni fiscal.write (validado en API)

-- 2) Índice único anti-duplicado: (cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante)
--    Solo aplica cuando eliminado_en IS NULL (permite reusar comprobante tras soft delete)
CREATE UNIQUE INDEX IF NOT EXISTS uq_gastos_compras_comprobante_unico
    ON gastos_compras (cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante)
    WHERE eliminado_en IS NULL;

-- 3) Exigir CUIT cuando hay IVA (> 0)
--    Ya existe CHECK en 008: iva_21 > 0 AND cuit_proveedor IS NOT NULL
--    Reforzamos con trigger para mensaje claro
CREATE OR REPLACE FUNCTION trg_gastos_requerir_cuit_con_iva()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.iva_21 > 0 AND (NEW.cuit_proveedor IS NULL OR NEW.cuit_proveedor = '') THEN
        RAISE EXCEPTION 'CUIT_REQUERIDO_CON_IVA: El proveedor debe tener CUIT cuando hay IVA > 0';
    END IF;
    RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_gastos_requerir_cuit ON gastos_compras;
CREATE TRIGGER trg_gastos_requerir_cuit
    BEFORE INSERT OR UPDATE ON gastos_compras
    FOR EACH ROW EXECUTE FUNCTION trg_gastos_requerir_cuit_con_iva();

COMMENT ON INDEX uq_gastos_compras_comprobante_unico IS 'Anti-duplicado: un solo comprobante activo por proveedor (CUIT), tipo, punto de venta y número';