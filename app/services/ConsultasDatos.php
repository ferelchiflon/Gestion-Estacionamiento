<?php
namespace App\Services;

use App\Models\Alquiler;
use App\Models\Deuda;
use App\Models\Movimiento;
use App\Models\Plaza;

/**
 * ============================================================================
 * Consultas de DATOS del asistente — SOLO LECTURA
 * ============================================================================
 * - Lista blanca CERRADA de intenciones: si la pregunta no matchea una de
 *   estas intenciones, NO se consulta nada (se cae al motor de conocimiento).
 * - No hay SQL armado con texto del usuario: todo pasa por métodos existentes
 *   de los modelos (PDO + prepared statements internos).
 * - NUNCA modifica datos: si el usuario pide cobrar/crear/borrar, el bot
 *   responde con el paso a paso y el link (eso lo hace MotorLocal).
 * - Nunca muestra datos personales (documento, email, teléfono).
 * - Formato: números 1.234,56 y fechas dd/mm/aaaa.
 * ============================================================================
 */
class ConsultasDatos
{
    /** Umbral mínimo de coincidencia para ejecutar una intención de datos. */
    private const UMBRAL = 0.34;

    /**
     * Intenciones soportadas. TODO en forma CANÓNICA (token final del
     * pipeline: sin tildes → sinónimo → stem), porque el mensaje del
     * usuario se normaliza con MotorLocal::normalizarTokens().
     * Regla: una frase canónica = sus tokens unidos con espacios.
     */
    private const INTENCIONES = [
        'ocupacion' => [
            'tokens' => ['ocupad', 'libr', 'plaz', 'manten', 'dentro', 'estado'],
            'frases' => ['libr', 'plaz libr', 'estado plaz', 'ocupad', 'manten'],
            'roles'  => ['*'],
        ],
        'ingresos_mes' => [
            'tokens' => ['ingr', 'recaud', 'factur', 'caja', 'ganan', 'cobr'],
            'frases' => ['ingr mes', 'recaud', 'factur', 'caja mes', 'ganan'],
            'roles'  => ['*'],
        ],
        'operaciones_mes' => [
            'tokens' => ['oper', 'auto', 'mov', 'entrad', 'salid'],
            'frases' => ['oper mes', 'auto', 'mov', 'oper'],
            'roles'  => ['*'],
        ],
        'deuda_total' => [
            'tokens' => ['deud', 'pendiente'],
            'frases' => ['deud total', 'deud pendiente', 'total deud', 'deud'],
            'roles'  => ['*'],
        ],
        'contratos_por_vencer' => [
            'tokens' => ['venc'],
            'frases' => ['contrat venc', 'alquil venc', 'venc'],
            'roles'  => ['*'],
        ],
        'contratos_activos' => [
            'tokens' => ['activ', 'vigent'],
            'frases' => ['contrat activ', 'alquil activ', 'contrat vigent', 'alquil vigent'],
            'roles'  => ['*'],
        ],
    ];

    /** Stopwords propias de las preguntas de datos (además de las del motor). */
    private const STOP_EXTRA = ['cuanto', 'cuanta', 'cuantos', 'cuantas', 'hay', 'esta', 'estan', 'tengo', 'dime', 'decime', 'saber', 'quiero', 'ver', 'hoy', 'actual', 'actualmente', 'ahora', 'momento', 'dias', 'dia', 'proximo', 'proximos', 'los', 'las', 'del', 'que', 'en'];


