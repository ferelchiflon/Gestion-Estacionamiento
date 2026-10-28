<?php
namespace App\Models;

use App\Core\Model;

/**
 * Consultas para los reportes contables/impositivos (etapa c: IVA y ARCA).
 * Toda la fecha va con prepared statements.
 */
class ReporteContable extends Model {
    protected $table = 'movimientos';

    // ------------------------------------------------------------------
    // IVA Ventas
    // ------------------------------------------------------------------

    /** Cobros de estacionamiento por día (solo pagados). */
    public function ventasEstacionamiento(string $desde, string $hasta): array {
        $sql = "SELECT DATE(hora_entrada) AS fecha, COUNT(*) AS operaciones, COALESCE(SUM(monto_pagado),0) AS total
                FROM movimientos
                WHERE estado_pago = 'pagado'
                  AND DATE(hora_entrada) BETWEEN ? AND ?
                GROUP BY DATE(hora_entrada)
                ORDER BY fecha";
        return $this->db->query($sql, [$desde, $hasta])->fetchAll();
    }

    /** Cobros de alquileres por día (tabla pagos_alquiler). */
    public function ventasAlquileres(string $desde, string $hasta): array {
        $sql = "SELECT DATE(fecha_pago) AS fecha, COUNT(*) AS operaciones, COALESCE(SUM(monto),0) AS total
                FROM pagos_alquiler
                WHERE DATE(fecha_pago) BETWEEN ? AND ?
                GROUP BY DATE(fecha_pago)
                ORDER BY fecha";
        return $this->db->query($sql, [$desde, $hasta])->fetchAll();
    }

    /**
     * Cobros de deudas por día (estado = 'pagada').
     * Limitación: la tabla no tiene fecha de pago; se usa created_at
     * (fecha de generación de la deuda) como fecha contable.
     */
    public function ventasDeudas(string $desde, string $hasta): array {
        $sql = "SELECT DATE(created_at) AS fecha, COUNT(*) AS operaciones, COALESCE(SUM(monto_con_interes),0) AS total
                FROM deudas
                WHERE estado = 'pagada'
                  AND DATE(created_at) BETWEEN ? AND ?
                GROUP BY DATE(created_at)
                ORDER BY fecha";
        return $this->db->query($sql, [$desde, $hasta])->fetchAll();
    }

    /** Estacionamiento por forma de pago (para ARCA / info del contador). */
    public function cobrosPorFormaPago(string $desde, string $hasta): array {
        $sql = "SELECT COALESCE(forma_pago,'sin dato') AS forma_pago, COUNT(*) AS operaciones, COALESCE(SUM(monto_pagado),0) AS total
                FROM movimientos
                WHERE estado_pago = 'pagado'
                  AND DATE(hora_entrada) BETWEEN ? AND ?
                GROUP BY forma_pago
                ORDER BY total DESC";
    // ------------------------------------------------------------------
    // IIBB: percepciones y retenciones cargadas manualmente
    // ------------------------------------------------------------------

    public function percepcionesIibb(string $periodo): array {
        return $this->db->query(
            "SELECT * FROM percepciones_iibb WHERE periodo = ? ORDER BY id",
            [$periodo]
        )->fetchAll();
    }

    public function totalesPercepcionesIibb(string $periodo) {
        return $this->db->query(
            "SELECT
                COALESCE(SUM(CASE WHEN tipo = 'percepcion' THEN monto END), 0) AS percepciones,
                COALESCE(SUM(CASE WHEN tipo = 'retencion' THEN monto END), 0) AS retenciones
             FROM percepciones_iibb WHERE periodo = ?",
            [$periodo]
        )->fetch();
    }

    public function agregarPercepcionIibb(array $d): void {
        $this->db->query(
            "INSERT INTO percepciones_iibb (periodo, jurisdiccion, tipo, monto, detalle) VALUES (?, ?, ?, ?, ?)",
            [$d['periodo'], $d['jurisdiccion'], $d['tipo'], $d['monto'], $d['detalle']]
        );
    }

    public function eliminarPercepcionIibb(int $id): bool {
        return $this->db->query("DELETE FROM percepciones_iibb WHERE id = ?", [$id])->rowCount() > 0;
    }

    // ------------------------------------------------------------------
    // Balance
    // ------------------------------------------------------------------

    /** Egresos del período agrupados por categoría de gasto. */
    public function egresosPorCategoria(string $desde, string $hasta): array {
        $sql = "SELECT COALESCE(c.nombre, 'Sin categoría') AS categoria,
                       COUNT(*) AS comprobantes,
                       COALESCE(SUM(g.total), 0) AS total
                FROM gastos_compras g
                LEFT JOIN categorias_gasto c ON g.categoria_id = c.id
                WHERE g.fecha BETWEEN ? AND ?
                GROUP BY categoria
                ORDER BY total DESC";
        return $this->db->query($sql, [$desde, $hasta])->fetchAll();
    }

    /** Deudas pendientes a la fecha (estado enum 'pendiente'/'pagada'). */
    public function cuentasPorCobrar() {
        return $this->db->query(
            "SELECT COUNT(*) AS cantidad,
                    COALESCE(SUM(monto_con_interes), 0) AS total,
                    COALESCE(SUM(CASE WHEN fecha_vencimiento < CURDATE() THEN 1 ELSE 0 END), 0) AS vencidas
             FROM deudas WHERE estado = 'pendiente'"
        )->fetch();
    }

    // ------------------------------------------------------------------
    // Reporte mensual y comparativos
    // ------------------------------------------------------------------

    /** Resumen de un período: ingresos por rubro, operaciones y gastos. */
    public function resumenPeriodo(string $desde, string $hasta): array {
        $est = $this->db->query(
            "SELECT COUNT(*) AS ops, COALESCE(SUM(monto_pagado), 0) AS total
             FROM movimientos
             WHERE estado_pago = 'pagado' AND DATE(hora_entrada) BETWEEN ? AND ?",
            [$desde, $hasta]
        )->fetch();
        $alq = $this->db->query(
            "SELECT COUNT(*) AS ops, COALESCE(SUM(monto), 0) AS total
             FROM pagos_alquiler
             WHERE DATE(fecha_pago) BETWEEN ? AND ?",
            [$desde, $hasta]
        )->fetch();
        $deu = $this->db->query(
            "SELECT COUNT(*) AS ops, COALESCE(SUM(monto_con_interes), 0) AS total
             FROM deudas
             WHERE estado = 'pagada' AND DATE(created_at) BETWEEN ? AND ?",
            [$desde, $hasta]
        )->fetch();
        $gas = $this->db->query(
            "SELECT COUNT(*) AS comprobantes, COALESCE(SUM(total), 0) AS total
             FROM gastos_compras
             WHERE fecha BETWEEN ? AND ?",
            [$desde, $hasta]
        )->fetch();

        return [
            'est' => $est, 'alq' => $alq, 'deu' => $deu, 'gas' => $gas,
            'ingresos'    => (float)$est['total'] + (float)$alq['total'] + (float)$deu['total'],
            'operaciones' => (int)$est['ops'] + (int)$alq['ops'] + (int)$deu['ops'],
            'gastos'      => (float)$gas['total'],
            'resultado'   => (float)$est['total'] + (float)$alq['total'] + (float)$deu['total'] - (float)$gas['total'],
        ];
    }

    /** Cantidad total de plazas (para estimar ocupación por rotación). */
    public function totalPlazas(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM plazas")->fetchColumn();
    }
}


