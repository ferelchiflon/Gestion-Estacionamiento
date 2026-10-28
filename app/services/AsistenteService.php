<?php
namespace App\Services;

use App\Models\BotConversacion;

/**
 * ============================================================================
 * AsistenteService — orquestador del bot de ayuda
 * ============================================================================
 * - Autenticación: exige sesión iniciada (hoy no hay login; cuando exista,
 *   getRolesUsuario() devolverá los roles reales y el filtro se activa).
 * - Rate limit simple por sesión: MAX_POR_HORA mensajes cada VENTANA segs.
 * - Largo máximo de mensaje: MAX_LARGO (300).
 * - Historial corto en sesión (últimos HISTORIAL_MAX mensajes).
 * - Persistencia en bot_conversaciones (falla en silencio si no existe).
 * - Render seguro: TODO se escapa (XSS); solo se permiten negritas,
 *   cursivas, listas ("- ") y links internos generados por el sistema.
 * - Prioridad: 1) consultas de datos (lista blanca) 2) base de conocimiento.
 *   Si el usuario pide ACCIONES (cobrar, borrar...), nunca las ejecuta:
   * el motor responde el paso a paso y manda a la pantalla.
 * ============================================================================
 */
class AsistenteService
{
    public const MAX_LARGO     = 300;
    public const MAX_POR_HORA  = 60;
    public const VENTANA       = 3600;
    public const HISTORIAL_MAX = 10;

    private MotorLocal $motor;
    private ConsultasDatos $consultas;

    /** Link sugerido según la intención de datos resuelta. */
    private const LINK_DATOS = [
        'ocupacion'            => ['/reportes/ocupacion', 'Ver ocupación'],
        'ingresos_mes'         => ['/reportes/caja', 'Ver reporte de caja'],
        'operaciones_mes'      => ['/movimientos/historial', 'Ver historial'],
        'deuda_total'          => ['/reportes/deudas', 'Ver deudas'],
        'contratos_por_vencer' => ['/alquileres/contratos', 'Ver contratos'],
        'contratos_activos'    => ['/alquileres/contratos', 'Ver contratos'],
    ];

    public function __construct(?MotorLocal $motor = null)
    {
        $this->motor     = $motor ?? new MotorLocal();
        $this->consultas = new ConsultasDatos();
        $this->asegurarSesion();
    }

    /** Procesa un mensaje del usuario y devuelve el payload para el widget. */
    public function procesar(string $texto, string $pantalla): array
    {
        // Sesión + límites.
        if(!$this->haySesion()) {
            return $this->error('Tu sesión expiró. Recargá la página e intentá de nuevo.');
        }
        $limite = $this->rateLimitOk();
        if(!$limite) {
            return $this->error('Consultaste muchas veces seguidas 🙏 Esperá un ratito y seguímos.');
        }

        $texto   = trim(mb_substr($texto, 0, self::MAX_LARGO, 'UTF-8'));
        $pantalla = trim(mb_substr($pantalla, 0, 200, 'UTF-8'));
        if($texto === '') {
            return $this->error('Escribime una pregunta así te puedo ayudar 🙂');
        }

        // 1) ¿Es una consulta de datos (lista blanca, solo lectura)?
        $roles   = $this->getRolesUsuario();
        $entrada = null;
        $res     = null;
        $datos   = $this->consultas->resolver($texto, $pantalla, $roles);

        if($datos !== null) {
            $html = $this->renderMd(
                '**' . $datos['data']['titulo'] . "**\n" . implode("\n", $datos['data']['lineas'])
            );
            [$link, $linkTexto] = self::LINK_DATOS[$datos['intencion']] ?? ['', ''];
            $html .= $this->linkHtml($link, $linkTexto);
            $entradaId = 'datos_' . $datos['intencion'];
            $tipo = 'respuesta';
        } else {
            // 2) Base de conocimiento.
            $res = $this->motor->responder($texto, ['pantalla' => $pantalla, 'roles' => $roles]);
            $tipo = $res['tipo'];
            $entradaId = $res['entrada']['id'] ?? null;

            if($tipo === 'respuesta') {
                $html = $this->renderMd($res['entrada']['respuesta']);
                if(($res['entrada']['link'] ?? '') !== '') {
                    $html .= $this->linkHtml($res['entrada']['link'], $res['entrada']['link_texto'] ?: 'Ir');
                }
            } elseif($tipo === 'opciones') {
                $html = $this->renderMd('No estoy seguro de qué necesitás. ¿Quisiste decir…?');
            } else {
                $html = $this->renderMd(
                    "Uhm… esa no la tengo 🤔 Todavía aprendo los temas del sistema.\nProbá con alguna de estas preguntas:"
                );
            }
        }

        // 3) Opciones "¿quisiste decir…?" y temas destacados.
        $opciones = [];
        $temas = [];
        if($tipo === 'opciones') {
            $opciones = $res['opciones'] ?? [];
        } elseif($tipo === 'no_encontrado') {
            $temas = $this->motor->temasDestacados();
        }

        // 4) Persistencia + historial de sesión.
        $conversacionId = $this->persistir($texto, $tipo === 'respuesta' ? $html : null, $entradaId, $res['puntaje'] ?? null, $pantalla, $tipo === 'no_encontrado');
        $this->guardarEnHistorial($texto, $html);

        return [
            'ok'       => true,
            'tipo'     => $tipo,
            'html'     => $html,
            'opciones' => $opciones,
            'temas'    => $temas,
            'conv_id'  => $conversacionId,
        ];
    }

