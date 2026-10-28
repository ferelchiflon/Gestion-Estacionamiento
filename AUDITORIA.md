# AUDITORÍA TÉCNICA — Sistema Gestión Estacionamiento
Fecha: 22/10/2026
Sin modificaciones al proyecto.

## Inventario
Archivos PHP core, controllers, models, services, vistas ~35. Tablas: clientes, vehiculos, plazas, tarifas, movimientos, deudas, tipos_alquiler, contratos_alquiler, pagos_alquiler, recibos, logs_notificaciones, configuracion_notificaciones, bot_conversaciones, configuracion_fiscal, categorias_gasto, gastos_compras, percepciones_iibb, saldos_iva.

## Resumen ejecutivo
MVC artesanal funcional. Riesgo crítico: sin autenticación, todas rutas públicas. XSS en vistas, sin CSRF, sesión sin hardening, .env con root/root no ignorado. Integridad comprometida por inyección vía Model::all/where, estados plaza/movimiento no atómicos, sin auditoría. Bug crítico en ReporteContable rompe ARCA. Rendimiento degradado por YEAR/MONTH. No apto producción sin Etapa 1.
Puntajes: Seguridad 2/10, Integridad 5/10, Contable 6/10, Arquitectura 6/10, Rendimiento 5/10, UX 6/10, Bot 7/10, Operación 3/10

## Hallazgos principales
SEC-01 CRÍTICO Sin autenticación. app/middleware/AuthMiddleware.php vacío.
SEC-02 CRÍTICO /bot/admin abierto. index.php:130
SEC-03 ALTO XSS vistas. app/view/movimientos/activos.php:31-33 sin htmlspecialchars
SEC-04 ALTO Sin CSRF en POST
SEC-05 ALTO Sesión insegura config/config.php:2
SEC-06 ALTO Secretos expuestos .env, .gitignore
INT-01 CRÍTICO Inyección SQL Model.php:20,31
INT-02 ALTO Estados plaza/movimiento no atómicos
CNT-01 CRÍTICO Bug ARCA registrarPago firma incorrecta
PERF-01 MEDIO YEAR/MONTH impide índice

## Top 10
1 Login + autorización
2 Proteger /bot/admin
3 Escapar salidas HTML
4 Tokens CSRF
5 Corregir bug registrarPago e IVA
6 Arreglar inyección Model
7 Transacciones plaza-movimiento
8 Hardening sesión
9 Rangos fecha vs YEAR/MONTH
10 .gitignore .env

## Hoja de ruta
Etapa1 Seguridad, Etapa2 Integridad, Etapa3 Contable, Etapa4 Rendimiento/UX, Etapa5 Producción

## Bien hecho
PDO preparado, MVC claro, módulo contable con migraciones, bot con render seguro y rate limit, tarifas con vigencia, zona horaria AR.

## A confirmar
Exposición internet, corte contable por salida/entrada, interés deudas, comprobantes fiscales, backups.

## Mejoras sugeridas
Cierre caja arqueo, tickets impresos, tarifas franja, historial patente, alertas vencimientos, borrado lógico.