    /**
     * Intenta resolver el mensaje como consulta de datos.
     * Devuelve null si NO matchea ninguna intención (el caller cae a la KB).
     */
    public function resolver(string $mensaje, string $pantalla, array $roles): ?array
    {
        // Preguntas instruccionales ("¿cómo cobro…?", "paso a paso") las
        // responde la base de conocimiento, NO las consultas de datos:
        // si no, "¿cómo cobro la salida?" devolvería cifras en vez del trámite.
        $raw = mb_strtolower(MotorLocal::quitarTildes(trim($mensaje)), 'UTF-8');
        if(preg_match('/\b(como|paso a paso|instrucciones|manual de uso)\b/', $raw)) {
            return null;
        }

        $tokens = MotorLocal::normalizarTokens($mensaje, self::STOP_EXTRA);
        if($tokens === []) {
            return null;
        }

        $mejor = null;
        $mejorPuntaje = 0.0;

        foreach(self::INTENCIONES as $nombre => $conf) {
            if(!$this->rolPermitido($roles, $conf['roles'])) {
                continue;
            }
            $puntaje = $this->puntuar($tokens, $conf);
            if($puntaje > $mejorPuntaje) {
                $mejorPuntaje = $puntaje;
                $mejor = $nombre;
            }
        }

        if($mejor === null || $mejorPuntaje < self::UMBRAL) {
            return null;
        }

        // Extrae un N para "por vencer en N días" (default 30, tope 365).
        $dias = 30;
        if($mejor === 'contratos_por_vencer') {
            foreach($tokens as $t) {
                if(ctype_digit($t) && (int)$t >= 1 && (int)$t <= 365) {
                    $dias = (int)$t;
                    break;
                }
            }
        }

        $data = $this->ejecutar($mejor, $dias);
        if($data === null) {
            return null;
        }

        return ['intencion' => $mejor, 'data' => $data];
    }

    /** Puntúa una intención contra los tokens del mensaje (0 a ~1). */
    private function puntuar(array $tokens, array $conf): float
    {
        $texto = ' ' . implode(' ', $tokens) . ' ';
        $score = 0.0;
        $hits  = 0;

        // Frases completas (peso alto).
        foreach($conf['frases'] as $frase) {
            if(str_contains($texto, ' ' . $frase . ' ')) {
                $score += 0.55;
                $hits++;
            }
        }

        // Tokens individuales (peso moderado, tope 0.45).
        $tokenHits = 0;
        foreach(array_unique($conf['tokens']) as $t) {
            if(in_array($t, $tokens, true)) {
                $tokenHits++;
            }
        }
        if($tokenHits > 0) {
            $score += min(0.45, $tokenHits * 0.15);
        }

        return ($hits > 0 || $tokenHits > 0) ? min(1.0, $score) : 0.0;
    }

    /** Despacha la intención a su consulta (todas SELECT de solo lectura). */
    private function ejecutar(string $intencion, int $dias): ?array
    {
        switch($intencion) {
            case 'ocupacion':            return $this->ocupacion();
            case 'ingresos_mes':         return $this->ingresosMes();
            case 'operaciones_mes':      return $this->operacionesMes();
            case 'deuda_total':          return $this->deudaTotal();
            case 'contratos_activos':    return $this->contratosActivos();
            case 'contratos_por_vencer': return $this->contratosPorVencer($dias);
        }
        return null;
    }

    /** Libres / ocupadas / mantenimiento / total (agregado, sin datos personales). */
    private function ocupacion(): array
    {
        $rows   = (new Plaza())->getResumenPorEstado();
        $totales = ['libre' => 0, 'ocupada' => 0, 'mantenimiento' => 0];
        $total  = 0;
        foreach($rows as $r) {
            $total += (int)$r['cantidad'];
            if(isset($totales[$r['estado']])) {
                $totales[$r['estado']] = (int)$r['cantidad'];
            }
        }

        return [
            'titulo' => 'Ocupación actual',
            'lineas' => [
                '🟢 Libres: **' . $totales['libre'] . '**',
                '🔴 Ocupadas: **' . $totales['ocupada'] . '**',
                '🟡 En mantenimiento: **' . $totales['mantenimiento'] . '**',
                'Total de plazas: **' . $total . '**',
            ],
        ];
    }