    /** Respuesta por id de KB (botones de sugerencia / "¿quisiste decir…?"). */
    public function elegir(string $id, string $pantalla): array
    {
        if(!$this->haySesion() || !preg_match('/^[a-z0-9_]{2,60}$/i', $id)) {
            return $this->error('No pude identificar esa opción.');
        }
        $res = $this->motor->responderPorId($id, $this->getRolesUsuario());
        if($res === null) {
            return $this->error('Esa opción ya no está disponible.');
        }

        $html = $this->renderMd($res['entrada']['respuesta']);
        if(($res['entrada']['link'] ?? '') !== '') {
            $html .= $this->linkHtml($res['entrada']['link'], $res['entrada']['link_texto'] ?: 'Ir');
        }

        $conversacionId = $this->persistir('[opción] ' . $res['entrada']['titulo'], $html, $res['entrada']['id'], 1.0, $pantalla, false);
        $this->guardarEnHistorial($res['entrada']['titulo'], $html);

        return ['ok' => true, 'tipo' => 'respuesta', 'html' => $html, 'opciones' => [], 'temas' => [], 'conv_id' => $conversacionId];
    }

    /** Historial de sesión (para reabrir el widget con contexto). */
    public function historial(): array
    {
        $this->asegurarSesion();
        return $_SESSION['bot_historial'] ?? [];
    }

    /**
     * Sugerencias de bienvenida según la pantalla actual.
     * Acepta REQUEST_URI completo (con query y eventual subcarpeta de BASE_URL)
     * y lo reduce a la ruta interna ("/movimientos/ingreso").
     */
    public function getSugerenciasBienvenida(string $uri): array
    {
        // Quita query string.
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        // Quita el prefijo de BASE_URL si existe (ej. "/gestion" en "/gestion/dashboard").
        $base = parse_url(BASE_URL, PHP_URL_PATH) ?? '';
        if($base !== '' && $base !== '/' && str_starts_with($path, $base)) {
            $path = substr($path, strlen($base)) ?: '/';
        }
        if($path === '' || $path[0] !== '/') {
            $path = '/' . ltrim($path, '/');
        }

        $sugerencias = $this->motor->sugerenciasPorPantalla($path);

        // Fallback genérico si la pantalla no tiene sugerencias propias.
        if($sugerencias === []) {
            $sugerencias = [
                ['texto' => '¿Qué podés hacer?', 'mensaje' => '¿Qué podés hacer?'],
                ['texto' => '¿Cuántos lugares libres hay?', 'mensaje' => '¿Cuántos lugares libres hay?'],
                ['texto' => '¿Cuál es la deuda total?', 'mensaje' => '¿Cuál es la deuda total?'],
                ['texto' => '¿Qué es el IVA?', 'mensaje' => '¿Qué es el IVA?'],
            ];
        }
        return $sugerencias;
    }

    /** Limpia el historial de sesión (botón "limpiar conversación"). */
    public function limpiar(): void
    {
        $this->asegurarSesion();
        unset($_SESSION['bot_historial'], $_SESSION['bot_conv_ids']);
    }

    // ------------------------------------------------------------------
    // Sesión / límites / roles
    // ------------------------------------------------------------------

