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
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($tituloPagina) ?> · Estacionamiento</title>

    <!-- Anti-FOUC: aplica el tema guardado (o el del sistema) antes de pintar -->
    <script>
    (function () {
        try {
            var t = localStorage.getItem('theme');
            if (t !== 'dark' && t !== 'light') {
                t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-theme', t);
        } catch (e) {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    })();
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <!-- Font Awesome: TEMPORAL, solo mientras se migran los íconos vista por vista (se retira en Fase 5) -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="<?= BASE_URL ?>/assets/css/theme.css" rel="stylesheet">
</head>
<body>
<div class="app-shell">
    <?php require __DIR__ . '/sidebar.php'; ?>

    <div class="app-main">
        <header class="app-topbar">
            <button type="button" class="btn btn-outline-secondary topbar-menu-btn"
                    data-sidebar-toggle aria-controls="sidebar" aria-expanded="false"
                    aria-label="Abrir menú de navegación">
                <i class="bi bi-list fs-5" aria-hidden="true"></i>
            </button>

            <span class="topbar-date"><?= $fechaHoy ?></span>

            <span class="topbar-spacer"></span>

            <button type="button" class="btn btn-outline-secondary topbar-theme-btn"
                    data-theme-toggle aria-label="Cambiar entre modo claro y oscuro"
                    title="Modo claro / oscuro">
                <i class="bi bi-moon-stars" data-theme-icon aria-hidden="true"></i>
            </button>

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

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="<?= BASE_URL ?>/assets/js/app.js"></script>
</body>
</html>
