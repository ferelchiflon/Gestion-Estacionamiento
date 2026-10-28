<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Movimiento;
use App\Models\Cliente;
use App\Models\Alquiler;

class DashboardController extends Controller {
    
    public function index() {
        $movimientoModel = new Movimiento();
        $clienteModel = new Cliente();
        $alquilerModel = new Alquiler();
        
        $data = [
            'ocupacion' => $movimientoModel->getOcupacionActual(),
            'caja_hoy' => $movimientoModel->getCajaDiaria(),
            'deudores' => count($clienteModel->getWithDebts()),
            'alquileres_activos' => count($alquilerModel->where("estado = 'activo'")),
            'ingresos_mes' => $this->getIngresosDelMes(),
            'movimientos_recientes' => $this->getMovimientosRecientes(),
            'alertas' => $this->getAlertas(),
            'mapa_plazas' => $this->getMapaPlazas()
        ];
        
        $this->view('dashboard/index', $data);
    }
    
    private function getIngresosDelMes() {
        $sql = "SELECT 
                    DAY(hora_salida) as dia,
                    SUM(monto_pagado) as total
                FROM movimientos 
                WHERE MONTH(hora_salida) = MONTH(CURDATE()) 
                AND YEAR(hora_salida) = YEAR(CURDATE())
                AND estado_pago = 'pagado'
                GROUP BY DAY(hora_salida)
                ORDER BY dia";
        return (new Movimiento())->db->query($sql)->fetchAll();
    }
    
    private function getMovimientosRecientes() {
        $sql = "SELECT m.*, v.tipo, c.nombre as cliente_nombre
                FROM movimientos m
                LEFT JOIN vehiculos v ON m.patente = v.patente
                LEFT JOIN clientes c ON v.cliente_id = c.id
                ORDER BY m.hora_entrada DESC
                LIMIT 10";
        return (new Movimiento())->db->query($sql)->fetchAll();
    }

    /**
     * Fase 3 (excepción autorizada): estado real de cada plaza para el mapa
     * del dashboard. Solo lectura: una plaza está ocupada si tiene un
     * movimiento sin hora_salida; si no, vale su estado propio.
     */
    private function getMapaPlazas() {
        $sql = "SELECT p.id, p.numero, p.sector, p.tipo_vehiculo,
                       CASE WHEN m.id IS NOT NULL THEN 'ocupada'
                            ELSE p.estado END as estado,
                       m.patente
                FROM plazas p
                LEFT JOIN movimientos m ON m.plaza_id = p.id AND m.hora_salida IS NULL
                ORDER BY p.sector, p.numero";
        return (new Movimiento())->db->query($sql)->fetchAll();
    }

    private function getAlertas() {
        $alertas = [];
        
        // Alertas de stock de tickets
        $tickets = (new Movimiento())->db->query("SELECT COUNT(*) as disponibles FROM plazas WHERE estado = 'libre'")->fetch();
        if($tickets['disponibles'] < 10) {
            $alertas[] = ['tipo' => 'warning', 'mensaje' => "Solo quedan {$tickets['disponibles']} lugares disponibles"];
        }
        
        // Alertas de deudores
        $deudores = (new Cliente())->getWithDebts();
        if(count($deudores) > 0) {
            $alertas[] = ['tipo' => 'danger', 'mensaje' => "Hay " . count($deudores) . " clientes con deudas pendientes"];
        }
        
        // Alertas de vencimientos
        $vencimientos = (new Alquiler())->getVencimientos(5);
        if(count($vencimientos) > 0) {
            $alertas[] = ['tipo' => 'info', 'mensaje' => count($vencimientos) . " contratos de alquiler vencen en los próximos 5 días"];
        }
        
        return $alertas;
    }
    
    public function getEstadisticasAPI() {
        $movimientoModel = new Movimiento();
        $data = [
            'ocupacion' => $movimientoModel->getOcupacionActual(),
            'ingresos_hoy' => $movimientoModel->getCajaDiaria(),
            'ingresos_semana' => $this->getIngresosPeriodo(7),
            'ingresos_mes' => $this->getIngresosPeriodo(30),
            'top_vehiculos' => $this->getTopVehiculos()
        ];
        $this->json($data);
    }
    
    private function getIngresosPeriodo($dias) {
        $sql = "SELECT SUM(monto_pagado) as total 
                FROM movimientos 
                WHERE hora_salida >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND estado_pago = 'pagado'";
        $result = (new Movimiento())->db->query($sql, [$dias])->fetch();
        return $result['total'] ?? 0;
    }
    
    private function getTopVehiculos() {
        $sql = "SELECT v.tipo, COUNT(*) as cantidad
                FROM movimientos m
                JOIN vehiculos v ON m.patente = v.patente
                WHERE MONTH(m.hora_entrada) = MONTH(CURDATE())
                GROUP BY v.tipo
                ORDER BY cantidad DESC";
        return (new Movimiento())->db->query($sql)->fetchAll();
    }
}