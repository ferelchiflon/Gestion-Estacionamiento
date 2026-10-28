<?php
namespace App\Helpers;

/**
 * Formato de números y fechas para Argentina.
 * Reutilizable desde vistas, CSV y PDF.
 */
class Fmt {

    /** 1234.56 → "1.234,56" */
    public static function money($valor): string {
        return number_format((float)$valor, 2, ',', '.');
    }

    /** 1234.56 → "$ 1.234,56" */
    public static function moneySigno($valor): string {
        return '$ ' . self::money($valor);
    }

    /** "2026-10-21" → "21/10/2026". Devuelve el original si no se puede parsear. */
    public static function fecha($fechaSql): string {
        $t = strtotime((string)$fechaSql);
        return $t ? date('d/m/Y', $t) : (string)$fechaSql;
    }

    /** "2026-10-21 19:45:00" → "21/10/2026 19:45" */
    public static function fechaHora($fechaHoraSql): string {
        $t = strtotime((string)$fechaHoraSql);
        return $t ? date('d/m/Y H:i', $t) : (string)$fechaHoraSql;
    }

    /** 10 → "Octubre 2026" */
    public static function periodoLegible(int $mes, int $anio): string {
        $meses = [1 => 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return ($meses[$mes] ?? $mes) . ' ' . $anio;
    }
}
