-- UNIQUE constraint para pagos de alquiler: un solo pago por contrato y período
ALTER TABLE pagos_alquiler
ADD CONSTRAINT uq_pagos_alquiler_contrato_periodo
UNIQUE (contrato_id, periodo);
