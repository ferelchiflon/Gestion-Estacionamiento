-- Índice único parcial para evitar duplicados de comprobante
-- Clave: (tipo_comprobante, punto_venta, numero_comprobante, proveedor)
-- Solo aplica a registros no eliminados lógicamente (eliminado_en IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_gastos_compras_comprobante
    ON gastos_compras (tipo_comprobante, punto_venta, numero_comprobante, proveedor)
    WHERE eliminado_en IS NULL;

-- Índices adicionales para reportes y filtros
CREATE INDEX IF NOT EXISTS idx_gastos_compras_fecha ON gastos_compras (fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_compras_categoria ON gastos_compras (categoria_id);
CREATE INDEX IF NOT EXISTS idx_gastos_compras_proveedor ON gastos_compras (proveedor);