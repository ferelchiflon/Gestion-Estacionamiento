<?php
/**
 * nav.php — Navegación principal (Fase 3 · UI espacial)
 * Reemplaza a la sidebar: píldora flotante de vidrio (.dock/.pill).
 * Arriba en escritorio; en móvil queda fija abajo y muestra solo íconos
 * (CSS), por eso cada enlace lleva aria-label además del texto visible.
 * La sección activa se deduce de la URL actual, sin variables nuevas.
 */
$rutaActual = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

$seccionActiva = 'dashboard';
foreach (['movimientos', 'vehiculo', 'alquileres', 'clientes', 'recibos', 'notificaciones', 'reportes'] as $prefijo) {
    if (strpos($rutaActual, '/' . $prefijo) !== false) {
        // '/vehiculo/...' pertenece a la sección Movimientos (flujo de ingreso)
        $seccionActiva = ($prefijo === 'vehiculo') ? 'movimientos' : $prefijo;
        break;
    }
}

$secciones = [
    'dashboard'     => ['Dashboard',     'bi-speedometer2',   BASE_URL . '/dashboard'],
    'movimientos'   => ['Movimientos',   'bi-arrow-left-right', BASE_URL . '/movimientos/activos'],
    'alquileres'    => ['Alquileres',    'bi-calendar2-check', BASE_URL . '/alquileres/contratos'],
    'clientes'      => ['Clientes',      'bi-people',          BASE_URL . '/clientes'],
    'recibos'       => ['Recibos',       'bi-receipt',         BASE_URL . '/recibos'],
    'notificaciones'=> ['Notificaciones','bi-bell',            BASE_URL . '/notificaciones/historial'],
    'reportes'      => ['Reportes',      'bi-graph-up',        BASE_URL . '/reportes'],
];
?>
<div class="dock">
    <nav class="pill glass" aria-label="Navegación principal">
        <?php foreach ($secciones as $clave => [$etiqueta, $icono, $url]): ?>
        <a href="<?= $url ?>"
           aria-label="<?= $etiqueta ?>"
           <?= $seccionActiva === $clave ? 'aria-current="page"' : '' ?>>
            <i class="bi <?= $icono ?>" aria-hidden="true"></i><span><?= $etiqueta ?></span>
        </a>
        <?php endforeach; ?>
    </nav>
</div>

