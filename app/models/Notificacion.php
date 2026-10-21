<?php
namespace App\Models;

use App\Core\Model;

class Notificacion extends Model {
    protected $table = 'logs_notificaciones';
    protected $primaryKey = 'id';
    
    /**
     * Registra una notificación enviada en el log.
     */
    public function registrar($clienteId, $mensaje, $tipo = 'manual', $canal = 'email', $estado = 'enviado') {
        $destinatario = null;
        
        if($clienteId) {
            $cliente = (new Cliente())->find($clienteId);
            if($cliente) {
                $destinatario = ($canal === 'whatsapp') ? $cliente['telefono'] : $cliente['email'];
            }
        }
        
        return $this->insert([
            'cliente_id' => $clienteId,
            'tipo' => $tipo,
            'canal' => $canal,
            'destinatario' => $destinatario,
            'mensaje' => $mensaje,
            'estado' => $estado
        ]);
    }
    
    public function getPorCliente($clienteId, $limit = 20) {
        $sql = "SELECT * FROM {$this->table} 
                WHERE cliente_id = ? 
                ORDER BY fecha_envio DESC 
                LIMIT " . (int)$limit;
        return $this->db->query($sql, [$clienteId])->fetchAll();
    }
}
