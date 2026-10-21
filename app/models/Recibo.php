<?php
namespace App\Models;

use App\Core\Model;

class Recibo extends Model {
    protected $table = 'recibos';
    protected $primaryKey = 'id';
    
    public function getCompleto($reciboId) {
        $sql = "SELECT r.*, 
                       m.patente, m.hora_entrada, m.hora_salida, m.monto_calculado,
                       c.nombre as cliente_nombre, c.documento, c.email,
                       p.numero as plaza_numero
                FROM recibos r
                LEFT JOIN movimientos m ON r.movimiento_id = m.id
                LEFT JOIN plazas p ON m.plaza_id = p.id
                LEFT JOIN vehiculos v ON m.patente = v.patente
                LEFT JOIN clientes c ON v.cliente_id = c.id
                WHERE r.id = ?";
        return $this->db->query($sql, [$reciboId])->fetch();
    }
    
    public function getPorMovimiento($movimientoId) {
        return $this->db->query(
            "SELECT * FROM {$this->table} WHERE movimiento_id = ? ORDER BY id DESC LIMIT 1",
            [$movimientoId]
        )->fetch();
    }
    
    public function listar($limit = 50) {
        $sql = "SELECT r.*, c.nombre as cliente_nombre, m.patente
                FROM recibos r
                LEFT JOIN clientes c ON r.cliente_id = c.id
                LEFT JOIN movimientos m ON r.movimiento_id = m.id
                ORDER BY r.fecha_emision DESC
                LIMIT " . (int)$limit;
        return $this->db->query($sql)->fetchAll();
    }
    
    public function marcarEnviado($reciboId) {
        return $this->update($reciboId, ['enviado_email' => 1]);
    }
}