    /** Ingresos del mes en curso (facturado y cobrado). */
    private function ingresosMes(): array
    {
        $db  = (new Movimiento())->db;
        $row = $db->query(
            "SELECT COALESCE(SUM(monto_calculado), 0) AS facturado,
                    COALESCE(SUM(CASE WHEN estado_pago = 'pagado' THEN monto_pagado ELSE 0 END), 0) AS cobrado
             FROM movimientos
             WHERE hora_salida IS NOT NULL
               AND hora_salida >= DATE_FORMAT(CURDATE(), '%Y-%m-01')"
        )->fetch();

        $facturado = (float)($row['facturado'] ?? 0);
        $cobrado   = (float)($row['cobrado'] ?? 0);
        $fmt = fn($n) => '$' . number_format($n, 2, ',', '.');

        return [
            'titulo' => 'Ingresos de ' . date('m/Y'),
            'lineas' => [
                'Facturado: **' . $fmt($facturado) . '**',
                'Cobrado: **' . $fmt($cobrado) . '**',
                'Pendiente: **' . $fmt(max(0, $facturado - $cobrado)) . '**',
            ],
        ];
    }

    /** Operaciones del mes en curso (cantidad de movimientos y activos). */
    private function operacionesMes(): array
    {
        $db  = (new Movimiento())->db;
        $row = $db->query(
            "SELECT COUNT(*) AS total,
                    SUM(hora_salida IS NULL) AS activos
             FROM movimientos
             WHERE hora_entrada >= DATE_FORMAT(CURDATE(), '%Y-%m-01')"
        )->fetch();

        return [
            'titulo' => 'Operaciones de ' . date('m/Y'),
            'lineas' => [
                'Movimientos del mes: **' . (int)($row['total'] ?? 0) . '**',
                'Autos adentro ahora: **' . (int)($row['activos'] ?? 0) . '**',
            ],
        ];
    }

    /** Deuda pendiente total (solo agregado $, sin datos de clientes). */
    private function deudaTotal(): array
    {
        $db  = (new Deuda())->db;
        $row = $db->query(
            "SELECT COALESCE(SUM(monto_con_interes), 0) AS total
             FROM deudas
             WHERE estado = 'pendiente'"
        )->fetch();

        return [
            'titulo' => 'Deuda pendiente',
            'lineas' => ['Total pendiente de cobro: **$' . number_format((float)($row['total'] ?? 0), 2, ',', '.') . '**'],
        ];
    }

    /** Cantidad de contratos activos/vigentes. */
    private function contratosActivos(): array
    {
        $db  = (new Alquiler())->db;
        $row = $db->query(
            "SELECT COUNT(*) AS total
             FROM contratos_alquiler
             WHERE estado = 'activo' AND fecha_fin >= CURDATE()"
        )->fetch();

        return [
            'titulo' => 'Contratos de alquiler',
            'lineas' => ['Contratos activos: **' . (int)($row['total'] ?? 0) . '**'],
        ];
    }

    /**
     * Contratos por vencer en N días. Query acotada: SOLO plaza, sector y
     * fecha de fin — sin datos personales del cliente. Máx. 10 resultados.
     */
    private function contratosPorVencer(int $dias): array
    {
        $dias = max(1, min(365, $dias));
        $db   = (new Alquiler())->db;
        $rows = $db->query(
            "SELECT p.numero AS plaza, p.sector, c.fecha_fin
             FROM contratos_alquiler c
             INNER JOIN plazas p ON p.id = c.plaza_id
             WHERE c.estado = 'activo'
               AND c.fecha_fin >= CURDATE()
               AND c.fecha_fin <= DATE_ADD(CURDATE(), INTERVAL " . $dias . " DAY)
             ORDER BY c.fecha_fin ASC
             LIMIT 10"
        )->fetchAll();

        $lineas = [];
        foreach($rows as $r) {
            $fecha = \DateTime::createFromFormat('Y-m-d', substr((string)$r['fecha_fin'], 0, 10));
            $lineas[] = '- Plaza **' . $r['plaza'] . '** (' . ($r['sector'] ?: 's/sector') . ') → vence **'
                . ($fecha ? $fecha->format('d/m/Y') : (string)$r['fecha_fin']) . '**';
        }

        return [
            'titulo' => 'Contratos por vencer (próximos ' . $dias . ' días)',
            'lineas' => $lineas !== [] ? $lineas : ['No hay contratos por vencer en ese plazo. ✔'],
        ];
    }

    private function rolPermitido(array $rolesUsuario, array $rolesNecesarios): bool
    {
        return in_array('*', $rolesNecesarios, true)
            || array_intersect($rolesUsuario, $rolesNecesarios) !== [];
    }
}
