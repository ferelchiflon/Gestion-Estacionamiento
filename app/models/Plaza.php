<?php
namespace App\Models;

use App\Core\Model;

class Plaza extends Model {
    protected $table = 'plazas';
    protected $primaryKey = 'id';
    
    public function getLibres() {
        return $this->where("estado = 'libre'", []);
    }
    
    public function ocupar($plazaId) {
        return $this->update($plazaId, ['estado' => 'ocupada']);
    }
    
    public function liberar($plazaId) {
        return $this->update($plazaId, ['estado' => 'libre']);
    }
    
    public function getResumenPorEstado() {
        $sql = "SELECT estado, COUNT(*) as cantidad FROM {$this->table} GROUP BY estado";
        return $this->db->query($sql)->fetchAll();
    }
}
