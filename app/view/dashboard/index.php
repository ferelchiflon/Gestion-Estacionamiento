<?php $titulo = 'Dashboard'; ?>
<?php
// Cálculos de presentación (sin lógica de negocio; datos ya provistos).
$totalPlazas  = (int)($ocupacion['total'] ?? 0);
$ocupadas     = (int)($ocupacion['ocupadas'] ?? 0);
$libres       = (int)($ocupacion['libres'] ?? 0);
$pctOcupacion = $totalPlazas > 0 ? (int)round($ocupadas / $totalPlazas * 100) : 0;
// Anillo SVG r=33 → circunferencia 207.3; el offset muestra el avance.
$ringOffset   = number_format(207.3 * (1 - ($totalPlazas > 0 ? $ocupadas / $totalPlazas : 0)), 1, '.', '');
$cajaTotalHoy = (float)($caja_hoy['efectivo'] ?? 0) + (float)($caja_hoy['tarjeta'] ?? 0);
?>

<div class="head">
    <div>
        <h1>Panel</h1>
        <p>Resumen del estacionamiento</p>
    </div>
    <a href="<?= BASE_URL ?>/movimientos/ingreso" class="btn btn-primary">
        <i class="bi bi-plus-lg" aria-hidden="true"></i>Registrar ingreso
    </a>
</div>

<!-- Indicadores: tres tarjetas de vidrio; la primera con anillo de ocupación -->
<section class="stats" aria-label="Indicadores del día">
    <div class="stat glass tilt">
        <div>
            <small>Plazas libres</small>
            <strong><span><?= $libres ?></span> <span class="sub">/ <?= $totalPlazas ?></span></strong>
            <em><?= $pctOcupacion ?>% de ocupación</em>
        </div>
        <svg class="ring" viewBox="0 0 80 80" role="img" aria-label="Ocupación actual: <?= $pctOcupacion ?>%">
            <circle class="bg" cx="40" cy="40" r="33"/>
            <circle class="fg" cx="40" cy="40" r="33" stroke-dasharray="207.3" stroke-dashoffset="<?= $ringOffset ?>"/>
        </svg>
    </div>
    <div class="stat glass tilt">
        <div>
            <small>Caja de hoy</small>
            <strong>$<?= number_format($cajaTotalHoy, 2) ?></strong>
            <em>Efectivo $<?= number_format($caja_hoy['efectivo'] ?? 0, 2) ?> · Tarjeta $<?= number_format($caja_hoy['tarjeta'] ?? 0, 2) ?></em>
        </div>
    </div>
    <div class="stat glass tilt">
        <div>
            <small>Alquileres activos</small>
            <strong><?= (int)$alquileres_activos ?></strong>
            <em>Contratos vigentes</em>
        </div>
    </div>
</section>

<!-- Alertas del sistema -->
<?php if(!empty($alertas)): ?>
    <?php foreach($alertas as $alerta): ?>
        <div class="alert alert-<?= $alerta['tipo'] ?> alert-dismissible fade show" role="alert">
            <i class="fas fa-bell me-2" aria-hidden="true"></i><?= $alerta['mensaje'] ?>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        </div>
    <?php endforeach; ?>
