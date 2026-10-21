<?php
namespace App\Models;

use App\Core\Model;

class Vehiculo extends Model {
    protected $table = 'vehiculos';
    protected $primaryKey = 'id';
    
    public function findByPatente($patente) {
        $sql = "SELECT * FROM {$this->table} WHERE patente = ?";
        return $this->db->query($sql, [strtoupper($patente)])->fetch();
    }
    
    public function tieneDeuda($clienteId) {
        if(!$clienteId) {
            return null;
        }
        $sql = "SELECT COALESCE(SUM(monto_con_interes), 0) as total 
                FROM deudas 
                WHERE cliente_id = ? AND estado = 'pendiente'";
        $result = $this->db->query($sql, [$clienteId])->fetch();
        
        return $result['total'] > 0 ? ['total' => $result['total']] : null;
    }
    
    // API: POST /api/v1/verificar-patente
    public function verificarConDeuda($patente) {
        $vehiculo = $this->findByPatente($patente);
        
        if(!$vehiculo) {
            return ['exists' => false, 'tiene_deuda' => false, 'monto_deuda' => 0];
        }
        
        $deuda = $this->tieneDeuda($vehiculo['cliente_id']);
        
        return [
            'exists' => true,
            'vehiculo' => $vehiculo,
            'tiene_deuda' => (bool)$deuda,
            'monto_deuda' => $deuda['total'] ?? 0
        ];
    }
    
    // API: GET /api/v1/vehiculos?patente=XXX (usado por la vista de ingreso)
    public function buscarJson($patente) {
        $vehiculo = $this->findByPatente($patente);
        
        if(!$vehiculo) {
            return ['exists' => false];
        }
        
        $cliente = null;
        $deuda = null;
        if($vehiculo['cliente_id']) {
            $cliente = (new Cliente())->find($vehiculo['cliente_id']);
            $deuda = $this->tieneDeuda($vehiculo['cliente_id']);
        }
        
        return [
            'exists' => true,
            'cliente_nombre' => $cliente['nombre'] ?? 'Ocasional',
            'marca' => $vehiculo['marca'],
            'modelo' => $vehiculo['modelo'],
            'tipo' => $vehiculo['tipo'],
            'tiene_deuda' => (bool)$deuda,
            'monto_deuda' => $deuda['total'] ?? 0
        ];
    }
}
