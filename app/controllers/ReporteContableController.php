<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Helpers\Fmt;
use App\Models\ConfiguracionFiscal;
use App\Models\Gasto;
use App\Models\ReporteContable;
use App\Services\CsvExporter;
use App\Services\PdfExporter;

/**
 * Reportes contables/impositivos: IVA Ventas, IVA Compras,
 * Posición de IVA mensual y ARCA (ex AFIP).
 *
 * Cada reporte se construye una sola vez como [encabezados, filas, totales]
 * y desde ahí se sirve en pantalla, CSV o PDF.
 */
class ReporteContableController extends Controller {

    public function ivaVentas() {
        $rango = $this->rango($_GET);
        $modelo      = new ReporteContable();
        $configM     = new ConfiguracionFiscal();
        $config      = $configM->obtener();
        $alicuota    = $configM->alicuotaIva();
        $discriminar = ($config['condicion_iva'] ?? '') !== 'monotributo';

        // Estacionamiento + alquileres + deudas cobradas, unificados por día
        $fuentes = [
            ['Estacionamiento', $modelo->ventasEstacionamiento($rango['desde'], $rango['hasta'])],
            ['Alquileres',      $modelo->ventasAlquileres($rango['desde'], $rango['hasta'])],
            ['Cobro de deudas', $modelo->ventasDeudas($rango['desde'], $rango['hasta'])],
        ];
        $porDia = [];
        foreach($fuentes as [$origen, $rows]) {
            foreach($rows as $r) {
                $f = $r['fecha'];
                $porDia[$f] = $porDia[$f] ?? ['fecha' => $f, 'operaciones' => 0, 'total' => 0.0, 'detalle' => []];
                $porDia[$f]['operaciones'] += (int)$r['operaciones'];
                $porDia[$f]['total']      += (float)$r['total'];
                $porDia[$f]['detalle'][]   = $origen . ': ' . (int)$r['operaciones'] . ' / $ ' . Fmt::money($r['total']);
            }
        }
        ksort($porDia);

        $encabezados = ['Fecha', 'Origen / detalle', 'Oper.', 'Total', 'Neto gravado', 'IVA ' . Fmt::money($alicuota) . '%'];
        $filas = [];
        $tTotal = $tNeto = $tIva = 0.0; $tOps = 0;
        foreach($porDia as $d) {
            if($discriminar && $alicuota > 0) {
                $neto = round($d['total'] / (1 + $alicuota / 100), 2);
                $iva  = round($d['total'] - $neto, 2);
            } else {
                $neto = round($d['total'], 2);
                $iva  = 0.0;
            }
            $tTotal += $d['total']; $tNeto += $neto; $tIva += $iva; $tOps += $d['operaciones'];
            $filas[] = [
                Fmt::fecha($d['fecha']),
                implode(' + ', $d['detalle']),
                $d['operaciones'],
                Fmt::money($d['total']),
                Fmt::money($neto),
                Fmt::money($iva),
            ];
        }
        $totalesFila = ['', 'TOTALES', $tOps, Fmt::money($tTotal), Fmt::money($tNeto), Fmt::money($tIva)];

        $datos = compact('encabezados', 'filas', 'totalesFila');
        $datos['rango'] = $rango;
        $datos['alicuota'] = $alicuota;
        $datos['discriminar'] = $discriminar;

        if($this->export() === 'csv') {
            $filasCsv = array_merge([$encabezados], $filas, [[], $totalesFila]);
            CsvExporter::descargar("iva_ventas_{$rango['desde']}_a_{$rango['hasta']}", $filasCsv);
        }
        $contenidoTabla = $this->tablaHtml($encabezados, $filas, $totalesFila, [3, 4, 5]);
        if(!$discriminar) {
            $contenidoTabla .= '<p><em>Condición Monotributo: los importes se informan sin discriminar IVA.</em></p>';
        }
        if($this->export() === 'pdf') {
            PdfExporter::salida('Libro IVA Ventas (calculado)', $rango['texto'], $config, $contenidoTabla);
        }
        if($this->export() === 'email') {
            $this->enviarAlContador('Libro IVA Ventas', $rango, $config, $contenidoTabla, '/reportes-contables/iva-ventas');
        }

        $this->view('reportes_contables/iva_ventas', $datos);
    }

