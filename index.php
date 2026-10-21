<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/app/core/Router.php';
require_once __DIR__ . '/app/core/Controller.php';
require_once __DIR__ . '/app/core/Model.php';
require_once __DIR__ . '/app/core/Database.php';

// Autoload simple (puedes usar Composer después)
spl_autoload_register(function($class) {
    $prefix = 'App\\';
    $base_dir = __DIR__ . '/app/';
    
    $len = strlen($prefix);
    if(strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    
    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    
    if(file_exists($file)) {
        require $file;
    }
});

use App\Core\Router;

$router = new Router();

// Definir rutas
$router->get('/', function() use ($router) {
    header('Location: ' . BASE_URL . '/dashboard');
});

// Dashboard
$router->get('/dashboard', 'DashboardController@index');
$router->get('/api/estadisticas', 'DashboardController@getEstadisticasAPI');

// Movimientos
$router->get('/movimientos/ingreso', 'MovimientoController@ingresoForm');
$router->post('/movimientos/ingreso', 'MovimientoController@registrarIngreso');
$router->get('/movimientos/egreso/{id}', 'MovimientoController@egresoForm');
$router->post('/movimientos/egreso', 'MovimientoController@registrarEgreso');
$router->get('/movimientos/activos', 'MovimientoController@activos');
$router->get('/movimientos/historial', 'MovimientoController@historial');

// Vehículos (flujo: ingreso → vehículo nuevo → alta automática)
$router->get('/vehiculo/crear', 'VehiculoController@crearForm');
$router->post('/vehiculo/crear', 'VehiculoController@crear');
$router->get('/api/v1/vehiculos', 'VehiculoController@buscarJson');

// Alquileres
$router->get('/alquileres/disponibilidad', 'AlquilerController@disponibilidad');
$router->get('/alquileres/contratos', 'AlquilerController@contratos');
$router->post('/alquileres/contrato', 'AlquilerController@crearContrato');
$router->get('/alquileres/pagos-pendientes', 'AlquilerController@pagosPendientes');
$router->post('/alquileres/registrarPago', 'AlquilerController@registrarPago');

// Deudas (pago desde el reporte de deudas)
$router->post('/deudas/pagar', function() {
    $deudaId = (int)($_POST['deuda_id'] ?? 0);
    if($deudaId > 0) {
        (new App\Models\Deuda())->marcarPagada($deudaId);
        $_SESSION['success'] = "Deuda marcada como pagada";
    } else {
        $_SESSION['error'] = "Deuda no encontrada";
    }
    header('Location: ' . BASE_URL . '/reportes/deudas');
    exit;
});

// Recibos
$router->get('/recibos', 'ReciboController@index');
$router->get('/recibos/ver/{id}', 'ReciboController@ver');
$router->get('/recibos/pdf/{id}', 'ReciboController@descargarPDF');
$router->post('/recibos/enviar', 'ReciboController@enviarPorEmail');

// Notificaciones
$router->get('/notificaciones/configuracion', 'NotificacionController@configuracion');
$router->post('/notificaciones/configuracion', 'NotificacionController@guardarConfiguracion');
$router->post('/notificaciones/alerta-tarifa', 'NotificacionController@enviarAlertaTarifa');
$router->post('/notificaciones/enviar-manual', 'NotificacionController@enviarManual');
$router->get('/notificaciones/historial', 'NotificacionController@historial');

// Clientes
$router->get('/clientes', 'ClienteController@listar');
$router->get('/clientes/crear', 'ClienteController@crearForm');
$router->post('/clientes/crear', 'ClienteController@crear');
$router->get('/clientes/editar/{id}', 'ClienteController@editarForm');
$router->post('/clientes/editar/{id}', 'ClienteController@editar');
$router->get('/clientes/ver/{id}', 'ClienteController@ver');
$router->post('/clientes/buscar', 'ClienteController@buscar');

// Reportes
$router->get('/reportes', 'ReporteController@index');
$router->get('/reportes/caja', 'ReporteController@caja');
$router->get('/reportes/deudas', 'ReporteController@deudas');
$router->get('/reportes/ocupacion', 'ReporteController@ocupacion');

// API endpoints
$router->get('/api/v1/disponibilidad', function() {
    $alquiler = new App\Models\Alquiler();
    header('Content-Type: application/json');
    echo json_encode($alquiler->getDisponibilidad());
});

$router->post('/api/v1/verificar-patente', function() {
    $patente = $_POST['patente'] ?? '';
    $vehiculo = new App\Models\Vehiculo();
    header('Content-Type: application/json');
    echo json_encode($vehiculo->verificarConDeuda($patente));
});

// 404
$router->setNotFound(function() {
    http_response_code(404);
    echo "<h1>404 - Página no encontrada</h1>";
});

$router->dispatch();