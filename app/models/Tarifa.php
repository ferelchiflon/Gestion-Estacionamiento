<?php
namespace App\Models;

use App\Core\Model;
use App\Services\EmailService;

class Tarifa extends Model {
    protected $table = 'tarifas';
    protected $primaryKey = 'id';
    
    public function getVigente($tipoVehiculo) {
        $sql = "SELECT * FROM {$this->table} 
                WHERE tipo_vehiculo = ? 
                AND fecha_desde <= CURDATE() 
                AND (fecha_hasta IS NULL OR fecha_hasta >= CURDATE())
                ORDER BY fecha_desde DESC 
                LIMIT 1";
        return $this->db->query($sql, [$tipoVehiculo])->fetch();
    }
    
    /**
     * Registra un cambio de tarifa a partir de una fecha efectiva
     * y notifica a los clientes con vehículos de ese tipo.
     */
    public function notificarCambio($tipoVehiculo, $nuevaTarifa, $fechaEfectiva) {
        // Cerrar la tarifa vigente el día anterior a la fecha efectiva
        $sql = "UPDATE {$this->table} 
                SET fecha_hasta = DATE_SUB(?, INTERVAL 1 DAY) 
                WHERE tipo_vehiculo = ? AND fecha_hasta IS NULL";
        $this->db->query($sql, [$fechaEfectiva, $tipoVehiculo]);
        
        // Insertar la nueva tarifa
        $this->insert([
            'tipo_vehiculo' => $tipoVehiculo,
            'tarifa_hora' => $nuevaTarifa,
            'fecha_desde' => $fechaEfectiva
        ]);
        
        // Notificar a los clientes afectados
        $sql = "SELECT DISTINCT c.* 
                FROM clientes c 
                JOIN vehiculos v ON v.cliente_id = c.id 
                WHERE v.tipo = ?";
        $clientes = $this->db->query($sql, [$tipoVehiculo])->fetchAll();
        
        $notificacionModel = new Notificacion();
        $emailService = new EmailService();
        
        foreach($clientes as $cliente) {
            $mensaje = "Estimado {$cliente['nombre']}: Le informamos que la tarifa para {$tipoVehiculo} "
                     . "pasará a ser $" . number_format((float)$nuevaTarifa, 2, ',', '.') . " por hora "
                     . "a partir del " . date('d/m/Y', strtotime($fechaEfectiva)) . ".";
            
            $emailService->enviar($cliente['email'], "Cambio de tarifa - Estacionamiento", $mensaje);
            $notificacionModel->registrar($cliente['id'], $mensaje, 'tarifa', 'email');
        }
        
        return count($clientes);
    }
}
