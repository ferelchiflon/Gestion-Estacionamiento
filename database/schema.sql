-- ============================================================
-- Sistema de Gestión de Estacionamiento - Esquema de BD
-- Base de datos: gestion_estacionamiento
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestion_estacionamiento
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gestion_estacionamiento;

-- ------------------------------------------------------------
-- Clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    documento VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    telefono VARCHAR(20) NULL,
    saldo_actual DECIMAL(10,2) NOT NULL DEFAULT 0,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    INDEX idx_clientes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Vehículos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patente VARCHAR(10) NOT NULL,
    tipo ENUM('auto','moto','camioneta','discapacidad') NOT NULL DEFAULT 'auto',
    marca VARCHAR(50) NULL,
    modelo VARCHAR(50) NULL,
    color VARCHAR(30) NULL,
    cliente_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_vehiculos_patente (patente),
    INDEX idx_vehiculos_cliente (cliente_id),
    CONSTRAINT fk_vehiculos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Plazas de estacionamiento
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plazas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(10) NOT NULL,
    sector VARCHAR(20) NOT NULL DEFAULT 'A',
    tipo_vehiculo VARCHAR(20) NOT NULL DEFAULT 'auto',
    estado ENUM('libre','ocupada','mantenimiento') NOT NULL DEFAULT 'libre',
    UNIQUE KEY uq_plazas_numero (numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tarifas (vigencia por rango de fechas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarifas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo_vehiculo VARCHAR(20) NOT NULL,
    tarifa_hora DECIMAL(10,2) NOT NULL DEFAULT 0,
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NULL,
    INDEX idx_tarifas_tipo (tipo_vehiculo, fecha_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Movimientos (ingresos/egresos de vehículos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patente VARCHAR(10) NOT NULL,
    plaza_id INT NOT NULL,
    hora_entrada DATETIME NOT NULL,
    hora_salida DATETIME NULL,
    monto_calculado DECIMAL(10,2) NOT NULL DEFAULT 0,
    monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado_pago ENUM('pendiente','pagado','deuda') NOT NULL DEFAULT 'pendiente',
    forma_pago VARCHAR(20) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_movimientos_patente (patente),
    INDEX idx_movimientos_plaza (plaza_id),
    INDEX idx_movimientos_entrada (hora_entrada),
    CONSTRAINT fk_movimientos_plaza FOREIGN KEY (plaza_id) REFERENCES plazas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Deudas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deudas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    movimiento_id INT NULL,
    monto_original DECIMAL(10,2) NOT NULL DEFAULT 0,
    monto_con_interes DECIMAL(10,2) NOT NULL DEFAULT 0,
    fecha_vencimiento DATE NULL,
    estado ENUM('pendiente','pagada') NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_deudas_cliente (cliente_id, estado),
    CONSTRAINT fk_deudas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tipos de alquiler (1=Diario, 2=Mensual, 3=Anual)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_alquiler (
    id INT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Contratos de alquiler de plazas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos_alquiler (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plaza_id INT NOT NULL,
    cliente_id INT NOT NULL,
    tipo_alquiler_id INT NOT NULL DEFAULT 1,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    monto_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    cuota_mensual DECIMAL(10,2) NOT NULL DEFAULT 0,
    dia_vencimiento TINYINT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_contratos_plaza (plaza_id),
    INDEX idx_contratos_cliente (cliente_id),
    CONSTRAINT fk_contratos_plaza FOREIGN KEY (plaza_id) REFERENCES plazas(id),
    CONSTRAINT fk_contratos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    CONSTRAINT fk_contratos_tipo FOREIGN KEY (tipo_alquiler_id) REFERENCES tipos_alquiler(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Pagos de alquiler
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos_alquiler (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contrato_id INT NOT NULL,
    periodo VARCHAR(10) NOT NULL,
    monto DECIMAL(10,2) NOT NULL DEFAULT 0,
    fecha_pago DATETIME NOT NULL,
    recibo_id INT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pagado',
    INDEX idx_pagos_contrato (contrato_id),
    CONSTRAINT fk_pagos_contrato FOREIGN KEY (contrato_id) REFERENCES contratos_alquiler(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Recibos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recibos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movimiento_id INT NULL,
    contrato_id INT NULL,
    cliente_id INT NULL,
    monto DECIMAL(10,2) NOT NULL DEFAULT 0,
    forma_pago VARCHAR(20) NULL,
    fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enviado_email TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_recibos_movimiento (movimiento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Log de notificaciones
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs_notificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'manual',
    canal VARCHAR(20) NOT NULL DEFAULT 'email',
    destinatario VARCHAR(120) NULL,
    mensaje TEXT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'enviado',
    fecha_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_logs_cliente (cliente_id),
    INDEX idx_logs_fecha (fecha_envio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Configuración de notificaciones (fila única id=1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_notificaciones (
    id INT PRIMARY KEY,
    smtp_host VARCHAR(120) NULL,
    smtp_user VARCHAR(120) NULL,
    smtp_pass VARCHAR(120) NULL,
    whatsapp_api_key VARCHAR(255) NULL,
    whatsapp_phone_number_id VARCHAR(50) NULL,
    ultima_actualizacion DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DATOS INICIALES
-- ============================================================

INSERT INTO tipos_alquiler (id, nombre) VALUES
    (1, 'Diario'), (2, 'Mensual'), (3, 'Anual');

INSERT INTO tarifas (tipo_vehiculo, tarifa_hora, fecha_desde, fecha_hasta) VALUES
    ('auto', 500.00, CURDATE(), NULL),
    ('moto', 300.00, CURDATE(), NULL),
    ('camioneta', 700.00, CURDATE(), NULL),
    ('discapacidad', 0.00, CURDATE(), NULL);

INSERT INTO plazas (numero, sector, tipo_vehiculo) VALUES
    ('A1','A','auto'), ('A2','A','auto'), ('A3','A','auto'),
    ('A4','A','auto'), ('A5','A','auto'), ('A6','A','auto'),
    ('A7','A','auto'), ('A8','A','auto'),
    ('B1','B','moto'), ('B2','B','moto'), ('B3','B','moto'),
    ('B4','B','moto'),
    ('C1','C','camioneta'), ('C2','C','camioneta'),
    ('D1','D','discapacidad'), ('D2','D','discapacidad');

INSERT INTO configuracion_notificaciones (id) VALUES (1);

-- Cliente y vehículo de prueba
INSERT INTO clientes (nombre, documento, email, telefono, saldo_actual)
VALUES ('Juan Pérez', '30123456', 'juan.perez@example.com', '5491100000001', 5000.00);

INSERT INTO vehiculos (patente, tipo, marca, modelo, color, cliente_id)
VALUES ('ABC123', 'auto', 'Toyota', 'Corolla', 'Gris', 1);
