# Pendientes

Estos puntos quedan explícitamente sin resolver y no deben avanzarse sin decisión del responsable:

- [ ] **Gastos:** definir e implementar índice único de comprobante (proveedor/tipo/punto de venta/número) en `gastos_compras`.
- [ ] **Contratos:** decidir límites del rango antes del módulo 5: `'[]'` (actual en 001, mismo día bloqueado) vs `'[)'` (permite inicio el día de finalización del contrato anterior).
- [ ] **Infraestructura local:** revisar/endurecer `pg_hba.conf` (actualmente Postgres.app usa `trust` para conexiones locales).
- [ ] **Gastos:** definir tolerancia de centavos en la validación de totales/IVA (por ejemplo aceptar diferencias de $0,01).
