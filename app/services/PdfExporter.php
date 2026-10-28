<?php
namespace App\Services;

/**
 * Exportación a PDF.
 *
 * El proyecto no tiene Composer, por lo que dompdf no está disponible: se usa
 * el mismo patrón de los recibos existentes (PDFService): página imprimible con
 * CSS @media print y diálogo de impresión del navegador ("Guardar como PDF").
 *
 * La interfaz es compatible con un futuro cambio a dompdf: solo habría que
 * reemplazar el cuerpo de salida() por $dompdf->loadHtml() + ->stream().
 */
class PdfExporter {

    /**
     * Imprime una página imprimible con encabezado de empresa y pie de página.
     *
     * @param string $tituloReporte ej. "Libro IVA Ventas"
     * @param string $periodoTexto  ej. "Octubre 2026 (01/10/2026 al 31/10/2026)"
     * @param array  $config        fila de configuracion_fiscal
     * @param string $contenidoHtml HTML del cuerpo del reporte (tablas, totales)
     */
    public static function salida(string $tituloReporte, string $periodoTexto, array $config, string $contenidoHtml): void {
        while(ob_get_level() > 0) { ob_end_clean(); }

        $razonSocial = htmlspecialchars($config['razon_social'] ?? '(sin configurar)', ENT_QUOTES, 'UTF-8');
        $cuit        = htmlspecialchars($config['cuit'] ?? '', ENT_QUOTES, 'UTF-8');
        $condicion   = htmlspecialchars(str_replace('_', ' ', $config['condicion_iva'] ?? ''), ENT_QUOTES, 'UTF-8');
        $direccion   = htmlspecialchars($config['direccion'] ?? '', ENT_QUOTES, 'UTF-8');
        $titulo      = htmlspecialchars($tituloReporte, ENT_QUOTES, 'UTF-8');
        $periodo     = htmlspecialchars($periodoTexto, ENT_QUOTES, 'UTF-8');
        $emision     = date('d/m/Y H:i');
        $direccionHtml = $direccion !== '' ? "<br>{$direccion}" : '';

        header('Content-Type: text/html; charset=UTF-8');

        echo <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>{$titulo} - {$periodo}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; padding: 24px; }
    .encabezado { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .encabezado h1 { font-size: 18px; }
    .encabezado .empresa { font-size: 13px; }
    .encabezado .reporte { text-align: right; }
    .meta { font-size: 11px; color: #555; display: flex; justify-content: space-between; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #999; padding: 4px 6px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th { background: #eee; text-align: left; }
    .num { text-align: right; white-space: nowrap; }
    tfoot td { font-weight: bold; background: #f5f5f5; }
    .totales { margin-top: 10px; }
    .totales td { border: none; padding: 2px 6px; }
    .nota { font-size: 10px; color: #666; margin-top: 14px; border-top: 1px solid #ccc; padding-top: 6px; }
    .pie { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; color: #777;
           display: flex; justify-content: space-between; padding: 0 24px; }
    @page { margin: 18mm 12mm 16mm 12mm; }
    @media print {
        body { padding: 0; }
        .btn-imprimir { display: none; }
        .pie { position: fixed; bottom: 0; }
    }
    .btn-imprimir { margin: 0 0 14px; padding: 8px 16px; font-size: 13px; cursor: pointer; }
</style>
</head>
<body>
    <button class="btn-imprimir" onclick="window.print()">🖨 Guardar como PDF / Imprimir</button>

    <div class="encabezado">
        <div class="empresa">
            <strong>{$razonSocial}</strong><br>
            CUIT: {$cuit} &nbsp;·&nbsp; Condición: {$condicion}
            {$direccionHtml}
        </div>
        <div class="reporte">
            <h1>{$titulo}</h1>
        </div>
    </div>
    <div class="meta">
        <span>Período: {$periodo}</span>
        <span>Emitido: {$emision}</span>
    </div>

    {$contenidoHtml}

    <div class="nota">
        Documento generado por el sistema de gestión de estacionamiento. ARCA (ex AFIP).
    </div>
    <div class="pie">
        <span>{$razonSocial} - CUIT {$cuit}</span>
        <span>Página <span class="pagina"></span></span>
    </div>

<script>
// La numeración de páginas la agrega el navegador desde el diálogo de impresión
// ("Encabezados y pies de página" / "Números de página").
</script>
</body>
</html>
HTML;
        exit;
    }
}
