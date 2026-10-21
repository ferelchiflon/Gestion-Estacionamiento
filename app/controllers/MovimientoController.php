<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Movimiento;
use App\Models\Plaza;
use App\Models\Vehiculo;
use App\Services\NotificacionService;

class MovimientoController extends Controller {
    
    public function ingresoForm() {
        $plazaModel = new Plaza();
        $plazasLibres = $plazaModel->where("estado = 'libre'");
        $this->view('movimientos/ingreso', ['plazas' => $plazasLibres]);
    }
    
    public function registrarIngreso() {
        $patente = strtoupper($_POST['patente']);
        $plazaId = $_POST['plaza_id'];
        
        // Verificar si el vehículo existe
        $vehiculoModel = new Vehiculo();
        $vehiculo = $vehiculoModel->findByPatente($patente);
        
        if(!$vehiculo) {
            // Redirigir a registro de nuevo vehículo
            $this->redirect("/vehiculo/crear?patente={$patente}&plaza={$plazaId}");
        }
        
        // Verificar deudas
        $deuda = $vehiculoModel->tieneDeuda($vehiculo['cliente_id']);
        if($deuda) {
            $_SESSION['alerta'] = "El cliente tiene una deuda de $" . $deuda['total'] . ". Se registrará ingreso pero quedará como pendiente.";
        }
        
        $movimientoModel = new Movimiento();
        $movimientoId = $movimientoModel->registrarIngreso($patente, $plazaId);
        
        // Actualizar estado de la plaza
        $plazaModel = new Plaza();
        $plazaModel->update($plazaId, ['estado' => 'ocupada']);
        
        $_SESSION['success'] = "Ingreso registrado correctamente";
        $this->redirect("/movimientos/activos");
    }
    
    public function egresoForm($id) {
        $movimientoModel = new Movimiento();
        $movimiento = $movimientoModel->find($id);
        
        if(!$movimiento || $movimiento['hora_salida']) {
            $_SESSION['error'] = "Movimiento no válido";
            $this->redirect("/movimientos/activos");
        }
        
        $this->view('movimientos/egreso', ['movimiento' => $movimiento]);
    }
    
    public function registrarEgreso() {
        $movimientoId = $_POST['movimiento_id'];
        $formaPago = $_POST['forma_pago'];
        
        $movimientoModel = new Movimiento();
        $resultado = $movimientoModel->registrarEgreso($movimientoId, null, $formaPago);
        
        if($resultado['estado'] === 'invalido') {
            $_SESSION['error'] = "Movimiento no válido o ya egresado";
            $this->redirect("/movimientos/activos");
        }
        
        // Liberar plaza
        $movimiento = $movimientoModel->find($movimientoId);
        $plazaModel = new Plaza();
        $plazaModel->update($movimiento['plaza_id'], ['estado' => 'libre']);
        
        // Generar recibo si está pagado
        if($resultado['estado'] == 'pagado') {
            $reciboController = new ReciboController();
            $reciboId = $reciboController->generarPorMovimiento($movimientoId, $formaPago);
            
            $_SESSION['success'] = "Egreso registrado. Monto: $" . $resultado['monto'] . ". Recibo N°: {$reciboId}";
        } else {
            $_SESSION['warning'] = "Egreso registrado con deuda pendiente de $" . $resultado['monto'];
            
            // Enviar notificación
            $notificacionService = new NotificacionService();
            $cliente = $this->getClienteByMovimiento($movimientoId);
            if($cliente) {
                $notificacionService->enviarAlertaDeuda($cliente, $resultado['monto']);
            }
        }
        
        $this->redirect("/movimientos/historial");
    }
    
    public function activos() {
        $sql = "SELECT m.*, v.tipo, v.marca, v.modelo, p.numero as plaza_numero
                FROM movimientos m
                JOIN vehiculos v ON m.patente = v.patente
                JOIN plazas p ON m.plaza_id = p.id
                WHERE m.hora_salida IS NULL
                ORDER BY m.hora_entrada ASC";
        $movimientos = (new Movimiento())->db->query($sql)->fetchAll();
        
        $this->view('movimientos/activos', ['movimientos' => $movimientos]);
    }
    
    public function historial() {
        $filtro = $_GET['filtro'] ?? 'hoy';
        
        switch($filtro) {
            case 'hoy':
                $where = "DATE(m.hora_entrada) = CURDATE()";
                break;
            case 'semana':
                $where = "m.hora_entrada >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
                break;
            default:
                $where = "MONTH(m.hora_entrada) = MONTH(CURDATE())";
        }
        
        $sql = "SELECT m.*, v.tipo, v.marca, c.nombre as cliente_nombre, p.numero as plaza_numero
                FROM movimientos m
                JOIN vehiculos v ON m.patente = v.patente
                LEFT JOIN clientes c ON v.cliente_id = c.id
                JOIN plazas p ON m.plaza_id = p.id
                WHERE {$where}
                ORDER BY m.hora_entrada DESC
                LIMIT 100";
        
        $movimientos = (new Movimiento())->db->query($sql)->fetchAll();
        $this->view('movimientos/historial', ['movimientos' => $movimientos, 'filtro' => $filtro]);
    }
    
    private function getClienteByMovimiento($movimientoId) {
        $sql = "SELECT c.* FROM clientes c
                JOIN vehiculos v ON c.id = v.cliente_id
                JOIN movimientos m ON v.patente = m.patente
                WHERE m.id = ?";
        return (new Movimiento())->db->query($sql, [$movimientoId])->fetch();
    }
}