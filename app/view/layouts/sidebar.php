<?php
/**
 * Sidebar — navegación principal (Fase 2)
 * La sección activa se deduce de la URL actual, sin depender de variables nuevas.
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
?>
<aside class="app-sidebar" id="sidebar" aria-label="Navegación principal">
    <div class="sidebar-brand">
        <span class="brand-mark" aria-hidden="true">E</span>
        <span class="brand-name">Estacionamiento</span>
    </div>

    <nav class="sidebar-nav">
        <span class="sidebar-label">Principal</span>
        <a class="sidebar-link <?= $seccionActiva === 'dashboard' ? 'active' : '' ?>" href="<?= BASE_URL ?>/dashboard">
            <i class="bi bi-speedometer2" aria-hidden="true"></i>Dashboard
        </a>

        <span class="sidebar-label">Operación</span>
        <a class="sidebar-link <?= $seccionActiva === 'movimientos' ? 'active' : '' ?>" href="<?= BASE_URL ?>/movimientos/activos">
            <i class="bi bi-arrow-left-right" aria-hidden="true"></i>Movimientos
        </a>
        <a class="sidebar-link <?= $seccionActiva === 'alquileres' ? 'active' : '' ?>" href="<?= BASE_URL ?>/alquileres/contratos">
            <i class="bi bi-calendar2-check" aria-hidden="true"></i>Alquileres
        </a>
        <a class="sidebar-link <?= $seccionActiva === 'clientes' ? 'active' : '' ?>" href="<?= BASE_URL ?>/clientes">
            <i class="bi bi-people" aria-hidden="true"></i>Clientes
        </a>
        <a class="sidebar-link <?= $seccionActiva === 'recibos' ? 'active' : '' ?>" href="<?= BASE_URL ?>/recibos">
            <i class="bi bi-receipt" aria-hidden="true"></i>Recibos
        </a>

        <span class="sidebar-label">Administración</span>
        <a class="sidebar-link <?= $seccionActiva === 'notificaciones' ? 'active' : '' ?>" href="<?= BASE_URL ?>/notificaciones/historial">
            <i class="bi bi-bell" aria-hidden="true"></i>Notificaciones
        </a>
        <a class="sidebar-link <?= $seccionActiva === 'reportes' ? 'active' : '' ?>" href="<?= BASE_URL ?>/reportes">
            <i class="bi bi-graph-up" aria-hidden="true"></i>Reportes
        </a>
    </nav>
</aside>
<div class="sidebar-backdrop" data-sidebar-close aria-hidden="true"></div>
