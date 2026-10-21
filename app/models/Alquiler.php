<?php
namespace App\Models;

use App\Core\Model;

class Alquiler extends Model {
    protected $table = 'contratos_alquiler';
    
    public function getDisponibilidad() {
        $sql = "SELECT 
                    p.id as plaza_id,
                    p.numero,
                    p.sector,
                    p.tipo_vehiculo,
                    CASE 
                        WHEN ca.id IS NULL THEN 'disponible'
                        WHEN ca.fecha_fin < CURDATE() THEN 'disponible'
                        ELSE CONCAT('alquilada hasta ', ca.fecha_fin)
                    END as estado,
                    ca.fecha_fin as disponible_desde
                FROM plazas p
                LEFT JOIN contratos_alquiler ca ON p.id = ca.plaza_id 
                    AND ca.estado = 'activo' 
                    AND ca.fecha_fin >= CURDATE()
                ORDER BY p.sector, p.numero";
        return $this->db->query($sql)->fetchAll();
    }
    
    public function crearContrato($data) {
        $data['fecha_inicio'] = date('Y-m-d');
        $data['estado'] = 'activo';
        
        // Calcular fechas según tipo
        if($data['tipo_alquiler_id'] == 2) { // mensual
            $data['fecha_fin'] = date('Y-m-d', strtotime('+1 month'));
            $data['cuota_mensual'] = $data['monto_total'];
        } elseif($data['tipo_alquiler_id'] == 3) { // anual
            $data['fecha_fin'] = date('Y-m-d', strtotime('+1 year'));
            $data['cuota_mensual'] = $data['monto_total'] / 12;
        } else { // diario
            $data['fecha_fin'] = $data['fecha_inicio'];
        }
        
        return $this->insert($data);
    }
    
    public function getVencimientos($dias = 3) {
        $sql = "SELECT c.*, cl.nombre, cl.email, cl.telefono, 
                DATEDIFF(c.fecha_fin, CURDATE()) as dias_restantes
                FROM contratos_alquiler c
                JOIN clientes cl ON c.cliente_id = cl.id
                WHERE c.estado = 'activo' 
                AND DATEDIFF(c.fecha_fin, CURDATE()) <= ?
                AND DATEDIFF(c.fecha_fin, CURDATE()) > 0
                ORDER BY dias_restantes ASC";
        return $this->db->query($sql, [$dias])->fetchAll();
    }
    
    public function registrarPago($contratoId, $periodo, $monto, $reciboId) {
        $sql = "INSERT INTO pagos_alquiler (contrato_id, periodo, monto, fecha_pago, recibo_id, estado) 
                VALUES (?, ?, ?, NOW(), ?, 'pagado')";
        return $this->db->query($sql, [$contratoId, $periodo, $monto, $reciboId]);
    }
    
    public function getPagosPendientes() {
        $sql = "SELECT 
                    ca.id as contrato_id,
                    cl.nombre,
                    cl.email,
                    cl.telefono,
                    ca.cuota_mensual,
                    ca.dia_vencimiento,
                    DATE_FORMAT(NOW(), '%Y-%m-') as periodo_actual
                FROM contratos_alquiler ca
                JOIN clientes cl ON ca.cliente_id = cl.id
                WHERE ca.estado = 'activo' 
                AND ca.tipo_alquiler_id IN (2,3)
                AND NOT EXISTS (
                    SELECT 1 FROM pagos_alquiler pa 
                    WHERE pa.contrato_id = ca.id 
                    AND pa.periodo = DATE_FORMAT(NOW(), '%Y-%m-01')
                )";
        return $this->db->query($sql)->fetchAll();
    }
}