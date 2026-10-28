<?php
namespace App\Services;

/**
 * Exportación CSV con formato argentino de Excel:
 * UTF-8 con BOM y separador punto y coma (;).
 */
class CsvExporter {

    /**
     * Envía un CSV como descarga.
     *
     * @param string $filename nombre del archivo (sin extensión)
     * @param array  $filas    primera fila = encabezados; resto = datos
     */
    public static function descargar(string $filename, array $filas): void {
        while(ob_get_level() > 0) { ob_end_clean(); }

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $filename . '_' . date('Ymd_His') . '.csv"');
        header('Cache-Control: no-store, max-age=0');

        $salida = fopen('php://output', 'w');
        fwrite($salida, "\xEF\xBB\xBF"); // BOM UTF-8 para Excel

        foreach($filas as $fila) {
            fputcsv($salida, array_map([self::class, 'celda'], $fila), ';');
        }
        fclose($salida);
        exit;
    }

    /** Escapa una celda para evitar inyección de fórmulas en Excel (=, +, -, @ iniciales). */
    private static function celda($valor): string {
        $valor = (string)$valor;
        if(preg_match('/^[=+\-@]/', $valor)) {
            $valor = "'" . $valor;
        }
        return $valor;
    }
}
