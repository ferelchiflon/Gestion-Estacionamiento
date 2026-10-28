<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\BotConversacion;
use App\Services\AsistenteService;

/**
 * Endpoints del asistente (bot de ayuda).
 *  POST /bot/mensaje   → pregunta del usuario → JSON (respuesta/opciones/temas)
 *  POST /bot/feedback  → "¿Te sirvió?" sí/no sobre una conversación
 *  POST /bot/limpiar   → borra el historial de sesión
 *  GET  /bot/admin     → panel para mejorar la base de conocimiento
 *
 * Notas:
 * - El proyecto no usa tokens CSRF (decisión documentada del Paso 0);
 *   los endpoints son POST mismo-origin y de solo lectura/feedback.
 * - Todos los datos salientes se escapan en AsistenteService::renderMd().
 */
class BotController extends Controller
{
    private AsistenteService $asistente;

    public function __construct()
    {
        $this->asistente = new AsistenteService();
    }

    /** POST /bot/mensaje — admite texto libre o entrada_id (botón). */
    public function mensaje()
    {
        $pantalla = (string)($_POST['pantalla'] ?? $_GET['pantalla'] ?? '');
        $entradaId = trim((string)($_POST['entrada_id'] ?? ''));

        if($entradaId !== '') {
            $res = $this->asistente->elegir($entradaId, $pantalla);
        } else {
            $texto = (string)($_POST['mensaje'] ?? '');
            $res = $this->asistente->procesar($texto, $pantalla);
        }

        $this->json($res);
    }

    /** POST /bot/feedback — marca util='si'|'no' en la conversación. */
    public function feedback()
    {
        $id   = (int)($_POST['id'] ?? 0);
        $util = (string)($_POST['util'] ?? '');

        if($id <= 0 || !in_array($util, ['si', 'no'], true)) {
            $this->json(['ok' => false, 'error' => 'Datos inválidos'], 422);
            return;
        }

        $ok = (new BotConversacion())->marcarUtil($id, $util);
        $this->json(['ok' => $ok]);
    }

    /** POST /bot/limpiar — resetea el historial de la sesión. */
    public function limpiar()
    {
        $this->asistente->limpiar();
        $this->json(['ok' => true]);
    }

    /** GET /bot/admin — preguntas sin respuesta, frecuentes y feedback. */
    public function admin()
    {
        $model = new BotConversacion();
        $kb = require dirname(__DIR__) . '/Bot/conocimiento.php';
        $titulos = [];
        foreach(($kb['entradas'] ?? []) as $e) {
            $titulos[$e['id']] = $e['titulo'];
        }

        $this->view('bot/admin', [
            'titulo'        => 'Asistente · Base de conocimiento',
            'stats'         => $model->stats(),
            'sinRespuesta'  => $model->sinRespuesta(50),
            'frecuentes'    => $model->sinRespuestaFrecuentes(15),
            'noUtiles'      => $model->noUtiles(50),
            'utilesPorTema' => $model->utilesPorTema(15),
            'titulos'       => $titulos,
            'kbVersion'     => (string)($kb['version'] ?? ''),
            'kbTotal'       => count($kb['entradas'] ?? []),
        ]);
    }
}
