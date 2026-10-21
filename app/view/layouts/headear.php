<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Estacionamiento - Sistema de Gestión</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="<?= BASE_URL ?>/assets/css/style.css" rel="stylesheet">
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <!-- Sidebar -->
            <nav class="col-md-2 d-md-block bg-dark sidebar" style="min-height: 100vh;">
                <div class="position-sticky pt-3">
                    <ul class="nav flex-column">
                        <li class="nav-item">
                            <a class="nav-link text-white" href="<?= BASE_URL ?>/dashboard">
                                <i class="fas fa-tachometer-alt"></i> Dashboard
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link text-white" href="<?= BASE_URL ?>/movimientos/ingreso">
                                <i class="fas fa-sign-in-alt"></i> Registrar Ingreso
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link text-white" href="<?= BASE_URL ?>/movimientos/activos">
                                <i class="fas fa-car"></i> Vehículos Activos
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link text-white" href="<?= BASE_URL ?>/alquileres/disponibilidad">
                                <i class="fas fa-parking"></i> Plazas Disponibles
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link text-white" href="<?= BASE_URL ?>/clientes">
                                <i class="fas fa-users"></i> Clientes
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link text-white" href="<?= BASE_URL ?>/alquileres/contratos">
                                <i class="fas fa-file-signature"></i> Contratos
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link text-white" href="<?= BASE_URL ?>/reportes">
                                <i class="fas fa-chart-line"></i> Reportes
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link text-white" href="<?= BASE_URL ?>/notificaciones/configuracion">
                                <i class="fas fa-bell"></i> Notificaciones
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>
            
            <!-- Main content -->
            <main class="col-md-10 ms-sm-auto px-md-4">
                <div class="pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2"><?= $titulo ?? 'Sistema de Gestión' ?></h1>
                </div>
                
                <?php if(isset($_SESSION['success'])): ?>
                    <div class="alert alert-success alert-dismissible fade show" role="alert">
                        <?= $_SESSION['success'] ?>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                    <?php unset($_SESSION['success']); ?>
                <?php endif; ?>
                
                <?php if(isset($_SESSION['error'])): ?>
                    <div class="alert alert-danger alert-dismissible fade show" role="alert">
                        <?= $_SESSION['error'] ?>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                    <?php unset($_SESSION['error']); ?>
                <?php endif; ?>
                
                <?php if(isset($_SESSION['warning'])): ?>
                    <div class="alert alert-warning alert-dismissible fade show" role="alert">
                        <?= $_SESSION['warning'] ?>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                    <?php unset($_SESSION['warning']); ?>
                <?php endif; ?>