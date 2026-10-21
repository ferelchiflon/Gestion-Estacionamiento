<?php
namespace App\Models;

use App\Core\Model;

class Cliente extends Model {
    protected $table = 'clientes';
    protected $primaryKey = 'id';
    
    public function getWithDebts() {
        $sql = "SELECT c.*, 
                COALESCE(SUM(d.monto_con_interes), 0) as deuda_total,
                COUNT(CASE WHEN d.estado = 'pendiente' THEN 1 END) as deudas_pendientes
                FROM clientes c
                LEFT JOIN deudas d ON c.id = d.cliente_id AND d.estado = 'pendiente'
                GROUP BY c.id
                HAVING deuda_total > 0";
        return $this->db->query($sql)->fetchAll();
    }
    
    public function search($term) {
        $sql = "SELECT * FROM clientes 
                WHERE nombre LIKE ? OR documento LIKE ? OR email LIKE ?
                LIMIT 20";
        $term = "%{$term}%";
        return $this->db->query($sql, [$term, $term, $term])->fetchAll();
    }
    
    public function getVehiculos($clienteId) {
        $sql = "SELECT * FROM vehiculos WHERE cliente_id = ?";
        return $this->db->query($sql, [$clienteId])->fetchAll();
    }
    
    public function updateSaldo($clienteId, $monto) {
        $sql = "UPDATE clientes SET saldo_actual = saldo_actual + ? WHERE id = ?";
        return $this->db->query($sql, [$monto, $clienteId]);
    }
}