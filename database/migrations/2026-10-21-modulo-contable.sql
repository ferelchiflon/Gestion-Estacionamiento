-- ============================================================================
-- Migración 2026-10-21 · Módulo contable e impositivo (etapa a)
-- Sistema de Gestión de Estacionamiento
--
-- Alcance aprobado por el dueño del proyecto:
--   ✔ SOLO tablas NUEVAS: no se alteran movimientos, pagos_alquiler ni deudas.
--   ✔ Idempotente y no destructiva: CREATE TABLE IF NOT EXISTS + INSERT IGNORE
--     (se puede ejecutar más de una vez sin duplicar ni dañar datos).
--
-- Qué agrega:
--   1. configuracion_fiscal : datos de la empresa para IVA, IIBB, ARCA (ex AFIP),
--                             encabezado de PDFs y envío al contador (fila única id=1).
--   2. categorias_gasto     : categorías para clasificar gastos/compras.
--   3. gastos_compras       : libro de compras (alimenta IVA Compras y Balance).
--   4. percepciones_iibb    : percepciones/retenciones de IIBB por período y
--                             jurisdicción (preparado para Convenio Multilateral).
--   5. saldos_iva           : saldo técnico anterior por período (posición IVA mensual).
--
-- Pendiente de aprobación futura (NO ejecutar todavía):
--   ALTER TABLE movimientos
--       ADD COLUMN tipo_comprobante VARCHAR(10) NULL,
--       ADD COLUMN punto_venta SMALLINT NULL,
--       ADD COLUMN numero_comprobante INT NULL,
--       ADD COLUMN neto DECIMAL(10,2) NULL,
--       ADD COLUMN iva  DECIMAL(10,2) NULL;
--   ALTER TABLE pagos_alquiler
--       ADD COLUMN forma_pago VARCHAR(20) NULL,
--       ADD COLUMN neto DECIMAL(10,2) NULL,
--       ADD COLUMN iva  DECIMAL(10,2) NULL;
--   ALTER TABLE deudas
--       ADD COLUMN fecha_pago DATETIME NULL;
-- ============================================================================

USE gestion_estacionamiento;

-- ------------------------------------------------------------
-- 1) Configuración fiscal (fila única id=1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_fiscal (
    id INT PRIMARY KEY,
    razon_social VARCHAR(120) NOT NULL DEFAULT '',
    cuit VARCHAR(13) NOT NULL DEFAULT '',
    condicion_iva ENUM('responsable_inscripto','monotributo','exento') NOT NULL DEFAULT 'responsable_inscripto',
    alicuota_iva DECIMAL(5,2) NOT NULL DEFAULT 21.00,
    alicuota_iibb DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    jurisdiccion_iibb VARCHAR(60) NOT NULL DEFAULT 'CABA',
    nro_inscripcion_iibb VARCHAR(30) NULL,
    punto_venta SMALLINT NOT NULL DEFAULT 1,
    email_contador VARCHAR(120) NULL,
    inicio_actividades DATE NULL,
    direccion VARCHAR(150) NULL,
    telefono VARCHAR(30) NULL,
    actualizado_en DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO configuracion_fiscal (id) VALUES (1);

-- ------------------------------------------------------------
-- 2) Categorías de gasto
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_gasto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    descripcion VARCHAR(150) NULL,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_categorias_gasto_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO categorias_gasto (nombre, descripcion) VALUES
    ('Alquileres',    'Alquiler del inmueble / del local'),
    ('Servicios',     'Luz, agua, gas, internet y teléfono'),
    ('Sueldos',       'Salarios y cargas sociales'),
    ('Mantenimiento', 'Reparaciones y mantenimiento general'),
    ('Impuestos',     'ARCA (ex AFIP), IIBB, tasas municipales'),
    ('Seguros',       'Seguros y coberturas'),
    ('Limpieza',      'Limpieza e insumos'),
    ('Otros',         'Gastos no clasificados');

-- ------------------------------------------------------------
-- 3) Gastos / compras (libro de compras)
--    total = neto_gravado + iva_21 + iva_105 + iva_27 + no_gravado
--            + percepcion_iva + percepcion_iibb (validado en la app)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gastos_compras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    proveedor VARCHAR(120) NOT NULL,
    cuit_proveedor VARCHAR(13) NULL,
    tipo_comprobante VARCHAR(20) NOT NULL DEFAULT 'Factura C',
    punto_venta SMALLINT NULL,
    numero_comprobante INT NULL,
    neto_gravado DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva_21 DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva_105 DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva_27 DECIMAL(12,2) NOT NULL DEFAULT 0,
    no_gravado DECIMAL(12,2) NOT NULL DEFAULT 0,
    percepcion_iva DECIMAL(12,2) NOT NULL DEFAULT 0,
    percepcion_iibb DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    categoria_id INT NULL,
    forma_pago VARCHAR(20) NULL,
    notas VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_gastos_fecha (fecha),
    INDEX idx_gastos_proveedor (proveedor),
    INDEX idx_gastos_categoria (categoria_id),
    CONSTRAINT fk_gastos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_gasto(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4) Percepciones / retenciones de IIBB (carga manual por período)
--    periodo formato 'AAAA-MM'. Preparado para Convenio Multilateral
--    (reparto por jurisdicción) aunque hoy se use una sola.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS percepciones_iibb (
    id INT AUTO_INCREMENT PRIMARY KEY,
    periodo CHAR(7) NOT NULL,
    jurisdiccion VARCHAR(60) NOT NULL DEFAULT 'CABA',
    tipo ENUM('percepcion','retencion') NOT NULL DEFAULT 'percepcion',
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    detalle VARCHAR(150) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_percepciones_periodo (periodo),
    INDEX idx_percepciones_jurisdiccion (jurisdiccion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5) Saldo técnico de IVA anterior por período (posición IVA mensual)
--    saldo_tecnico_anterior > 0 → saldo a favor (crédito); < 0 → a pagar.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saldos_iva (
    id INT AUTO_INCREMENT PRIMARY KEY,
    periodo CHAR(7) NOT NULL,
    saldo_tecnico_anterior DECIMAL(12,2) NOT NULL DEFAULT 0,
    notas VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_saldos_iva_periodo (periodo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

