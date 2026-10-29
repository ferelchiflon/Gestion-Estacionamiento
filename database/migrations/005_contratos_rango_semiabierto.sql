-- ============================================================================
-- 005_contratos_rango_semiabierto.sql
-- Alquileres: vigencia de contratos con rango SEMIABIERTO '[)'.
--
-- Decisión del responsable (resuelve PENDIENTES.md "Contratos"):
--   * fecha_fin es el día en que se libera la plaza y es EXCLUSIVO: esa misma
--     fecha puede asignarse a un nuevo contrato.
--   * Un contrato mensual que empieza el 01/11 y cubre todo noviembre termina
--     el 01/12 (la plaza se libera ese día).
--   * Con '[)', daterange(d, d) es un rango VACÍO (no cubriría ningún día),
--     por eso el CHECK pasa de `fecha_fin >= fecha_inicio` a
--     `fecha_fin > fecha_inicio`.
--   * El EXCLUDE sigue excluyendo SOLO contratos cancelados y con borrado
--     lógico: (estado <> 'cancelado' AND eliminado_en IS NULL).
--
-- No edita ninguna migración aplicada: reemplaza constraint y CHECK con
-- DROP + ADD; el runner ejecuta este archivo dentro de una transacción.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) CHECK de fechas: fin estrictamente mayor que inicio
-- ----------------------------------------------------------------------------
ALTER TABLE contratos_alquiler
    DROP CONSTRAINT IF EXISTS contratos_fechas_check;

ALTER TABLE contratos_alquiler
    ADD CONSTRAINT contratos_fechas_check CHECK (fecha_fin > fecha_inicio);

-- ----------------------------------------------------------------------------
-- 2) EXCLUDE de solapamiento por plaza, ahora con '[)'
--    Con '[)': el día de fecha_fin ya NO pertenece al contrato saliente, así
--    un nuevo contrato puede comenzar exactamente ese día.
-- ----------------------------------------------------------------------------
ALTER TABLE contratos_alquiler
    DROP CONSTRAINT IF EXISTS exk_contratos_solapados;

ALTER TABLE contratos_alquiler ADD CONSTRAINT exk_contratos_solapados
EXCLUDE USING gist (
    plaza_id WITH =,
    daterange(fecha_inicio, fecha_fin, '[)') WITH &&
) WHERE (estado <> 'cancelado' AND eliminado_en IS NULL);