<?php endif; ?>
<div class="cols">
    <!-- Mapa de plazas: estado real desde la tabla plazas + movimientos abiertos -->
    <section class="panel glass tilt" aria-labelledby="tPlazas">
        <div class="ph">
            <h2 id="tPlazas">Mapa de plazas</h2>
            <div class="legend">
                <span style="--c:var(--color-free)">Libre</span>
                <span style="--c:var(--color-busy)">Ocupada</span>
                <span style="--c:rgba(255,255,255,.58)">Mantenimiento</span>
            </div>
        </div>
        <?php if (!empty($mapa_plazas)): ?>
        <div class="plazas">
            <?php foreach ($mapa_plazas as $plaza): ?>
                <?php
                $estadoPlaza   = $plaza['estado'];
                $clasePlaza    = $estadoPlaza === 'ocupada' ? ' busy' : ($estadoPlaza === 'mantenimiento' ? ' mant' : '');
                $etiquetaPlaza = $estadoPlaza === 'ocupada'
                    ? ($plaza['patente'] ?? 'ocupada')
                    : ($estadoPlaza === 'mantenimiento' ? 'mant.' : '');
                ?>
                <div class="plaza<?= $clasePlaza ?>" title="Plaza <?= htmlspecialchars($plaza['numero']) ?> · Sector <?= htmlspecialchars($plaza['sector']) ?> · <?= ucfirst(htmlspecialchars($estadoPlaza)) ?>">
                    <b><?= htmlspecialchars($plaza['numero']) ?></b>
                    <span><?= htmlspecialchars((string)$etiquetaPlaza) ?></span>
                </div>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
        <div class="empty-state">
            <div class="empty-icon"><i class="bi bi-p-square" aria-hidden="true"></i></div>
            <h5>Sin plazas configuradas</h5>
            <p>Carga plazas en la base de datos para ver el mapa.</p>
        </div>
        <?php endif; ?>
        <p class="hint">Ocupada = movimiento sin hora de salida. El resto refleja el estado propio de cada plaza.</p>
    </section>

    <!-- Nuevo ingreso: acceso directo al formulario existente (sin duplicar lógica) -->
    <section class="panel glass" aria-labelledby="tIngreso">
        <div class="ph"><h2 id="tIngreso">Nuevo ingreso</h2></div>
        <p class="text-muted">Registra la entrada de un vehículo ocasional o de alquiler. El sistema valida la patente, asigna la plaza y calcula la tarifa.</p>
        <a href="<?= BASE_URL ?>/movimientos/ingreso" class="btn btn-primary w-100" style="min-height:50px">
            <i class="bi bi-box-arrow-in-right" aria-hidden="true"></i>Ir al formulario de ingreso
        </a>
        <p class="hint">El egreso y los vehículos dentro se gestionan desde Movimientos.</p>
    </section>
</div>

<!-- Últimos movimientos -->
<section class="panel glass-strong" aria-labelledby="tMovs">
    <div class="ph">
        <h2 id="tMovs">Últimos movimientos</h2>
        <a href="<?= BASE_URL ?>/movimientos/historial" class="btn btn-sm">Ver historial</a>
    </div>
    <?php if (!empty($movimientos_recientes)): ?>
    <div class="table-responsive">
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Patente</th>
                    <th>Cliente</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th class="text-end">Monto</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach($movimientos_recientes as $mov): ?>
                <tr>
                    <td class="font-mono"><?= htmlspecialchars($mov['patente']) ?></td>
                    <td><?= htmlspecialchars($mov['cliente_nombre'] ?? 'Ocasional') ?></td>
                    <td><?= date('H:i', strtotime($mov['hora_entrada'])) ?></td>
                    <td><?= $mov['hora_salida'] ? date('H:i', strtotime($mov['hora_salida'])) : '—' ?></td>
                    <td class="text-end font-mono">$<?= number_format($mov['monto_pagado'] ?? 0, 2) ?></td>
                    <td>
                        <?php if(!$mov['hora_salida']): ?>
                            <span class="badge bg-warning">Activo</span>
                        <?php elseif($mov['estado_pago'] == 'pagado'): ?>
                            <span class="badge bg-success">Pagado</span>
                        <?php else: ?>
                            <span class="badge bg-danger">Deuda</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php else: ?>
    <div class="empty-state">
        <div class="empty-icon"><i class="bi bi-inbox" aria-hidden="true"></i></div>
        <h5>Sin movimientos aún</h5>
        <p>Los ingresos y egresos recientes aparecerán acá.</p>
    </div>
    <?php endif; ?>
</section>
