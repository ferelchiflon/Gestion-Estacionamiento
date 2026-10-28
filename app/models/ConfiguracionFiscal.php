<?php
namespace App\Models;

use App\Core\Model;

class ConfiguracionFiscal extends Model {
    protected $table = 'configuracion_fiscal';
    protected $primaryKey = 'id';

    /**
     * Devuelve la fila única de configuración (id=1).
     * La crea con valores por defecto si todavía no existe.
     */
    public function obtener() {
        $fila = $this->find(1);
        if(!$fila) {
            $this->db->query("INSERT IGNORE INTO {$this->table} (id) VALUES (1)");
            $fila = $this->find(1);
        }
        return $fila;
    }

    /**
     * Guarda la configuración sobre la fila única.
     * El controlador valida y pasa solo campos permitidos.
     */
    public function guardar(array $data) {
        return $this->update(1, $data);
    }

    /** Alícuota de IVA vigente (0–100) como float. */
    public function alicuotaIva() {
        $c = $this->obtener();
        return (float)($c['alicuota_iva'] ?? 21.00);
    }

    /** Alícuota de IIBB vigente (0–100) como float. */
    public function alicuotaIibb() {
        $c = $this->obtener();
        return (float)($c['alicuota_iibb'] ?? 3.00);
    }
}