    public function ivaCompras() {
        $rango = $this->rango($_GET);
        $config = (new ConfiguracionFiscal())->obtener();
        $gastoM = new Gasto();

        $gastos = $gastoM->listar($rango['desde'], $rango['hasta']);
        $tot    = $gastoM->totales($rango['desde'], $rango['hasta']);

        $encabezados = ['Fecha', 'Proveedor', 'CUIT', 'Comprobante', 'Neto gravado', 'IVA 21%', 'IVA 10,5%',
                        'IVA 27%', 'No grav.', 'Perc. IVA', 'Perc. IIBB', 'Total'];
        $filas = [];
        foreach($gastos as $g) {
            $comprobante = $g['tipo_comprobante'];
            if(!empty($g['punto_venta']) && !empty($g['numero_comprobante'])) {
                $comprobante .= ' ' . str_pad((string)$g['punto_venta'], 4, '0', STR_PAD_LEFT)
                              . '-' . str_pad((string)$g['numero_comprobante'], 8, '0', STR_PAD_LEFT);
            }
            $filas[] = [
                Fmt::fecha($g['fecha']),
                $g['proveedor'],
                ($g['cuit_proveedor'] ?: '—'),
                $comprobante,
                Fmt::money($g['neto_gravado']),
                Fmt::money($g['iva_21']),
                Fmt::money($g['iva_105']),
                Fmt::money($g['iva_27']),
                Fmt::money($g['no_gravado']),
                Fmt::money($g['percepcion_iva']),
                Fmt::money($g['percepcion_iibb']),
                Fmt::money($g['total']),
            ];
        }
        $totalesFila = ['', 'TOTALES (' . (int)$tot['comprobantes'] . ')', '', '',
            Fmt::money($tot['neto_gravado']), Fmt::money($tot['iva_21']), Fmt::money($tot['iva_105']),
            Fmt::money($tot['iva_27']), Fmt::money($tot['no_gravado']), Fmt::money($tot['percepcion_iva']),
            Fmt::money($tot['percepcion_iibb']), Fmt::money($tot['total'])];

        $datos = compact('encabezados', 'filas', 'totalesFila', 'tot');
        $datos['rango'] = $rango;

        if($this->export() === 'csv') {
            $filasCsv = array_merge([$encabezados], $filas, [[], $totalesFila]);
            CsvExporter::descargar("iva_compras_{$rango['desde']}_a_{$rango['hasta']}", $filasCsv);
        }
        $contenidoTabla = $this->tablaHtml($encabezados, $filas, $totalesFila, [4, 5, 6, 7, 8, 9, 10, 11]);
        if($this->export() === 'pdf') {
            PdfExporter::salida('Libro IVA Compras', $rango['texto'], $config, $contenidoTabla);
        }
        if($this->export() === 'email') {
            $this->enviarAlContador('Libro IVA Compras', $rango, $config, $contenidoTabla, '/reportes-contables/iva-compras');
        }

        $this->view('reportes_contables/iva_compras', $datos);
    }

