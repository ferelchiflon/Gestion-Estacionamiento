<?php
namespace App\Models;

use App\Core\Model;

/**
 * Registro de conversaciones del asistente (bot).
 * Sirve para el panel /bot/admin: preguntas sin respuesta, más frecuentes
 * y feedback "¿Te sirvió?". Solo inserta/actualiza su propia tabla.
 */
class BotConversacion extends Model
{
    protected $table = 'bot_conversaciones';

    /** Inserta la conversación y devuelve el id generado. */
    public function registrar(array $data): int {
        return (int)$this->insert($data);
    }

    /** Marca el feedback "¿Te sirvió?" ('si' | 'no'). */
    public function marcarUtil(int $id, string $util): bool {
        if(!in_array($util, ['si', 'no'], true)) {
            return false;
        }
        try {
            $this->update($id, ['util' => $util]);
            return true;
        } catch(\Throwable $e) {
            return false;
        }
    }

    /** Preguntas sin respuesta agrupadas por frecuencia (para saber qué agregar a la KB). */
    public function sinRespuestaFrecuentes(int $limite = 25): array {
        return $this->db->query(
            "SELECT pregunta, COUNT(*) AS veces, MAX(fecha) AS ultima
             FROM {$this->table}
             WHERE sin_respuesta = 1
             GROUP BY pregunta
             ORDER BY veces DESC, ultima DESC
             LIMIT " . (int)$limite
        )->fetchAll();
    }

    /** Últimas preguntas sin respuesta (con pantalla y fecha). */
    public function sinRespuesta(int $limite = 50): array {
        return $this->db->query(
            "SELECT id, pregunta, pantalla, fecha
             FROM {$this->table}
             WHERE sin_respuesta = 1
             ORDER BY fecha DESC
             LIMIT " . (int)$limite
        )->fetchAll();
    }

    /** Últimas respuestas marcadas como "no me sirvió". */
    public function noUtiles(int $limite = 50): array {
        return $this->db->query(
            "SELECT id, pregunta, entrada_id, pantalla, fecha
             FROM {$this->table}
             WHERE util = 'no'
             ORDER BY fecha DESC
             LIMIT " . (int)$limite
        )->fetchAll();
    }

    /** Temas de la KB con más feedback positivo. */
    public function utilesPorTema(int $limite = 15): array {
        return $this->db->query(
            "SELECT entrada_id, COUNT(*) AS veces
             FROM {$this->table}
             WHERE util = 'si' AND entrada_id IS NOT NULL
             GROUP BY entrada_id
             ORDER BY veces DESC
             LIMIT " . (int)$limite
        )->fetchAll();
    }

    /** Métricas generales para el panel admin. */
    public function stats(): array {
        $row = $this->db->query(
            "SELECT COUNT(*) AS total,
                    COALESCE(SUM(fecha >= CURDATE()), 0) AS hoy,
                    COALESCE(SUM(sin_respuesta = 1), 0) AS sin_respuesta,
                    COALESCE(SUM(util = 'si'), 0) AS utiles,
                    COALESCE(SUM(util = 'no'), 0) AS no_utiles
             FROM {$this->table}"
        )->fetch();

        return $row ?: ['total' => 0, 'hoy' => 0, 'sin_respuesta' => 0, 'utiles' => 0, 'no_utiles' => 0];
    }
}
