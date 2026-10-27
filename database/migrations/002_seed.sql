-- ============================================================================
-- Migración 002 · Datos semilla
--   * tipos_alquiler: Diario, Mensual, Anual
--   * configuracion_fiscal: fila única id=1 (vacía, solo valores por defecto)
--   * categorias_gasto: las 8 categorías del módulo contable
-- Idempotente: ON CONFLICT DO NOTHING.
-- ============================================================================

INSERT INTO tipos_alquiler (id, nombre) VALUES
    (1, 'Diario'),
    (2, 'Mensual'),
    (3, 'Anual')
ON CONFLICT (id) DO NOTHING;

INSERT INTO configuracion_fiscal (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO categorias_gasto (nombre, descripcion) VALUES
    ('Alquileres',    'Alquiler del inmueble / del local'),
    ('Servicios',     'Luz, agua, gas, internet y teléfono'),
    ('Sueldos',       'Salarios y cargas sociales'),
    ('Mantenimiento', 'Reparaciones y mantenimiento general'),
    ('Impuestos',     'ARCA (ex AFIP), IIBB, tasas municipales'),
    ('Seguros',       'Seguros y coberturas'),
    ('Limpieza',      'Limpieza e insumos'),
    ('Otros',         'Gastos no clasificados')
ON CONFLICT (nombre) DO NOTHING;
