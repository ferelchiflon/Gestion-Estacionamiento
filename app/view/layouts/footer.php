<?php
/**
 * Layout — Parte 2 (Fase 2)
 * Ensambla el documento completo: aquí ya están disponibles $titulo (definida
 * por cada vista) y $contenido (la vista capturada por header.php).
 */
$contenido    = ob_get_clean();
$tituloPagina = (isset($titulo) && trim((string)$titulo) !== '') ? trim((string)$titulo) : 'Panel';

// Mensajes flash (éxito/error/aviso) → toasts; se consumen una sola vez.
$iconosFlash = [
    'success' => ['bi-check-circle-fill', 'text-success'],
    'error'   => ['bi-x-circle-fill', 'text-danger'],
    'warning' => ['bi-exclamation-triangle-fill', 'text-warning'],
];
$mensajesFlash = [];
foreach ($iconosFlash as $clave => $estilo) {
    if (!empty($_SESSION[$clave])) {
        $mensajesFlash[] = ['icono' => $estilo[0], 'color' => $estilo[1], 'texto' => (string)$_SESSION[$clave]];
        unset($_SESSION[$clave]);
    }
}

// Fecha local en español, sin depender del locale del servidor.
$dias  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
$meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
$fechaHoy = $dias[(int)date('w')] . ', ' . date('j') . ' de ' . $meses[(int)date('n') - 1] . ' de ' . date('Y');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title><?= htmlspecialchars($tituloPagina) ?> · Estacionamiento</title>
    <meta name="color-scheme" content="dark">

    <!-- Fase 3 · UI espacial: tema ÚNICO oscuro, sin toggle ni anti-FOUC -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <!-- Font Awesome: TEMPORAL, solo mientras se migran los íconos vista por vista (se retira en Fase 5) -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="<?= BASE_URL ?>/assets/css/theme.css" rel="stylesheet">
</head>
<body>
<div class="sky" aria-hidden="true"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div></div>
<div class="app-shell">
    <?php require __DIR__ . '/nav.php'; ?>

    <div class="app-main">
        <header class="app-topbar">
            <span class="topbar-date"><?= $fechaHoy ?></span>

            <span class="topbar-spacer"></span>

            <a href="<?= BASE_URL ?>/movimientos/ingreso" class="btn btn-primary btn-sm topbar-cta">
                <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Nuevo ingreso
            </a>
        </header>

        <main class="app-content">
            <?= $contenido ?>
        </main>

        <footer class="app-footer">
            <span>© <?= date('Y') ?> Estacionamiento · Panel de gestión</span>
        </footer>
    </div>
</div>

<?php if (!empty($mensajesFlash)): ?>
<div class="toast-stack" aria-live="polite">
    <?php foreach ($mensajesFlash as $mensaje): ?>
    <div class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="4500">
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi <?= $mensaje['icono'] ?> <?= $mensaje['color'] ?> me-2" aria-hidden="true"></i>
                <?= htmlspecialchars($mensaje['texto']) ?>
            </div>
            <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
        </div>
    </div>
    <?php endforeach; ?>
</div>
<?php endif; ?>

<?php require __DIR__ . '/../bot/widget.php'; ?>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="<?= BASE_URL ?>/assets/js/app.js"></script>
</body>
</html>
