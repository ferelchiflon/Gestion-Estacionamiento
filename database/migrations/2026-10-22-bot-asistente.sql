-- ============================================================================
-- Migración 2026-10-22 · Asistente de ayuda (bot) — etapa (a)
-- Sistema de Gestión de Estacionamiento
--
-- Alcance:
--   ✔ SOLO tablas NUEVAS: no se altera ninguna tabla existente.
--   ✔ Idempotente y no destructiva: CREATE TABLE IF NOT EXISTS
--     (se puede ejecutar más de una vez sin duplicar ni dañar datos).
--
-- Qué agrega:
--   1. bot_conversaciones : registro de cada pregunta del asistente
--                           (usuario_id queda NULL hasta que exista login;
--                           por ahora se identifica por sesion_id).
--   · util               : 'si' | 'no' | NULL  (feedback "¿Te sirvió?")
--   · sin_respuesta      : 1 cuando el bot no encontró el tema (para el
--                           panel admin /bot/admin y mejorar la KB).
-- ============================================================================

USE gestion_estacionamiento;

CREATE TABLE IF NOT EXISTS bot_conversaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    sesion_id VARCHAR(64) NOT NULL DEFAULT '',
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pregunta VARCHAR(300) NOT NULL,
    respuesta TEXT NULL,
    entrada_id VARCHAR(60) NULL,
    puntaje DECIMAL(8,2) NULL,
    pantalla VARCHAR(200) NULL,
    util ENUM('si','no') NULL,
    sin_respuesta TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_bot_fecha (fecha),
    INDEX idx_bot_sesion (sesion_id),
    INDEX idx_bot_sin_respuesta (sin_respuesta),
    INDEX idx_bot_util (util),
    INDEX idx_bot_entrada (entrada_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
