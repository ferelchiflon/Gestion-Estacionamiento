<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Vehiculo;
use App\Models\Cliente;
use App\Models\Plaza;
use App\Models\Movimiento;

class VehiculoController extends Controller {
    
    /**
     * GET /vehiculo/crear?patente=XX&plaza=N
     * Formulario de alta rápida cuando el vehículo no existe en el ingreso.
     */
    public function crearForm() {
        $this->view('vehiculos/crear', [
            'patente' => strtoupper($_GET['patente'] ?? ''),
            'plazaId' => $_GET['plaza'] ?? '',
            'clientes' => (new Cliente())->all('nombre')
        ]);
    }
    
    /**
     * POST /vehiculo/crear
     * Crea el vehículo (y cliente ocasional si corresponde), registra el
     * ingreso a la plaza indicada y redirige a vehículos activos.
     */
    public function crear() {
        $patente = strtoupper(trim($_POST['patente'] ?? ''));
        $plazaId = (int)($_POST['plaza_id'] ?? 0);
        
        if($patente === '' || $plazaId <= 0) {
            $_SESSION['error'] = "Patente y plaza son obligatorias";
            $this->redirect("/movimientos/ingreso");
        }
        
        $vehiculoModel = new Vehiculo();
        
        if($vehiculoModel->findByPatente($patente)) {
            $_SESSION['error'] = "El vehículo {$patente} ya está registrado";
            $this->redirect("/movimientos/ingreso");
        }
        
        // Cliente: existente o ocasional nuevo
        $clienteId = !empty($_POST['cliente_id']) ? (int)$_POST['cliente_id'] : null;
        
        if(!$clienteId) {
            $clienteModel = new Cliente();
            $clienteId = $clienteModel->insert([
                'nombre' => 'Cliente ' . $patente,
                'saldo_actual' => 0
            ]);
        }
        
        // Alta del vehículo
        $vehiculoModel->insert([
            'patente' => $patente,
            'tipo' => $_POST['tipo'] ?? 'auto',
            'marca' => trim($_POST['marca'] ?? '') ?: null,
            'modelo' => trim($_POST['modelo'] ?? '') ?: null,
            'color' => trim($_POST['color'] ?? '') ?: null,
            'cliente_id' => $clienteId
        ]);
        
        // Registro del ingreso en la plaza elegida
        $movimientoModel = new Movimiento();
        $movimientoModel->registrarIngreso($patente, $plazaId);
        (new Plaza())->ocupar($plazaId);
        
        $_SESSION['success'] = "Vehículo {$patente} registrado e ingreso dado de alta";
        $this->redirect("/movimientos/activos");
    }
    
    /**
     * GET /api/v1/vehiculos?patente=XXX
     * Busca el vehículo para autocompletar el formulario de ingreso.
     */
    public function buscarJson() {
        $patente = $_GET['patente'] ?? '';
        header('Content-Type: application/json');
        echo json_encode((new Vehiculo())->buscarJson($patente));
    }
}
