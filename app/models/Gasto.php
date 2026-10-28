<?php
namespace App\Models;

use App\Core\Model;

class Gasto extends Model {
    protected $table = 'gastos_compras';

    /** Listado del período con nombre de categoría (prepared). */
    public function listar(string $desde, string $hasta): array {
        $sql = "SELECT g.*, c.nombre AS categoria_nombre
                FROM {$this->table} g
                LEFT JOIN categorias_gasto c ON g.categoria_id = c.id
                WHERE g.fecha BETWEEN ? AND ?
                ORDER BY g.fecha DESC, g.id DESC";
        return $this->db->query($sql, [$desde, $hasta])->fetchAll();
    }

    /** Totales del período para el pie del listado y los reportes. */
    public function totales(string $desde, string $hasta) {
        $sql = "SELECT
                    COALESCE(SUM(neto_gravado), 0)              AS neto_gravado,
                    COALESCE(SUM(iva_21), 0)                    AS iva_21,
                    COALESCE(SUM(iva_105), 0)                   AS iva_105,
                    COALESCE(SUM(iva_27), 0)                    AS iva_27,
                    COALESCE(SUM(iva_21 + iva_105 + iva_27), 0) AS iva,
                    COALESCE(SUM(no_gravado), 0)                AS no_gravado,
                    COALESCE(SUM(percepcion_iva), 0)            AS percepcion_iva,
                    COALESCE(SUM(percepcion_iibb), 0)           AS percepcion_iibb,
                    COALESCE(SUM(total), 0)                     AS total,
                    COUNT(*)                                    AS comprobantes
                FROM {$this->table}
                WHERE fecha BETWEEN ? AND ?";
        return $this->db->query($sql, [$desde, $hasta])->fetch();
    }

    /** Categorías activas para el selector del formulario. */
    public function categorias(): array {
        return $this->db->query(
            "SELECT id, nombre FROM categorias_gasto WHERE activa = 1 ORDER BY nombre"
        )->fetchAll();
    }

    /** Un gasto con el nombre de su categoría (para editar). */
    public function findConCategoria($id) {
        $sql = "SELECT g.*, c.nombre AS categoria_nombre
                FROM {$this->table} g
                LEFT JOIN categorias_gasto c ON g.categoria_id = c.id
                WHERE g.id = ?";
        return $this->db->query($sql, [(int)$id])->fetch();
    }
}
