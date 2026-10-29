# Pendientes

Estos puntos quedan explícitamente sin resolver y no deben avanzarse sin decisión del responsable:

- [ ] **Gastos:** definir e implementar índice único de comprobante (proveedor/tipo/punto de venta/número) en `gastos_compras`.
- [x] **Contratos:** decidir límites del rango antes del módulo 5 → **DECIDIDO (28/10/2026): `'[)'` semiabierto**, implementado en `005_contratos_rango_semiabierto.sql`. `fecha_fin` es el día en que se libera la plaza (exclusivo: esa fecha puede asignarse a otro contrato); un contrato mensual del 01/11 que cubre todo noviembre termina el 01/12; CHECK pasa a `fecha_fin > fecha_inicio`.
- [ ] **Infraestructura local:** revisar/endurecer `pg_hba.conf` (actualmente Postgres.app usa `trust` para conexiones locales).
- [ ] **Gastos:** definir tolerancia de centavos en la validación de totales/IVA (por ejemplo aceptar diferencias de $0,01).
- [x] **Módulo 4 - Tarifa inexistente:** PHP usa tarifa 0 silenciosamente (`$tarifa['tarifa_hora'] ?? 0` en `app/models/Movimiento.php:36`). En TypeScript se lanza error claro `TARIFA_NO_VIGENTE` (422) con mensaje "No hay tarifa vigente para este tipo de vehículo" (`src/lib/movimientos.ts:86-92`). Test en `tests/modulo4.test.ts:383`.
