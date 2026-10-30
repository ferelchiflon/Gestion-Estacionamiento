-- Migración 008: Índice único por CUIT normalizado del proveedor
-- Reemplaza el índice por nombre de proveedor (007) por uno por CUIT (11 dígitos)
-- La columna cuit_proveedor ya existe desde 001 (varchar(13) con guiones).
-- Se normaliza a 11 dígitos para el índice único.

-- 1) Eliminar índice anterior por nombre de proveedor (creado en 007)
DROP INDEX IF EXISTS uq_gastos_compras_comprobante;

-- 2) Backfill: normalizar CUITs existentes y poner valor por defecto donde sea NULL
--    Quitamos guiones y rellenamos con '00000000000' (11 ceros) los nulos
UPDATE gastos_compras
SET cuit_proveedor = regexp_replace(COALESCE(cuit_proveedor, '00000000000'), '[^0-9]', '', 'g')
WHERE cuit_proveedor IS NULL OR cuit_proveedor ~ '[^0-9]';

-- 3) Asegurar que la columna tenga solo 11 dígitos numéricos (constraint)
--    Primero eliminamos el CHECK anterior si existe (de 001)
ALTER TABLE gastos_compras DROP CONSTRAINT IF EXISTS gastos_compras_cuit_proveedor_check;

--    Nuevo CHECK: exactamente 11 dígitos
ALTER TABLE gastos_compras
ADD CONSTRAINT gastos_compras_cuit_proveedor_check
CHECK (cuit_proveedor ~ '^[0-9]{11}$');

-- 4) Índice único parcial por CUIT normalizado + comprobante
--    Clave: (cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante)
--    Solo aplica a registros no eliminados lógicamente (eliminado_en IS NULL)
CREATE UNIQUE INDEX uq_gastos_compras_cuit_comprobante
    ON gastos_compras (cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante)
    WHERE eliminado_en IS NULL;

-- 5) Índice adicional para búsquedas por CUIT
CREATE INDEX IF NOT EXISTS idx_gastos_compras_cuit ON gastos_compras (cuit_proveedor);