    public function posicionIva() {
        $rango = $this->rango($_GET);
        $modelo   = new ReporteContable();
        $configM  = new ConfiguracionFiscal();
        $config   = $configM->obtener();
        $alicuota = $configM->alicuotaIva();

        // Débito fiscal: IVA de ventas (estacionamiento + alquileres + deudas)
        $totalVentas = 0.0;
        foreach([$modelo->ventasEstacionamiento($rango['desde'], $rango['hasta']),
                 $modelo->ventasAlquileres($rango['desde'], $rango['hasta']),
                 $modelo->ventasDeudas($rango['desde'], $rango['hasta'])] as $rows) {
            foreach($rows as $r) { $totalVentas += (float)$r['total']; }
        }
        $netoVentas = $alicuota > 0 ? round($totalVentas / (1 + $alicuota / 100), 2) : $totalVentas;
        $debitoFiscal = round($totalVentas - $netoVentas, 2);

        // Crédito fiscal: IVA de compras + percepciones de IVA soportadas
        $totCompras = (new Gasto())->totales($rango['desde'], $rango['hasta']);
        $creditoFiscal = round((float)$totCompras['iva'] + (float)$totCompras['percepcion_iva'], 2);

        $saldoTecnico = $modelo->getSaldoTecnico($rango['periodo']);
        $resultado  = round($debitoFiscal - $creditoFiscal, 2);   // > 0 → a pagar
        $saldoFinal = round($resultado - $saldoTecnico, 2);

        $datos = compact('rango', 'alicuota', 'totalVentas', 'netoVentas', 'debitoFiscal',
                         'totCompras', 'creditoFiscal', 'saldoTecnico', 'resultado', 'saldoFinal');

        if($this->export() === 'csv') {
            $filasCsv = [
                ['Concepto', 'Importe'],
                ['Período', $rango['texto']],
                ['Ventas brutas (con IVA)', Fmt::money($totalVentas)],
                ['Ventas netas', Fmt::money($netoVentas)],
                ['Débito fiscal (IVA ventas)', Fmt::money($debitoFiscal)],
                ['IVA compras', Fmt::money($totCompras['iva'])],
                ['Percepciones IVA de compras', Fmt::money($totCompras['percepcion_iva'])],
                ['Crédito fiscal', Fmt::money($creditoFiscal)],
                ['Resultado del período (débito - crédito)', Fmt::money($resultado)],
                ['Saldo técnico anterior (a favor)', Fmt::money($saldoTecnico)],
                [$saldoFinal >= 0 ? 'Saldo a pagar' : 'Saldo a favor', Fmt::money(abs($saldoFinal))],
            ];
            CsvExporter::descargar("posicion_iva_{$rango['desde']}_a_{$rango['hasta']}", $filasCsv);
        }
        if($this->export() === 'pdf') {
            $contenido = '<table><tbody>'
                . '<tr><th>Ventas brutas (con IVA)</th><td class="num">$ ' . Fmt::money($totalVentas) . '</td></tr>'
                . '<tr><th>Ventas netas</th><td class="num">$ ' . Fmt::money($netoVentas) . '</td></tr>'
                . '<tr><th>Débito fiscal (IVA ventas)</th><td class="num">$ ' . Fmt::money($debitoFiscal) . '</td></tr>'
                . '<tr><th>IVA compras</th><td class="num">$ ' . Fmt::money($totCompras['iva']) . '</td></tr>'
                . '<tr><th>Percepciones IVA de compras</th><td class="num">$ ' . Fmt::money($totCompras['percepcion_iva']) . '</td></tr>'
                . '<tr><th>Crédito fiscal</th><td class="num">$ ' . Fmt::money($creditoFiscal) . '</td></tr>'
                . '<tr><th>Resultado del período (débito - crédito)</th><td class="num">$ ' . Fmt::money($resultado) . '</td></tr>'
                . '<tr><th>Saldo técnico anterior (a favor)</th><td class="num">$ ' . Fmt::money($saldoTecnico) . '</td></tr>'
                . '<tr><th><strong>' . ($saldoFinal >= 0 ? 'Saldo a pagar' : 'Saldo a favor') . '</strong></th>'
                . '<td class="num"><strong>$ ' . Fmt::money(abs($saldoFinal)) . '</strong></td></tr>'
                . '</tbody></table>';
        if($this->export() === 'pdf') {
            PdfExporter::salida('Posición de IVA mensual', $rango['texto'], $config, $contenido);
        }
        if($this->export() === 'email') {
            $this->enviarAlContador('Posición de IVA mensual', $rango, $config, $contenido, '/reportes-contables/posicion-iva');
        }

        $this->view('reportes_contables/posicion_iva', $datos);
    }

    /** POST: carga del saldo técnico de IVA del período. */
    public function guardarSaldoTecnico() {
        $rango    = $this->rango($_POST);
        $montoRaw = str_replace(',', '.', trim((string)($_POST['saldo_tecnico'] ?? '0')));
        if(!is_numeric($montoRaw) || (float)$montoRaw < 0) {
            $_SESSION['error'] = 'El saldo técnico debe ser un número >= 0.';
        } else {
            (new ReporteContable())->setSaldoTecnico($rango['periodo'], round((float)$montoRaw, 2));
            $_SESSION['success'] = 'Saldo técnico de IVA guardado para ' . $rango['texto'] . '.';
        }
        $this->redirect('/reportes-contables/posicion-iva?mes=' . $rango['mes'] . '&anio=' . $rango['anio']);
    }

    public function arca() {
        $rango = $this->rango($_GET);
        $modelo  = new ReporteContable();
        $configM = new ConfiguracionFiscal();
        $config  = $configM->obtener();
        $pv      = (int)($config['punto_venta'] ?? 1);

        $porDia = [];
        foreach([$modelo->ventasEstacionamiento($rango['desde'], $rango['hasta']),
                 $modelo->ventasAlquileres($rango['desde'], $rango['hasta']),
                 $modelo->ventasDeudas($rango['desde'], $rango['hasta'])] as $rows) {
            foreach($rows as $r) {
                $f = $r['fecha'];
                $porDia[$f] = $porDia[$f] ?? ['fecha' => $f, 'comprobantes' => 0, 'total' => 0.0];
                $porDia[$f]['comprobantes'] += (int)$r['operaciones'];
                $porDia[$f]['total']        += (float)$r['total'];
            }
        }
        ksort($porDia);

        $alicuota = $configM->alicuotaIva();
        $encabezados = ['Fecha', 'Tipo comprobante', 'Punto de venta', 'Comprobantes', 'Neto', 'IVA', 'Total'];
        $filas = [];
        $tNeto = $tIva = $tTotal = 0.0; $tComp = 0;
        foreach($porDia as $d) {
            $neto = $alicuota > 0 ? round($d['total'] / (1 + $alicuota / 100), 2) : $d['total'];
            $iva  = round($d['total'] - $neto, 2);
            $tNeto += $neto; $tIva += $iva; $tTotal += $d['total']; $tComp += $d['comprobantes'];
            $filas[] = [Fmt::fecha($d['fecha']), 'Recibo C (interno)', $pv, $d['comprobantes'],
                        Fmt::money($neto), Fmt::money($iva), Fmt::money($d['total'])];
        }
        $totalesFila = ['', 'TOTALES', '', $tComp, Fmt::money($tNeto), Fmt::money($tIva), Fmt::money($tTotal)];

        $datos = compact('encabezados', 'filas', 'totalesFila');
        $datos['rango'] = $rango;
        $datos['pv'] = $pv;
        $datos['porFormaPago'] = $modelo->cobrosPorFormaPago($rango['desde'], $rango['hasta']);

        if($this->export() === 'csv') {
            $filasCsv = array_merge(
                [['Resumen de comprobantes emitidos - ARCA (ex AFIP)'], ['Período', $rango['texto']], []],
                [$encabezados], $filas, [[], $totalesFila], [],
                [['Cobros por forma de pago (estacionamiento)']],
                [['Forma de pago', 'Operaciones', 'Total']],
                array_map(fn($f) => [$f['forma_pago'], $f['operaciones'], Fmt::money($f['total'])], $datos['porFormaPago'])
            );
            CsvExporter::descargar("arca_{$rango['desde']}_a_{$rango['hasta']}", $filasCsv);
        }
        $contenidoTabla = $this->tablaHtml($encabezados, $filas, $totalesFila, [4, 5, 6]);
        $contenidoTabla .= '<p class="nota">Nota: el sistema no emite comprobantes electrónicos; '
                        . 'se listan los recibos internos como "Recibo C" y el punto de venta configurado. '
                        . 'Formato del Libro IVA Digital: mejora futura.</p>';
        if($this->export() === 'pdf') {
            PdfExporter::salida('ARCA (ex AFIP) - Resumen de comprobantes emitidos', $rango['texto'], $config, $contenidoTabla);
        }
        if($this->export() === 'email') {
            $this->enviarAlContador('ARCA (ex AFIP) - Comprobantes emitidos', $rango, $config, $contenidoTabla, '/reportes-contables/arca');
        }

        $this->view('reportes_contables/arca', $datos);
    }

    public function iibb() {
        $rango = $this->rango($_GET);
        $modelo  = new ReporteContable();
        $configM = new ConfiguracionFiscal();
        $config  = $configM->obtener();

        $alicuotaIva    = $configM->alicuotaIva();
        $alicuotaIibb   = $configM->alicuotaIibb();
        $jurisPrincipal = ($config['jurisdiccion_iibb'] ?: 'CABA');

        // Base imponible: ventas netas del período (mismo criterio que IVA Ventas)
        $totalVentas = 0.0;
        foreach([$modelo->ventasEstacionamiento($rango['desde'], $rango['hasta']),
                 $modelo->ventasAlquileres($rango['desde'], $rango['hasta']),
                 $modelo->ventasDeudas($rango['desde'], $rango['hasta'])] as $rows) {
            foreach($rows as $r) { $totalVentas += (float)$r['total']; }
        }
        $baseImponible = $alicuotaIva > 0 ? round($totalVentas / (1 + $alicuotaIva / 100), 2) : $totalVentas;

        // Impuesto determinado y percepciones/retenciones cargadas
        $impuestoDeterminado = round($baseImponible * $alicuotaIibb / 100, 2);
        $porJuris = $modelo->percepcionesIibb($rango['periodo']);
        $totalPercepciones = 0.0; $totalRetenciones = 0.0;
        foreach($porJuris as $p) {
            $totalPercepciones += (float)$p['percepciones'];
            $totalRetenciones  += (float)$p['retenciones'];
        }
        $saldo = round($impuestoDeterminado - $totalPercepciones - $totalRetenciones, 2);

        $datos = compact('rango', 'alicuotaIva', 'alicuotaIibb', 'jurisPrincipal', 'totalVentas',
                         'baseImponible', 'impuestoDeterminado', 'porJuris',
                         'totalPercepciones', 'totalRetenciones', 'saldo');

        if($this->export() === 'csv') {
            $filasCsv = [
                ['Concepto', 'Importe'],
                ['Período', $rango['texto']],
                ['Jurisdicción principal', $jurisPrincipal],
                ['Ventas brutas (con IVA)', Fmt::money($totalVentas)],
                ['Base imponible (ventas netas)', Fmt::money($baseImponible)],
                ['Alícuota IIBB (%)', Fmt::money($alicuotaIibb)],
                ['Impuesto determinado', Fmt::money($impuestoDeterminado)],
                ['Percepciones cargadas', Fmt::money($totalPercepciones)],
                ['Retenciones cargadas', Fmt::money($totalRetenciones)],
                [$saldo >= 0 ? 'Saldo a ingresar' : 'Saldo a favor', Fmt::money(abs($saldo))],
                [],
                ['Jurisdicción', 'Percepciones', 'Retenciones'],
            ];
            foreach($porJuris as $p) {
                $filasCsv[] = [$p['jurisdiccion'], Fmt::money($p['percepciones']), Fmt::money($p['retenciones'])];
            }
            $filasCsv[] = [];
            $filasCsv[] = ['Nota: estructura preparada para Convenio Multilateral; hoy funciona con una sola jurisdicción.'];
            CsvExporter::descargar("iibb_{$rango['desde']}_a_{$rango['hasta']}", $filasCsv);
        }
        if($this->export() === 'pdf') {
            $contenido = '<table><tbody>'
                . '<tr><th>Jurisdicción principal</th><td>' . htmlspecialchars($jurisPrincipal, ENT_QUOTES, 'UTF-8') . '</td></tr>'
                . '<tr><th>Ventas brutas (con IVA)</th><td class="num">$ ' . Fmt::money($totalVentas) . '</td></tr>'
                . '<tr><th>Base imponible (ventas netas)</th><td class="num">$ ' . Fmt::money($baseImponible) . '</td></tr>'
                . '<tr><th>Alícuota IIBB</th><td class="num">' . Fmt::money($alicuotaIibb) . ' %</td></tr>'
                . '<tr><th>Impuesto determinado</th><td class="num">$ ' . Fmt::money($impuestoDeterminado) . '</td></tr>'
                . '<tr><th>(-) Percepciones cargadas</th><td class="num">$ ' . Fmt::money($totalPercepciones) . '</td></tr>'
                . '<tr><th>(-) Retenciones cargadas</th><td class="num">$ ' . Fmt::money($totalRetenciones) . '</td></tr>'
                . '<tr><th><strong>' . ($saldo >= 0 ? 'Saldo a ingresar' : 'Saldo a favor') . '</strong></th>'
                . '<td class="num"><strong>$ ' . Fmt::money(abs($saldo)) . '</strong></td></tr>'
                . '</tbody></table>'
                . '<p class="nota">Estructura preparada para Convenio Multilateral (reparto por jurisdicción); '
                . 'hoy funciona con una sola jurisdicción.</p>';
            PdfExporter::salida('Ingresos Brutos (IIBB)', $rango['texto'], $config, $contenido);
        }

        $this->view('reportes_contables/iibb', $datos);
    }

    // ==== percepciones iibb ====

    // ------------------------------------------------------------------
    // Helpers compartidos
    // ------------------------------------------------------------------

    /** Parámetro GET export: '', 'csv' o 'pdf'. */
    private function export(): string {
        $e = (string)($_GET['export'] ?? '');
        return in_array($e, ['csv', 'pdf'], true) ? $e : '';
    }

    /**
     * Valida el período de GET/POST: rango desde/hasta o mes/año (por defecto mes actual).
     * Devuelve ['desde','hasta','texto','periodo','mes','anio'].
     */
    private function rango(array $params): array {
        $desde = trim((string)($params['desde'] ?? ''));
        $hasta = trim((string)($params['hasta'] ?? ''));

        $d1 = \DateTime::createFromFormat('Y-m-d', $desde);
        $d2 = \DateTime::createFromFormat('Y-m-d', $hasta);
        if($d1 && $d1->format('Y-m-d') === $desde && $d2 && $d2->format('Y-m-d') === $hasta && $d1 <= $d2) {
            return [
                'desde' => $desde, 'hasta' => $hasta,
                'texto' => Fmt::fecha($desde) . ' al ' . Fmt::fecha($hasta),
                'periodo' => substr($desde, 0, 7),
                'mes' => (int)$d1->format('n'), 'anio' => (int)$d1->format('Y'),
            ];
        }

        $mes  = (int)($params['mes'] ?? (int)date('n'));
        $anio = (int)($params['anio'] ?? (int)date('Y'));
        if($mes < 1 || $mes > 12)        $mes  = (int)date('n');
        if($anio < 2000 || $anio > 2100) $anio = (int)date('Y');

        $desde = sprintf('%04d-%02d-01', $anio, $mes);
        $hasta = date('Y-m-t', strtotime($desde));
        return [
            'desde' => $desde, 'hasta' => $hasta,
            'texto' => Fmt::periodoLegible($mes, $anio),
            'periodo' => substr($desde, 0, 7),
            'mes' => $mes, 'anio' => $anio,
        ];
    }

    /** Tabla HTML simple reutilizada por los PDF. */
    private function tablaHtml(array $encabezados, array $filas, ?array $totalesFila, array $numericas = []): string {
        $esc = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');

        $html = '<table><thead><tr>';
        foreach($encabezados as $i => $h) {
            $clase = in_array($i, $numericas, true) ? ' class="num"' : '';
            $html .= '<th' . $clase . '>' . $esc($h) . '</th>';
        }
        $html .= '</tr></thead><tbody>';
        foreach($filas as $fila) {
            $html .= '<tr>';
            foreach($fila as $i => $celda) {
                $clase = in_array($i, $numericas, true) ? ' class="num"' : '';
                $html .= '<td' . $clase . '>' . $esc($celda) . '</td>';
            }
            $html .= '</tr>';
        }
        $html .= '</tbody>';
        if($totalesFila) {
            $html .= '<tfoot><tr>';
            foreach($totalesFila as $i => $celda) {
                $clase = in_array($i, $numericas, true) ? ' class="num"' : '';
                $html .= '<td' . $clase . '>' . $esc($celda) . '</td>';
            }
            $html .= '</tr></tfoot>';
        }
        return $html . '</table>';
    }

    // ==== etapa d/e ====
}