    public function getSaldoTecnico(string $periodo): float {
        $fila = $this->db->query(
            "SELECT saldo_tecnico_anterior FROM saldos_iva WHERE periodo = ?",
            [$periodo]
        )->fetch();
        return $fila ? (float)$fila['saldo_tecnico_anterior'] : 0.0;
    }

    public function setSaldoTecnico(string $periodo, float $monto): void {
        $existe = $this->db->query(
            "SELECT id FROM saldos_iva WHERE periodo = ?", [$periodo]
        )->fetch();
        if($existe) {
            $this->db->query(
                "UPDATE saldos_iva SET saldo_tecnico_anterior = ? WHERE periodo = ?",
                [$monto, $periodo]
            );
        } else {
            $this->db->query(
                "INSERT INTO saldos_iva (periodo, saldo_tecnico_anterior) VALUES (?, ?)",
                [$periodo, $monto]
            );
        }
    }

    /** Percepciones/retenciones de IIBB agrupadas por jurisdicción y tipo. */
    public function percepcionesIibb(string $periodo): array {
        $sql = "SELECT jurisdiccion,
                       SUM(CASE WHEN tipo = 'percepcion' THEN monto ELSE 0 END) AS percepciones,
                       SUM(CASE WHEN tipo = 'retencion'  THEN monto ELSE 0 END) AS retenciones
                FROM percepciones_iibb
                WHERE periodo = ?
                GROUP BY jurisdiccion
                ORDER BY jurisdiccion";
        return $this->db->query($sql, [$periodo])->fetchAll();
    }

    /** Alta de una percepción/retención de IIBB (validar monto > 0 y tipo en el controlador). */
    public function addPercepcionIibb(string $periodo, string $jurisdiccion, string $tipo, float $monto, string $detalle = ''): bool {
        $sql = "INSERT INTO percepciones_iibb (periodo, jurisdiccion, tipo, monto, detalle) VALUES (?, ?, ?, ?, ?)";
        return $this->db->query($sql, [$periodo, $jurisdiccion, $tipo, $monto, $detalle]) !== false;
    }

    /** Elimina todas las percepciones cargadas de un período (para recargar). */
    public function clearPercepcionesIibb(string $periodo): int {
        return $this->db->exec("DELETE FROM percepciones_iibb WHERE periodo = " . $this->db->quote($periodo));
    }
}
