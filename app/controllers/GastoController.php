<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Gasto;

/**
 * ABM de gastos/compras (libro de compras).
 * Alimenta los reportes de IVA Compras, IIBB y Balance.
 * El total SIEMPRE se recalcula en el servidor a partir de los componentes.
 */
class GastoController extends Controller {

    private const TIPOS_COMPROBANTE = ['Factura A', 'Factura B', 'Factura C', 'Presupuesto', 'Recibo', 'Ticket', 'Otro'];
    private const FORMAS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'mercadopago', 'otro'];

    public function index() {
        [$desde, $hasta, $mes, $anio] = $this->rangoPeriodo($_GET);

        $gastoModel = new Gasto();
        $this->view('gastos/index', [
            'gastos'  => $gastoModel->listar($desde, $hasta),
            'totales' => $gastoModel->totales($desde, $hasta),
            'mes'     => $mes,
            'anio'    => $anio,
        ]);
    }

    public function crearForm() {
        $this->mostrarFormulario(null);
    }

    public function guardar() {
        $datos   = $this->leerYCalcular($_POST);
        $errores = $this->validar($datos);

        if($errores) {
            $_SESSION['error'] = 'No se guardó el gasto: ' . implode(' ', $errores);
        } else {
            (new Gasto())->insert($datos);
            $_SESSION['success'] = 'Gasto registrado.';
        }
        $this->redirect('/gastos');
    }

    public function editarForm($id) {
        $gasto = (new Gasto())->findConCategoria($id);
        if(!$gasto) {
            $_SESSION['error'] = 'Gasto no encontrado';
            $this->redirect('/gastos');
        }
        $this->mostrarFormulario($gasto);
    }

    public function actualizar() {
        $id         = (int)($_POST['id'] ?? 0);
        $gastoModel = new Gasto();
        $datos      = $this->leerYCalcular($_POST);
        $errores    = $this->validar($datos);

        if(!$gastoModel->find($id)) {
            $errores[] = 'el gasto a editar no existe.';
        }
        if($errores) {
            $_SESSION['error'] = 'No se actualizó el gasto: ' . implode(' ', $errores);
        } else {
            $gastoModel->update($id, $datos);
            $_SESSION['success'] = 'Gasto actualizado.';
        }
        $this->redirect('/gastos');
    }

    public function eliminar() {
        $id = (int)($_POST['id'] ?? 0);
        if($id > 0 && (new Gasto())->delete($id)) {
            $_SESSION['success'] = 'Gasto eliminado.';
        } else {
            $_SESSION['error'] = 'No se pudo eliminar el gasto.';
        }
        $this->redirect('/gastos');
    }

    // ------------------------------------------------------------------
    // Helpers privados
    // ------------------------------------------------------------------

    private function mostrarFormulario(?array $gasto) {
        $this->view('gastos/formulario', [
            'gasto'             => $gasto,
            'categorias'        => (new Gasto())->categorias(),
            'tipos_comprobante' => self::TIPOS_COMPROBANTE,
            'formas_pago'       => self::FORMAS_PAGO,
        ]);
    }

    /** Valida mes/año de GET y devuelve [desde, hasta, mes, anio] (por defecto: mes actual). */
    private function rangoPeriodo(array $get): array {
        $mes  = (int)($get['mes'] ?? (int)date('n'));
        $anio = (int)($get['anio'] ?? (int)date('Y'));
        if($mes < 1 || $mes > 12)        $mes  = (int)date('n');
        if($anio < 2000 || $anio > 2100) $anio = (int)date('Y');

        $desde = sprintf('%04d-%02d-01', $anio, $mes);
        $hasta = date('Y-m-t', strtotime($desde));
        return [$desde, $hasta, $mes, $anio];
    }

    /** Lee el POST, normaliza montos y recalcula el total en el servidor. */
    private function leerYCalcular(array $post): array {
        $texto = function($clave, $max) use ($post) {
            return mb_substr(trim((string)($post[$clave] ?? '')), 0, $max);
        };
        $enteroOpcional = function($clave) use ($post) {
            $valor = trim((string)($post[$clave] ?? ''));
            return ($valor !== '' && (int)$valor > 0) ? (int)$valor : null;
        };
        $seleccion = function($clave, array $opciones, $defecto) use ($post) {
            $valor = (string)($post[$clave] ?? '');
            return in_array($valor, $opciones, true) ? $valor : $defecto;
        };

        $d = [
            'fecha'               => $texto('fecha', 10),
            'proveedor'           => $texto('proveedor', 120),
            'cuit_proveedor'      => $texto('cuit_proveedor', 13),
            'tipo_comprobante'    => $seleccion('tipo_comprobante', self::TIPOS_COMPROBANTE, 'Factura C'),
            'punto_venta'         => $enteroOpcional('punto_venta'),
            'numero_comprobante'  => $enteroOpcional('numero_comprobante'),
            'neto_gravado'        => $this->monto($post['neto_gravado'] ?? 0),
            'iva_21'              => $this->monto($post['iva_21'] ?? 0),
            'iva_105'             => $this->monto($post['iva_105'] ?? 0),
            'iva_27'              => $this->monto($post['iva_27'] ?? 0),
            'no_gravado'          => $this->monto($post['no_gravado'] ?? 0),
            'percepcion_iva'      => $this->monto($post['percepcion_iva'] ?? 0),
            'percepcion_iibb'     => $this->monto($post['percepcion_iibb'] ?? 0),
            'categoria_id'        => $enteroOpcional('categoria_id'),
            'forma_pago'          => $seleccion('forma_pago', self::FORMAS_PAGO, 'otro'),
            'notas'               => $texto('notas', 255),
        ];

        $d['total'] = round(
            $d['neto_gravado'] + $d['iva_21'] + $d['iva_105'] + $d['iva_27']
            + $d['no_gravado'] + $d['percepcion_iva'] + $d['percepcion_iibb'],
            2
        );

        return $d;
    }

    /** Acepta "1234,56", "1.234,56" o "1234.56" y devuelve float >= 0. */
    private function monto($valor): float {
        $v = str_replace(['$', ' '], '', trim((string)$valor));
        if(strpos($v, ',') !== false) {
            $v = str_replace('.', '', $v);
            $v = str_replace(',', '.', $v);
        }
        return max(0.0, (float)$v);
    }

    /** @return string[] errores de validación */
    private function validar(array $d): array {
        $errores = [];

        $fecha = \DateTime::createFromFormat('Y-m-d', $d['fecha']);
        if(!$fecha || $fecha->format('Y-m-d') !== $d['fecha']) {
            $errores[] = 'la fecha es obligatoria (formato AAAA-MM-DD).';
        }
        if($d['proveedor'] === '') {
            $errores[] = 'el proveedor es obligatorio.';
        }
        if($d['cuit_proveedor'] !== '' && !preg_match('/^\d{2}-\d{8}-\d$/', $d['cuit_proveedor'])) {
            $errores[] = 'el CUIT del proveedor debe tener el formato 20-12345678-9.';
        }
        if($d['punto_venta'] !== null && ($d['punto_venta'] < 1 || $d['punto_venta'] > 9999)) {
            $errores[] = 'el punto de venta debe estar entre 1 y 9999.';
        }
        if($d['numero_comprobante'] !== null && ($d['numero_comprobante'] < 1 || $d['numero_comprobante'] > 99999999)) {
            $errores[] = 'el número de comprobante debe estar entre 1 y 99999999.';
        }
        foreach(['neto_gravado', 'iva_21', 'iva_105', 'iva_27', 'no_gravado', 'percepcion_iva', 'percepcion_iibb'] as $campo) {
            if($d[$campo] < 0 || $d[$campo] > 999999999) {
                $errores[] = 'alguno de los importes es inválido.';
                break;
            }
        }
        if($d['categoria_id'] !== null) {
            $existe = (new Gasto())->db->query(
                "SELECT 1 FROM categorias_gasto WHERE id = ?", [$d['categoria_id']]
            )->fetch();
            if(!$existe) {
                $errores[] = 'la categoría seleccionada no existe.';
            }
        }

        return $errores;
    }
}