    private function asegurarSesion(): void
    {
        if(session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
    }

    private function haySesion(): bool
    {
        return session_status() === PHP_SESSION_ACTIVE;
    }

    /** Roles del usuario actual. Hoy: ['*'] (sin login). Placeholder futuro. */
    public function getRolesUsuario(): array
    {
        return ['*'];
    }

    /** Rate limit por sesión: MAX_POR_HORA cada VENTANA segundos. */
    private function rateLimitOk(): bool
    {
        $now = time();
        $rate = $_SESSION['bot_rate'] ?? ['inicio' => $now, 'count' => 0];
        if(($now - $rate['inicio']) > self::VENTANA) {
            $rate = ['inicio' => $now, 'count' => 0];
        }
        if($rate['count'] >= self::MAX_POR_HORA) {
            $_SESSION['bot_rate'] = $rate;
            return false;
        }
        $rate['count']++;
        $_SESSION['bot_rate'] = $rate;
        return true;
    }

    // ------------------------------------------------------------------
    // Persistencia / historial
    // ------------------------------------------------------------------

    private function persistir(?string $pregunta, ?string $respuesta, ?string $entradaId, ?float $puntaje, string $pantalla, bool $sinRespuesta): ?int
    {
        try {
            $model = new BotConversacion();
            return $model->registrar([
                'usuario_id'    => null, // cuando haya login: id real del usuario.
                'sesion_id'     => substr((string)session_id(), 0, 64),
                'pregunta'      => mb_substr((string)$pregunta, 0, 300, 'UTF-8'),
                'respuesta'     => $respuesta !== null ? strip_tags($respuesta) : null,
                'entrada_id'    => $entradaId,
                'puntaje'       => $puntaje,
                'pantalla'      => mb_substr($pantalla, 0, 200, 'UTF-8'),
                'sin_respuesta' => $sinRespuesta ? 1 : 0,
            ]) ?: null;
        } catch(\Throwable $e) {
            return null; // El bot nunca rompe la app por la tabla de logs.
        }
    }

    private function guardarEnHistorial(string $pregunta, string $html): void
    {
        $hist = $_SESSION['bot_historial'] ?? [];
        $hist[] = ['pregunta' => $pregunta, 'respuesta' => $html];
        $_SESSION['bot_historial'] = array_slice($hist, -self::HISTORIAL_MAX);
    }

    // ------------------------------------------------------------------
    // Render seguro (XSS): solo negrita, cursiva, listas y links internos
    // ------------------------------------------------------------------

    /** Markdown-lite: **negrita**, *cursiva*, líneas "- " → <ul>, saltos. */
    public static function renderMd(string $texto): string
    {
        $lineas = preg_split('/\r\n|\r|\n/', $texto) ?: [];
        $html = '';
        $enLista = false;

        foreach($lineas as $linea) {
            $linea = trim($linea);
            if($linea === '') {
                continue;
            }
            if(preg_match('/^[-•]\s+(.*)$/', $linea, $m)) {
                if(!$enLista) {
                    $html .= '<ul class="bot-md-ul">';
                    $enLista = true;
                }
                $html .= '<li>' . self::inline($m[1]) . '</li>';
                continue;
            }
            if($enLista) {
                $html .= '</ul>';
                $enLista = false;
            }
            $html .= '<p class="bot-md-p">' . self::inline($linea) . '</p>';
        }
        if($enLista) {
            $html .= '</ul>';
        }
        return $html;
    }

    /** Escapa y aplica negrita/cursiva sobre texto YA escapado. */
    private static function inline(string $s): string
    {
        $s = htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
        $s = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $s) ?? $s;
        $s = preg_replace('/(?<!\*)\*([^*\n]+)\*(?!\*)/s', '<em>$1</em>', $s) ?? $s;
        return $s;
    }

    /** Botón de link interno (href construido por el sistema, no por texto). */
    private function linkHtml(string $ruta, string $texto): string
    {
        if($ruta === '' || !preg_match('#^[a-z0-9/\-_{}]+$#i', $ruta)) {
            return '';
        }
        $url = rtrim(BASE_URL, '/') . $ruta;
        $texto = htmlspecialchars($texto !== '' ? $texto : 'Ir', ENT_QUOTES, 'UTF-8');
        return '<a class="bot-link-btn" href="' . $url . '"><i class="fa-solid fa-arrow-right"></i> ' . $texto . '</a>';
    }

    /** Payload de error uniforme. */
    private function error(string $mensaje): array
    {
        return ['ok' => false, 'tipo' => 'error', 'html' => self::renderMd($mensaje), 'opciones' => [], 'temas' => [], 'conv_id' => null];
    }
}
