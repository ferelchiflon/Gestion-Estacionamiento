-- ============================================================================
-- Migración 009 · Módulo 6 — Contable de referencia interna (IVA)
-- Sistema de Gestión de Estacionamiento
--
-- Alcance: SOLO reportes de referencia interna para revisión del contador.
-- No genera declaraciones juradas, archivos oficiales (ARCA/AFIP) ni IIBB.
--
-- Qué agrega:
--   1. pagos_alquiler.recibo_id → NOT NULL. Cada pago de alquiler debe estar
--      vinculado a su recibo. Es la invariante que el PHP NO respetaba
--      (el PHP insertaba el pago sin recibo y nunca lo vinculaba).
--      Con el vínculo, los reportes de IVA pueden distinguir un pago vigente
--      de uno anulado, porque el recibo queda atado al pago.
--   2. Índices de período para los reportes de IVA (lecturas por rango de
--      fechas): recibos.fecha_emision y pagos_alquiler.fecha_pago.
--
-- Lo que NO hace (a propósito):
--   * No agrega columnas de IVA a ventas: el sistema no discrimina la
--     alícuota por operación, por lo que los reportes de ventas usan la
--     alícuota general de configuracion_fiscal y lo documentan como
--     limitación en el encabezado del reporte.
--   * No toca gastos_compras: ya discrimina iva_21 / iva_105 / iva_27.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Vinculación obligatoria pago de alquiler -> recibo
--
-- Backfill determinista: se vincula únicamente cuando existe EXACTAMENTE un
-- recibo candidato (mismo contrato, mismo monto, no eliminado lógicamente).
-- Si algún pago queda sin vínculo la migración ABORTA con un mensaje claro:
-- no se inventan links ni se borra información contable.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    sin_vinculo integer;
BEGIN
    UPDATE pagos_alquiler pa
       SET recibo_id = r.recibo_id
      FROM (
            SELECT p.id AS pago_id, MIN(rb.id) AS recibo_id
              FROM pagos_alquiler p
              JOIN recibos rb
                ON rb.contrato_id = p.contrato_id
               AND rb.monto = p.monto
               AND rb.eliminado_en IS NULL
             WHERE p.recibo_id IS NULL
               AND p.eliminado_en IS NULL
             GROUP BY p.id
            HAVING COUNT(rb.id) = 1
           ) r
     WHERE pa.id = r.pago_id;

    SELECT count(*)
      INTO sin_vinculo
      FROM pagos_alquiler
     WHERE recibo_id IS NULL
       AND eliminado_en IS NULL;

    IF sin_vinculo > 0 THEN
        RAISE EXCEPTION
            'Quedan % pago(s) de alquiler sin recibo vinculado. '
            'Vincularlos manualmente (UPDATE pagos_alquiler SET recibo_id = ...) '
            'antes de volver a aplicar la migracion.', sin_vinculo;
    END IF;
END $$;

ALTER TABLE pagos_alquiler ALTER COLUMN recibo_id SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 2) Índices para los reportes de IVA por período
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_recibos_fecha_emision
    ON recibos (fecha_emision);

CREATE INDEX IF NOT EXISTS idx_pagos_alquiler_fecha_pago
    ON pagos_alquiler (fecha_pago);
