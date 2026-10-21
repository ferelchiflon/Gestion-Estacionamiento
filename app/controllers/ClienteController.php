<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Cliente;
use App\Models\Vehiculo;
use App\Models\Deuda;

class ClienteController extends Controller {
    
    public function listar() {
        $clienteModel = new Cliente();
        $clientes = $clienteModel->db->query(
            "SELECT c.*, 
                    COALESCE((SELECT SUM(monto_con_interes) FROM deudas d 
                              WHERE d.cliente_id = c.id AND d.estado = 'pendiente'), 0) as deuda_total,
                    (SELECT COUNT(*) FROM vehiculos v WHERE v.cliente_id = c.id) as cantidad_vehiculos
             FROM clientes c 
             ORDER BY c.nombre ASC"
        )->fetchAll();
        
        $this->view('clientes/listar', ['clientes' => $clientes]);
    }
    
    public function crearForm() {
        $this->view('clientes/crear');
    }
    
    public function crear() {
        $errors = $this->validate($_POST, ['nombre' => 'required|min:3']);
        
        if(!empty($errors)) {
            $_SESSION['error'] = "El nombre es obligatorio (mínimo 3 caracteres)";
            $this->redirect("/clientes/crear");
        }
        
        $clienteModel = new Cliente();
        $clienteModel->insert([
            'nombre' => trim($_POST['nombre']),
            'documento' => trim($_POST['documento'] ?? '') ?: null,
            'email' => trim($_POST['email'] ?? '') ?: null,
            'telefono' => trim($_POST['telefono'] ?? '') ?: null,
            'saldo_actual' => (float)($_POST['saldo_actual'] ?? 0)
        ]);
        
        $_SESSION['success'] = "Cliente creado correctamente";
        $this->redirect("/clientes");
    }
    
    public function editarForm($id) {
        $cliente = (new Cliente())->find($id);
        
        if(!$cliente) {
            $_SESSION['error'] = "Cliente no encontrado";
            $this->redirect("/clientes");
        }
        
        $this->view('clientes/editar', ['cliente' => $cliente]);
    }
    
    public function editar($id) {
        $errors = $this->validate($_POST, ['nombre' => 'required|min:3']);
        
        if(!empty($errors)) {
            $_SESSION['error'] = "El nombre es obligatorio (mínimo 3 caracteres)";
            $this->redirect("/clientes/editar/{$id}");
        }
        
        $clienteModel = new Cliente();
        $clienteModel->update($id, [
            'nombre' => trim($_POST['nombre']),
            'documento' => trim($_POST['documento'] ?? '') ?: null,
            'email' => trim($_POST['email'] ?? '') ?: null,
            'telefono' => trim($_POST['telefono'] ?? '') ?: null,
            'saldo_actual' => (float)($_POST['saldo_actual'] ?? 0)
        ]);
        
        $_SESSION['success'] = "Cliente actualizado correctamente";
        $this->redirect("/clientes");
    }
    
    public function ver($id) {
        $clienteModel = new Cliente();
        $cliente = $clienteModel->find($id);
        
        if(!$cliente) {
            $_SESSION['error'] = "Cliente no encontrado";
            $this->redirect("/clientes");
        }
        
        $data = [
            'cliente' => $cliente,
            'vehiculos' => $clienteModel->getVehiculos($id),
            'deudas' => (new Deuda())->getPendientesPorCliente($id),
            'deuda_total' => (new Deuda())->getTotalPendiente($id),
            'notificaciones' => (new \App\Models\Notificacion())->getPorCliente($id)
        ];
        
        $this->view('clientes/ver', $data);
    }
    
    public function buscar() {
        $term = trim($_POST['term'] ?? '');
        $clienteModel = new Cliente();
        
        $clientes = $term !== '' 
            ? $clienteModel->search($term) 
            : $clienteModel->all('nombre');
        
        $this->view('clientes/listar', ['clientes' => $clientes, 'busqueda' => $term]);
    }
}
