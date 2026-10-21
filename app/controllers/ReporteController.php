<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Movimiento;
use App\Models\Deuda;
use App\Models\Alquiler;
use App\Models\Plaza;

class ReporteController extends Controller {
    
    public function index() {
        $db = (new Movimiento())->db;
        
        $data = [
            'ingresos_mes' => $db->query(
                "SELECT COALESCE(SUM(monto_pagado), 0) as total FROM movimientos 
                 WHERE estado_pago = 'pagado' 
                 AND YEAR(hora_salida) = YEAR(CURDATE()) 
                 AND MONTH(hora_salida) = MONTH(CURDATE())"
            )->fetch()['total'],
            'operaciones_mes' => $db->query(
                "SELECT COUNT(*) as total FROM movimientos 
                 WHERE hora_salida IS NOT NULL
                 AND YEAR(hora_entrada) = YEAR(CURDATE()) 
                 AND MONTH(hora_entrada) = MONTH(CURDATE())"
            )->fetch()['total'],
            'deuda_total' => $db->query(
                "SELECT COALESCE(SUM(monto_con_interes), 0) as total FROM deudas WHERE estado = 'pendiente'"
            )->fetch()['total'],
            'contratos_activos' => $db->query(
                "SELECT COUNT(*) as total FROM contratos_alquiler WHERE estado = 'activo'"
            )->fetch()['total'],
            'ocupacion' => (new Movimiento())->getOcupacionActual()
        ];
        
        $this->view('reportes/index', $data);
    }
    
    public function caja() {
        $sql = "SELECT DATE(hora_salida) as fecha,
                       SUM(monto_pagado) as total,
                       SUM(CASE WHEN forma_pago = 'efectivo' THEN monto_pagado ELSE 0 END) as efectivo,
                       SUM(CASE WHEN forma_pago = 'tarjeta' THEN monto_pagado ELSE 0 END) as tarjeta,
                       COUNT(*) as operaciones
                FROM movimientos
                WHERE estado_pago = 'pagado'
                AND YEAR(hora_salida) = YEAR(CURDATE())
                AND MONTH(hora_salida) = MONTH(CURDATE())
                GROUP BY DATE(hora_salida)
                ORDER BY fecha DESC";
        
        $movimientos = (new Movimiento())->db->query($sql)->fetchAll();
        $this->view('reportes/caja', ['dias' => $movimientos]);
    }
    
    public function deudas() {
        $deudaModel = new Deuda();
        $sql = "SELECT d.*, c.nombre as cliente_nombre, c.documento, c.email, c.telefono
                FROM deudas d
                JOIN clientes c ON d.cliente_id = c.id
                WHERE d.estado = 'pendiente'
                ORDER BY d.fecha_vencimiento ASC";
        
        $this->view('reportes/deudas', [
            'deudas' => $deudaModel->db->query($sql)->fetchAll(),
            'total' => $deudaModel->db->query(
                "SELECT COALESCE(SUM(monto_con_interes), 0) as total FROM deudas WHERE estado = 'pendiente'"
            )->fetch()['total']
        ]);
    }
    
    public function ocupacion() {
        $db = (new Plaza())->db;
        
        $this->view('reportes/ocupacion', [
            'por_estado' => (new Plaza())->getResumenPorEstado(),
            'por_sector' => $db->query(
                "SELECT sector, COUNT(*) as total,
                        SUM(CASE WHEN estado = 'ocupada' THEN 1 ELSE 0 END) as ocupadas
                 FROM plazas GROUP BY sector ORDER BY sector"
            )->fetchAll(),
            'alquiladas' => $db->query(
                "SELECT p.numero, p.sector, c.nombre as cliente_nombre, ca.fecha_fin
                 FROM contratos_alquiler ca
                 JOIN plazas p ON ca.plaza_id = p.id
                 JOIN clientes c ON ca.cliente_id = c.id
                 WHERE ca.estado = 'activo'
                 ORDER BY p.sector, p.numero"
            )->fetchAll()
        ]);
    }
}
