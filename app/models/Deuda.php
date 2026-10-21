<?php
namespace App\Models;

use App\Core\Model;

class Deuda extends Model {
    protected $table = 'deudas';
    protected $primaryKey = 'id';
    
    public function getPendientesPorCliente($clienteId) {
        $sql = "SELECT * FROM {$this->table} 
                WHERE cliente_id = ? AND estado = 'pendiente' 
                ORDER BY created_at DESC";
        return $this->db->query($sql, [$clienteId])->fetchAll();
    }
    
    public function getTotalPendiente($clienteId) {
        $sql = "SELECT COALESCE(SUM(monto_con_interes), 0) as total 
                FROM {$this->table} 
                WHERE cliente_id = ? AND estado = 'pendiente'";
        $result = $this->db->query($sql, [$clienteId])->fetch();
        return (float)($result['total'] ?? 0);
    }
    
    public function marcarPagada($deudaId) {
        return $this->update($deudaId, ['estado' => 'pagada']);
    }
    
    public function getVencidas() {
        $sql = "SELECT d.*, c.nombre as cliente_nombre, c.email, c.telefono 
                FROM {$this->table} d 
                JOIN clientes c ON d.cliente_id = c.id 
                WHERE d.estado = 'pendiente' 
                AND d.fecha_vencimiento < CURDATE() 
                ORDER BY d.fecha_vencimiento ASC";
        return $this->db->query($sql)->fetchAll();
    }
}
