<?php
namespace App\Models;

use App\Core\Model;

class Movimiento extends Model {
    protected $table = 'movimientos';
    
    public function registrarIngreso($patente, $plazaId) {
        $data = [
            'patente' => $patente,
            'plaza_id' => $plazaId,
            'hora_entrada' => date('Y-m-d H:i:s'),
            'estado_pago' => 'pendiente'
        ];
        return $this->insert($data);
    }
    
    public function registrarEgreso($movimientoId, $horaSalida = null, $formaPago = 'efectivo') {
        $horaSalida = $horaSalida ?: date('Y-m-d H:i:s');
        $movimiento = $this->find($movimientoId);
        
        // Guarda: movimiento inexistente o ya cerrado
        if(!$movimiento || $movimiento['hora_salida']) {
            return ['monto' => 0, 'estado' => 'invalido', 'horas' => 0];
        }
        
        // Calcular horas (mínimo 1 hora según política de cobro)
        $entrada = new \DateTime($movimiento['hora_entrada']);
        $salida = new \DateTime($horaSalida);
        $interval = $entrada->diff($salida);
        $horas = max(1, (int)ceil(($interval->days * 24) + $interval->h + ($interval->i / 60)));
        
        // Obtener tarifa vigente
        $vehiculo = $this->db->query("SELECT tipo FROM vehiculos WHERE patente = ?", [$movimiento['patente']])->fetch();
        $tarifa = $this->db->query("SELECT tarifa_hora FROM tarifas WHERE tipo_vehiculo = ? AND fecha_desde <= CURDATE() AND (fecha_hasta IS NULL OR fecha_hasta >= CURDATE()) ORDER BY fecha_desde DESC LIMIT 1", [$vehiculo['tipo'] ?? 'auto'])->fetch();
        
        $monto = $horas * (float)($tarifa['tarifa_hora'] ?? 0);
        
        $this->db->beginTransaction();
        
        // Si paga con saldo prepagо, verificar y descontar
        $estado = 'pagado';
        $cliente = $this->db->query("SELECT c.id, c.saldo_actual FROM clientes c JOIN vehiculos v ON c.id = v.cliente_id WHERE v.patente = ?", [$movimiento['patente']])->fetch();
        
        if($formaPago === 'saldo_prepago') {
            if($cliente && $cliente['saldo_actual'] >= $monto) {
                $nuevoSaldo = $cliente['saldo_actual'] - $monto;
                $this->db->query("UPDATE clientes SET saldo_actual = ? WHERE id = ?", [$nuevoSaldo, $cliente['id']]);
            } else {
                $estado = 'deuda';
            }
        }
        
        // Registrar deuda solo si hay cliente asociado
        if($estado === 'deuda' && $cliente) {
            $this->db->query("INSERT INTO deudas (cliente_id, movimiento_id, monto_original, monto_con_interes, fecha_vencimiento, estado) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), 'pendiente')", 
                [$cliente['id'], $movimientoId, $monto, $monto]);
        }
        
        // Actualizar movimiento
        $sql = "UPDATE movimientos SET hora_salida = ?, monto_calculado = ?, monto_pagado = ?, estado_pago = ?, forma_pago = ? WHERE id = ?";
        $this->db->query($sql, [$horaSalida, $monto, $estado === 'pagado' ? $monto : 0, $estado, $formaPago, $movimientoId]);
        
        $this->db->commit();
        
        return ['monto' => $monto, 'estado' => $estado, 'horas' => $horas];
    }
    
    public function getCajaDiaria($fecha = null) {
        $fecha = $fecha ?: date('Y-m-d');
        $sql = "SELECT 
                    SUM(CASE WHEN forma_pago = 'efectivo' THEN monto_pagado ELSE 0 END) as efectivo,
                    SUM(CASE WHEN forma_pago = 'tarjeta' THEN monto_pagado ELSE 0 END) as tarjeta,
                    SUM(CASE WHEN forma_pago = 'saldo_prepago' THEN monto_pagado ELSE 0 END) as saldo,
                    COUNT(*) as total_operaciones
                FROM movimientos 
                WHERE DATE(hora_salida) = ? AND estado_pago = 'pagado'";
        return $this->db->query($sql, [$fecha])->fetch();
    }
    
    public function getOcupacionActual() {
        $sql = "SELECT 
                    COUNT(*) as ocupadas,
                    (SELECT COUNT(*) FROM plazas WHERE estado = 'libre') as libres,
                    (SELECT COUNT(*) FROM plazas) as total
                FROM movimientos 
                WHERE hora_salida IS NULL";
        return $this->db->query($sql)->fetch();
    }
}