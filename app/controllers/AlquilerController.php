<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Alquiler;
use App\Models\Cliente;
use App\Models\Plaza;

class AlquilerController extends Controller {
    
    public function disponibilidad() {
        $alquilerModel = new Alquiler();
        $this->view('alquileres/disponibilidad', [
            'disponibilidad' => $alquilerModel->getDisponibilidad()
        ]);
    }
    
    public function contratos() {
        $alquilerModel = new Alquiler();
        
        $sql = "SELECT ca.*, c.nombre as cliente_nombre, p.numero as plaza_numero, p.sector,
                       ta.nombre as tipo_alquiler
                FROM contratos_alquiler ca
                JOIN clientes c ON ca.cliente_id = c.id
                JOIN plazas p ON ca.plaza_id = p.id
                JOIN tipos_alquiler ta ON ca.tipo_alquiler_id = ta.id
                ORDER BY ca.estado = 'activo' DESC, ca.fecha_fin ASC";
        $contratos = $alquilerModel->db->query($sql)->fetchAll();
        
        $this->view('alquileres/contratos', [
            'contratos' => $contratos,
            'clientes' => (new Cliente())->all('nombre'),
            'plazas' => (new Plaza())->all('numero'),
            'tipos_alquiler' => $alquilerModel->db->query("SELECT * FROM tipos_alquiler")->fetchAll()
        ]);
    }
    
    public function crearContrato() {
        $required = ['plaza_id', 'cliente_id', 'tipo_alquiler_id', 'monto_total'];
        foreach($required as $field) {
            if(empty($_POST[$field])) {
                $_SESSION['error'] = "Faltan datos obligatorios para crear el contrato";
                $this->redirect("/alquileres/contratos");
            }
        }
        
        $alquilerModel = new Alquiler();
        $alquilerModel->crearContrato([
            'plaza_id' => (int)$_POST['plaza_id'],
            'cliente_id' => (int)$_POST['cliente_id'],
            'tipo_alquiler_id' => (int)$_POST['tipo_alquiler_id'],
            'monto_total' => (float)$_POST['monto_total'],
            'dia_vencimiento' => !empty($_POST['dia_vencimiento']) ? (int)$_POST['dia_vencimiento'] : null
        ]);
        
        $_SESSION['success'] = "Contrato creado correctamente";
        $this->redirect("/alquileres/contratos");
    }
    
    public function pagosPendientes() {
        $alquilerModel = new Alquiler();
        $this->view('alquileres/pagos', [
            'pendientes' => $alquilerModel->getPagosPendientes()
        ]);
    }
    
    /**
     * POST /alquileres/registrarPago
     * Registra el pago de un período pendiente.
     */
    public function registrarPago() {
        $contratoId = (int)($_POST['contrato_id'] ?? 0);
        $periodo = trim($_POST['periodo'] ?? '');
        $monto = (float)($_POST['monto'] ?? 0);
        
        if($contratoId <= 0 || $periodo === '') {
            $_SESSION['error'] = "Datos del pago incompletos";
            $this->redirect("/alquileres/pagos-pendientes");
        }
        
        $alquilerModel = new Alquiler();
        $alquilerModel->registrarPago($contratoId, $periodo, $monto);
        
        $_SESSION['success'] = "Pago del período {$periodo} registrado correctamente";
        $this->redirect("/alquileres/pagos-pendientes");
    }
}
