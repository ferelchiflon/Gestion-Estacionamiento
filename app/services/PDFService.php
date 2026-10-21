<?php
namespace App\Services;

class PDFService {
    
    /**
     * Genera el HTML de un recibo listo para imprimir/guardar como PDF.
     */
    public static function construirHtmlRecibo($recibo) {
        $numero = str_pad($recibo['id'], 6, '0', STR_PAD_LEFT);
        $cliente = $recibo['cliente_nombre'] ?? 'Consumidor final';
        
        $filas = '';
        if(!empty($recibo['patente'])) {
            $entrada = $recibo['hora_entrada'] ? date('d/m/Y H:i', strtotime($recibo['hora_entrada'])) : '-';
            $salida = $recibo['hora_salida'] ? date('d/m/Y H:i', strtotime($recibo['hora_salida'])) : '-';
            $filas .= "<tr><td>Estacionamiento - Patente " . htmlspecialchars($recibo['patente']) . "</td>
                       <td>Desde {$entrada} hasta {$salida}</td>
                       <td style='text-align:right'>$" . number_format((float)$recibo['monto'], 2, ',', '.') . "</td></tr>";
        } else {
            $filas .= "<tr><td>Alquiler de plaza" . (isset($recibo['plaza_numero']) ? " N° {$recibo['plaza_numero']}" : '') . "</td>
                       <td></td>
                       <td style='text-align:right'>$" . number_format((float)$recibo['monto'], 2, ',', '.') . "</td></tr>";
        }
        
        return "<!DOCTYPE html>
<html lang='es'>
<head>
<meta charset='UTF-8'>
<title>Recibo N° {$numero}</title>
<style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #222; }
    .recibo { max-width: 600px; margin: 0 auto; border: 1px solid #ccc; padding: 24px; }
    h1 { font-size: 20px; border-bottom: 2px solid #222; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
    .total { font-size: 16px; font-weight: bold; text-align: right; margin-top: 12px; }
    .meta { font-size: 12px; color: #555; }
</style>
</head>
<body>
<div class='recibo'>
    <h1>Recibo N° {$numero}</h1>
    <p class='meta'>Fecha: " . date('d/m/Y H:i', strtotime($recibo['fecha_emision'])) . "<br>
       Cliente: " . htmlspecialchars($cliente) . "<br>
       Forma de pago: " . htmlspecialchars($recibo['forma_pago'] ?? '-') . "</p>
    <table>
        <thead><tr><th>Concepto</th><th>Detalle</th><th style='text-align:right'>Importe</th></tr></thead>
        <tbody>{$filas}</tbody>
    </table>
    <p class='total'>TOTAL: $" . number_format((float)$recibo['monto'], 2, ',', '.') . "</p>
    <p class='meta'>¡Gracias por su visita! Este comprobante es válido como constancia de pago.</p>
</div>
</body>
</html>";
    }
    
    /**
     * Envia el recibo como página imprimible (el navegador permite
     * guardarlo como PDF desde el diálogo de impresión).
     */
    public static function descargarRecibo($recibo) {
        $html = self::construirHtmlRecibo($recibo);
        $html = str_replace('</body>', "<script>window.addEventListener('load', function(){ window.print(); });</script></body>", $html);
        
        header('Content-Type: text/html; charset=UTF-8');
        header('Content-Disposition: inline; filename="recibo-' . str_pad($recibo['id'], 6, '0', STR_PAD_LEFT) . '.html"');
        echo $html;
        exit;
    }
}
