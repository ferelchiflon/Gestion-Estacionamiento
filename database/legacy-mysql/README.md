# legacy-mysql — migraciones del sistema PHP anterior (MySQL)

Estos archivos pertenecen al sistema PHP viejo (`app/`, base **MySQL**
`gestion_estacionamiento`) y se conservan sólo como referencia histórica:

- `2026-10-21-modulo-contable.sql` — tablas contables (sintaxis MySQL:
  `USE`, `AUTO_INCREMENT`, `INSERT IGNORE`).
- `2026-10-22-bot-asistente.sql` — tabla `bot_conversaciones` (MySQL).

## Por qué están acá y no en `database/migrations/`

Vivían mezclados en `database/migrations/` junto a las migraciones
PostgreSQL, pero **no son aplicables a PostgreSQL**: el runner
(`scripts/migrate.js`) es de PostgreSQL y sólo toma los archivos
`NNN_*.sql` de esa carpeta (los archivos con fecha no matcheaban el patrón
`NNN_*.sql` y se ignoraban silenciosamente).

Se movieron acá para que `database/migrations/` contenga únicamente las
migraciones PostgreSQL (`001`…`NNN`) con checksum registrado en
`schema_migrations`. Mover estos archivos **no altera ningún checksum
aplicado**: los `NNN_*.sql` no se tocaron.

## Nota

El equivalente PostgreSQL de estas tablas ya existe en la migración
`001_initial_schema.sql`: `configuracion_fiscal`, `categorias_gasto`,
`gastos_compras`, `percepciones_iibb`, `saldos_iva` y `bot_conversaciones`.
Estos archivos MySQL quedan sólo para trazabilidad del sistema anterior.