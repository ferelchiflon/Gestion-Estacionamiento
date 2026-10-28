<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\ConfiguracionFiscal;

/**
 * Configuración fiscal del negocio (etapa a del módulo contable).
 * Alimenta los reportes de IVA / IIBB / ARCA, el encabezado de los PDF
 * y el envío de reportes al contador.
 */
class ConfiguracionFiscalController extends Controller {

    public function index() {
        $this->view('configuracion_fiscal/index', [
            'config'      => (new ConfiguracionFiscal())->obtener(),
            'condiciones' => [
                'responsable_inscripto' => 'Responsable Inscripto',
                'monotributo'           => 'Monotributo',
                'exento'                => 'Exento',
            ]
        ]);
    }

    public function guardar() {
        $datos = $this->leerYNormalizar($_POST);

        $errores = $this->validar($datos);

        if(!empty($errores)) {
            $_SESSION['error'] = 'No se guardó la configuración: ' . implode(' ', $errores);
        } else {
            $datos['actualizado_en'] = date('Y-m-d H:i:s');
            (new ConfiguracionFiscal())->guardar($datos);
            $_SESSION['success'] = 'Configuración fiscal guardada.';
        }

        $this->redirect('/configuracion-fiscal');
    }

    /** Toma solo los campos permitidos y normaliza tipos. */
    private function leerYNormalizar(array $post): array {
        $texto = function($clave, $max) use ($post) {
            $valor = trim((string)($post[$clave] ?? ''));
            return mb_substr($valor, 0, $max);
        };

        return [
            'razon_social'        => $texto('razon_social', 120),
            'cuit'                => $texto('cuit', 13),
            'condicion_iva'       => in_array($post['condicion_iva'] ?? '', ['responsable_inscripto','monotributo','exento'], true)
                                        ? $post['condicion_iva'] : 'responsable_inscripto',
            'alicuota_iva'        => str_replace(',', '.', trim((string)($post['alicuota_iva'] ?? '21'))),
            'alicuota_iibb'       => str_replace(',', '.', trim((string)($post['alicuota_iibb'] ?? '3'))),
            'jurisdiccion_iibb'   => $texto('jurisdiccion_iibb', 60),
            'nro_inscripcion_iibb'=> $texto('nro_inscripcion_iibb', 30),
            'punto_venta'         => (int)($post['punto_venta'] ?? 1),
            'email_contador'      => $texto('email_contador', 120),
            'inicio_actividades'  => $this->fechaOpcional($post['inicio_actividades'] ?? ''),
            'direccion'           => $texto('direccion', 150),
            'telefono'            => $texto('telefono', 30),
        ];
    }

    private function fechaOpcional($valor): ?string {
        $valor = trim((string)$valor);
        if($valor === '') return null;
        $d = \DateTime::createFromFormat('Y-m-d', $valor);
        return ($d && $d->format('Y-m-d') === $valor) ? $valor : null;
    }

    /** @return string[] lista de errores de validación */
    private function validar(array $d): array {
        $errores = [];

        if($d['cuit'] !== '' && !preg_match('/^\d{2}-\d{8}-\d$/', $d['cuit'])) {
            $errores[] = 'El CUIT debe tener el formato 20-12345678-9.';
        }
        foreach(['alicuota_iva' => 'alícuota de IVA', 'alicuota_iibb' => 'alícuota de IIBB'] as $campo => $etiqueta) {
            if(!is_numeric($d[$campo]) || (float)$d[$campo] < 0 || (float)$d[$campo] > 100) {
                $errores[] = "La {$etiqueta} debe ser un número entre 0 y 100.";
            }
        }
        if($d['punto_venta'] < 1 || $d['punto_venta'] > 9999) {
            $errores[] = 'El punto de venta debe estar entre 1 y 9999.';
        }
        if($d['email_contador'] !== '' && !filter_var($d['email_contador'], FILTER_VALIDATE_EMAIL)) {
            $errores[] = 'El email del contador no es válido.';
        }

        return $errores;
    }
}
