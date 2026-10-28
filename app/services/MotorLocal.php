<?php
namespace App\Services;

/**
 * ============================================================================
 * MotorLocal — motor de respuestas SIN IA (100% PHP)
 * ============================================================================
 * Pipeline:
 *   1. Normalización: minúsculas, sin tildes, sin signos, sin stopwords.
 *   2. Sinónimos + stemming simple (plurales y terminaciones comunes).
 *   3. Puntúa cada entrada de la base de conocimiento:
 *      - palabras_clave (peso alto, matching por subset de tokens)
 *      - preguntas_ejemplo (overlap de tokens + similar_text p/ typos)
 *      - título (peso medio)
 *      - bonus si la entrada pertenece al módulo de la pantalla actual
 *   4. Umbral configurable: respuesta directa, "¿quisiste decir…?" con
 *      opciones, o "no encontré" (el controlador muestra temas destacados).
 *   5. Filtra SIEMPRE por roles_permitidos de cada entrada.
 *
 * Implementa MotorRespuestaInterface: si mañana se conecta una IA, se crea
 * otra clase con la misma interfaz y AsistenteService elige cuál usar.
 * ============================================================================
 */
class MotorLocal implements MotorRespuestaInterface
{
    /** Puntaje mínimo (0-1) para responder directo. Configurable. */
    public const UMBRAL_RESPUESTA = 0.40;
    /** Puntaje mínimo (0-1) para ofrecer "¿quisiste decir…?". Configurable. */
    public const UMBRAL_OPCIONES = 0.28;
    /** Si el 2do candidato llega a este % del 1ro, se muestran opciones. */
    private const RATIO_AMBIGUO = 0.60;

    /** Módulos relacionados: bonus menor que el módulo exacto de la pantalla. */
    private const MODULOS_RELACIONADOS = [
        'contables'      => ['glosario', 'reportes', 'gastos'],
        'gastos'         => ['contables'],
        'reportes'       => ['contables', 'dashboard'],
        'glosario'       => ['contables'],
        'movimientos'    => ['recibos', 'deudas'],
        'deudas'         => ['movimientos', 'recibos'],
        'recibos'        => ['movimientos', 'deudas'],
        'alquileres'     => ['deudas'],
        'clientes'       => ['notificaciones', 'alquileres'],
        'notificaciones' => ['clientes', 'recibos'],
    ];

    /**
     * Stopwords en español (se quitan del mensaje). Ojo: NO se quitan
     * formas de "estar" (esta/estan) porque forman parte de saludos.
     */
    private const STOPWORDS = [
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'u',
        'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para', 'que', 'se', 'su',
        'sus', 'lo', 'me', 'te', 'le', 'nos', 'es', 'son', 'soy', 'ser', 'como',
        'mi', 'si', 'muy', 'mas', 'pero', 'yo', 'tu', 'usted', 'puedo',
    ];

    /**
     * Mapa de sinónimos → token canónico YA STEMMEADO (parte 1).
     * Se aplica antes del stemming; cubre las familias de palabras que usan
     * la KB y las consultas de datos.
     */
    private const SINONIMOS_1 = [
        // cobrar / pagar
        'cobrar' => 'cobr', 'cobro' => 'cobr', 'cobrada' => 'cobr', 'cobranza' => 'cobr', 'cobre' => 'cobr', 'cobrado' => 'cobr',
        'pagar' => 'pag', 'pago' => 'pag', 'pagos' => 'pag', 'pagado' => 'pag', 'abonar' => 'pag', 'abono' => 'pag', 'abonado' => 'pag', 'saldar' => 'pag',
        // deudas
        'deuda' => 'deud', 'deudas' => 'deud', 'debe' => 'deud', 'deben' => 'deud', 'debo' => 'deud', 'adeuda' => 'deud', 'adeudan' => 'deud', 'adeudado' => 'deud', 'moroso' => 'deud', 'morosos' => 'deud', 'impago' => 'deud', 'impagos' => 'deud',
        // ocupación / plazas
        'ocupacion' => 'ocupad', 'ocupada' => 'ocupad', 'ocupadas' => 'ocupad', 'ocupado' => 'ocupad', 'estacionadas' => 'ocupad',
        'plaza' => 'plaz', 'plazas' => 'plaz', 'cochera' => 'plaz', 'cocheras' => 'plaz', 'lugar' => 'plaz', 'lugares' => 'plaz',
        'libre' => 'libr', 'libres' => 'libr', 'liberar' => 'libr', 'disponible' => 'libr', 'disponibles' => 'libr', 'disponibilidad' => 'libr', 'vacante' => 'libr', 'vacantes' => 'libr',
        // ingresos / caja
        'ingresos' => 'ingres', 'ingreso' => 'entrad', 'recaudacion' => 'recaud', 'recaudo' => 'recaud', 'recaudado' => 'recaud', 'recauda' => 'recaud',
        'facturado' => 'factur', 'facturar' => 'factur', 'facturacion' => 'factur', 'factura' => 'factur', 'facturas' => 'factur',
        'caja' => 'caja', 'ganancia' => 'ganan', 'ganancias' => 'ganan', 'gane' => 'ganan', 'juntamos' => 'recaud',
        // contratos / alquileres
        'contrato' => 'contrat', 'contratos' => 'contrat', 'contratar' => 'contrat',
        'alquiler' => 'alquil', 'alquileres' => 'alquil', 'alquila' => 'alquil', 'alquilar' => 'alquil', 'alquilada' => 'alquil', 'alquiladas' => 'alquil', 'renta' => 'alquil', 'inquilino' => 'alquil',
        'vencen' => 'venc', 'vencer' => 'venc', 'vence' => 'venc', 'vencido' => 'venc', 'vencidos' => 'venc', 'vencimiento' => 'venc', 'vencimientos' => 'venc', 'venzan' => 'venc',
    ];

    /**
     * Sinónimos parte 2: movimientos, autos, impuestos, acciones y UI.
     */
    private const SINONIMOS_2 = [
        // movimientos / autos
        'movimiento' => 'mov', 'movimientos' => 'mov', 'operaciones' => 'oper', 'operacion' => 'oper', 'atendidos' => 'oper',
        'auto' => 'auto', 'autos' => 'auto', 'vehiculo' => 'auto', 'vehiculos' => 'auto', 'movil' => 'auto', 'moviles' => 'auto', 'patente' => 'patent', 'patentes' => 'patent',
        'entradas' => 'entrad', 'entrada' => 'entrad', 'ingresarlo' => 'entrad', 'llegada' => 'entrad', 'llego' => 'entrad', 'estacionar' => 'entrad',
        'salidas' => 'salid', 'salida' => 'salid', 'egreso' => 'salid', 'egresos' => 'salid', 'retiro' => 'salid', 'retira' => 'salid', 'retiran' => 'salid',
        'adentro' => 'dentro', 'dentro' => 'dentro', 'estacionados' => 'dentro', 'activos' => 'activ', 'activo' => 'activ', 'vigentes' => 'activ', 'vigente' => 'activ',
        // clientes / gastos / recibos / impuestos
        'cliente' => 'client', 'clientes' => 'client',
        'gasto' => 'gast', 'gastos' => 'gast', 'compras' => 'compr', 'compra' => 'compr', 'proveedor' => 'compr', 'proveedores' => 'compr', 'erogacion' => 'gast', 'erogaciones' => 'gast',
        'recibo' => 'recib', 'recibos' => 'recib', 'comprobante' => 'recib', 'comprobantes' => 'recib', 'ticket' => 'recib', 'tickets' => 'recib',
        'impuesto' => 'impu', 'impuestos' => 'impu', 'iva' => 'iva', 'iibb' => 'iibb', 'arca' => 'arca', 'afip' => 'arca', 'declaracion' => 'declar', 'declaraciones' => 'declar', 'declarar' => 'declar',
        'debito' => 'debit', 'credito' => 'credit', 'percepcion' => 'percep', 'percepciones' => 'percep', 'retencion' => 'reten', 'retenciones' => 'reten', 'balance' => 'balance', 'balances' => 'balance',
        'fiscal' => 'fiscal', 'fiscales' => 'fiscal', 'contador' => 'contad', 'contadores' => 'contad', 'cuit' => 'cuit',
        // acciones / UI
        'exportar' => 'export', 'exporto' => 'export', 'exporta' => 'export', 'export' => 'export', 'exportacion' => 'export', 'descargar' => 'descarg', 'descarga' => 'descarg', 'descargo' => 'descarg', 'csv' => 'csv', 'excel' => 'csv', 'pdf' => 'pdf',
        'imprimir' => 'impr', 'imprimo' => 'impr', 'impresion' => 'impr', 'imprecion' => 'impr',
        'enviar' => 'env', 'envio' => 'env', 'envia' => 'env', 'mandar' => 'env', 'manda' => 'env', 'mando' => 'env',
        'configurar' => 'config', 'configuracion' => 'config', 'configuro' => 'config', 'ajustes' => 'config', 'smtp' => 'smtp', 'whatsapp' => 'whats', 'correo' => 'mail', 'email' => 'mail', 'mail' => 'mail',
        'crear' => 'cre', 'creo' => 'cre', 'crea' => 'cre', 'nuevo' => 'nuev', 'nueva' => 'nuev', 'alta' => 'alta', 'cargar' => 'carg', 'cargo' => 'carg', 'carga' => 'carg', 'cargado' => 'carg', 'registrar' => 'registr', 'registro' => 'registr', 'registra' => 'registr',
        'hacer' => 'hac', 'hago' => 'hac', 'realizar' => 'hac', 'realizo' => 'hac', 'sacar' => 'sac', 'saco' => 'sac', 'saque' => 'sac', 'sabis' => 'sab', 'saber' => 'sab',
        'podes' => 'pod', 'podemos' => 'pod', 'podria' => 'pod', 'podrias' => 'pod', 'servis' => 'serv', 'sirves' => 'serv', 'sirve' => 'serv',
        'funcionan' => 'funcion', 'funcionas' => 'funcion', 'funciones' => 'funcion', 'funciona' => 'funcion',
        'editar' => 'edit', 'edito' => 'edit', 'modificar' => 'edit', 'modifico' => 'edit', 'cambiar' => 'edit', 'cambio' => 'edit', 'corregir' => 'edit', 'corrijo' => 'edit', 'actualizar' => 'edit', 'anular' => 'edit', 'borrar' => 'borr', 'eliminar' => 'borr', 'borro' => 'borr',
        'ayuda' => 'ayud', 'ayudar' => 'ayud', 'ayudame' => 'ayud', 'paso' => 'pasos', 'gracias' => 'gracias', 'grax' => 'gracias',
        'hola' => 'hola', 'holis' => 'hola', 'chau' => 'chau', 'adios' => 'chau',
        'reportes' => 'report', 'reporte' => 'report', 'informes' => 'report', 'informe' => 'report', 'estadisticas' => 'report',
        'historial' => 'historial', 'notificaciones' => 'notif', 'notificacion' => 'notif', 'avisos' => 'notif', 'aviso' => 'notif', 'avisar' => 'notif', 'notificar' => 'notif',
        'dashboard' => 'inicio', 'inicio' => 'inicio', 'principal' => 'inicio',
        'vale' => 'vale', 'dale' => 'dale', 'perfecto' => 'perfect', 'genial' => 'genial', 'excelente' => 'excelent', 'buenisimo' => 'buenisim', 'increible' => 'increib', 'impecable' => 'impecab', 'util' => 'util',
        'ficha' => 'ficha', 'perfil' => 'ficha', 'detalles' => 'detalle', 'detalle' => 'detalle', 'buscar' => 'busc', 'busco' => 'busc', 'busca' => 'busc', 'buscador' => 'busc',
        'deudores' => 'deud', 'cuentas' => 'cuent', 'cuenta' => 'cuent',
        'tarifa' => 'tarif', 'tarifas' => 'tarif', 'precio' => 'tarif', 'precios' => 'tarif', 'mantenimiento' => 'manten', 'sector' => 'sector', 'sectores' => 'sector',
        'bot' => 'bot', 'asistente' => 'asistent', 'inteligencia' => 'ia', 'ia' => 'ia', 'chatbot' => 'bot',
        // conjugaciones que el stem no cubre
        'facture' => 'factur', 'facturo' => 'factur', 'pague' => 'pag', 'pago' => 'pag', 'gaste' => 'gast', 'gastes' => 'gast',
        'cargue' => 'carg', 'cargues' => 'carg', 'mande' => 'env', 'envie' => 'env', 'saque' => 'sac', 'saque' => 'sac',
        'imprima' => 'impr', 'baje' => 'descarg', 'bajar' => 'descarg', 'manda' => 'env', 'recaude' => 'recaud',
    ];

    /** @var array KB cargada y pre-normalizada. */
    private array $entradas = [];
    private array $pantallas = [];
    private array $sugerencias = [];

    public function __construct(?array $kb = null)
    {
        $kb = $kb ?? require dirname(__DIR__) . '/Bot/conocimiento.php';
        $this->pantallas   = $kb['pantallas'] ?? [];
        $this->sugerencias = $kb['sugerencias'] ?? [];

        // Pre-normaliza la KB una sola vez (keywords, ejemplos y títulos).
        foreach(($kb['entradas'] ?? []) as $e) {
            $kws = [];
            foreach(($e['palabras_clave'] ?? []) as $kw) {
                $kws[] = self::normalizarTokensRaw($kw);
            }
            $ejemplos = [];
            foreach(($e['preguntas_ejemplo'] ?? []) as $pe) {
                $ejemplos[] = [
                    'tokens' => self::normalizarTokens($pe),
                    'raw'    => implode(' ', self::normalizarTokensRaw($pe)),
                ];
            }
            $this->entradas[] = [
                'id'         => $e['id'],
                'modulo'     => $e['modulo'] ?? 'general',
                'titulo'     => $e['titulo'] ?? '',
                'respuesta'  => $e['respuesta'] ?? '',
                'link'       => $e['link'] ?? '',
                'link_texto' => $e['link_texto'] ?? '',
                'roles'      => $e['roles_permitidos'] ?? ['*'],
                'kws'        => $kws,
                'ejemplos'   => $ejemplos,
                'titulo_tokens' => self::normalizarTokens($e['titulo'] ?? ''),
            ];
        }
    }

    /** Sinónimos combinados (partes 1 + 2). */
    private static function sinonimos(): array
    {
        static $map = null;
        if($map === null) {
            $map = self::SINONIMOS_1 + self::SINONIMOS_2;
        }
        return $map;
    }

    /**
     * Paso 1-2 del pipeline: minúsculas, sin tildes, sin signos,
     * sinónimos y stemming. Devuelve un array de tokens.
     * $stopExtra permite sumar stopwords de contexto (consultas de datos).
     */
    public static function normalizarTokens(string $texto, array $stopExtra = []): array
    {
        $tokens = self::normalizarTokensRaw($texto, $stopExtra);

        // stemming simple sobre cada token.
        return array_values(array_map([self::class, 'stem'], $tokens));
    }

    /** Igual que normalizarTokens() pero SIN stemming (para matching literal). */
    public static function normalizarTokensRaw(string $texto, array $stopExtra = []): array
    {
        // minúsculas + quitar tildes/diéresis.
        $texto = mb_strtolower(trim($texto), 'UTF-8');
        $texto = self::quitarTildes($texto);

        // solo letras y números (el resto es separador).
        $texto = preg_replace('/[^a-z0-9]+/', ' ', $texto) ?? ' ';

        $stop = array_merge(self::STOPWORDS, $stopExtra);
        $tokens = [];
        foreach(preg_split('/\s+/', trim($texto)) ?: [] as $t) {
            if($t === '' || strlen($t) < 2) {
                continue; // descarta tokens de 1 letra ("a", "y", "c"...).
            }
            if(in_array($t, $stop, true)) {
                continue;
            }
            // sinónimos → token canónico (ya stemmeado).
            $tokens[] = self::sinonimos()[$t] ?? $t;
        }
        return $tokens;
    }

    /** Quita tildes/diéresis manteniendo UTF-8. */
    public static function quitarTildes(string $s): string
    {
        $trans = ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n','Á'=>'a','É'=>'e','Í'=>'i','Ó'=>'o','Ú'=>'u'];
        return strtr($s, $trans);
    }

    /**
     * Stemming simple para español: plurales (-s, -es), terminaciones de
     * verbos (-ar/-er/-ir, -ando/-iendo) y derivaciones (-ción, -mente...).
     * Corto a propósito: prioriza precisión sobre cobertura lingüística.
     */
    public static function stem(string $t): string
    {
        if(strlen($t) <= 4) {
            return $t; // "iva", "caja", "pdf"... no se tocan.
        }
        $sufijos = ['amiento', 'imiento', 'aciones', 'uciones', 'ancia', 'encia', 'mente', 'cion', 'sion', 'ando', 'iendo', 'adoras', 'adores', 'acias', 'ecer', 'aria', 'eria', 'ista', 'oso', 'osa', 'ivos', 'ivas', 'ar', 'er', 'ir', 'as', 'es', 'os', 's'];
        foreach($sufijos as $suf) {
            if(strlen($t) > strlen($suf) + 2 && str_ends_with($t, $suf)) {
                return substr($t, 0, -strlen($suf));
            }
        }
        return $t;
    }

    /**
     * Pipeline principal: puntúa toda la KB y decide entre
     * respuesta directa / opciones ("¿quisiste decir…?") / no encontrado.
     */
    public function responder(string $mensaje, array $contexto = []): array
    {
        $pantalla = (string)($contexto['pantalla'] ?? '');
        $roles    = (array)($contexto['roles'] ?? ['*']);
        $modulo   = $this->moduloDePantalla($pantalla);

        $tokens = self::normalizarTokens($mensaje);
        if($tokens === []) {
            return ['tipo' => 'no_encontrado'];
        }
        $rawTxt = implode(' ', $tokens);

        $candidatos = [];
        foreach($this->entradas as $e) {
            if(!$this->rolPermitido($roles, $e['roles'])) {
                continue;
            }
            $p = $this->puntuar($tokens, $rawTxt, $e, $modulo);
            if($p > 0) {
                $candidatos[] = ['entrada' => $e, 'puntaje' => $p];
            }
        }

        if($candidatos === []) {
            return ['tipo' => 'no_encontrado'];
        }

        usort($candidatos, fn($a, $b) => $b['puntaje'] <=> $a['puntaje']);
        $mejor = $candidatos[0];

        if($mejor['puntaje'] >= self::UMBRAL_RESPUESTA) {
            // ¿Hay un 2do candidato cercano? → ofrecer opciones también.
            $res = [
                'tipo'    => 'respuesta',
                'entrada' => $mejor['entrada'],
                'puntaje' => round($mejor['puntaje'], 3),
            ];
            if(isset($candidatos[1])
                && $candidatos[1]['puntaje'] >= self::UMBRAL_OPCIONES
                && $candidatos[1]['puntaje'] >= $mejor['puntaje'] * self::RATIO_AMBIGUO) {
                $res['opciones'] = array_slice(array_map(
                    fn($c) => ['id' => $c['entrada']['id'], 'titulo' => $c['entrada']['titulo']],
                    array_slice($candidatos, 1, 2)
                ), 0, 2);
            }
            return $res;
        }

        if($mejor['puntaje'] >= self::UMBRAL_OPCIONES) {
            return [
                'tipo'     => 'opciones',
                'opciones' => array_slice(array_map(
                    fn($c) => ['id' => $c['entrada']['id'], 'titulo' => $c['entrada']['titulo']],
                    $candidatos
                ), 0, 3),
                'puntaje'  => round($mejor['puntaje'], 3),
            ];
        }

        return ['tipo' => 'no_encontrado'];
    }

    /** Responde por id exacto (botones "¿quisiste decir…?" y sugerencias). */
    public function responderPorId(string $id, array $roles = ['*']): ?array
    {
        foreach($this->entradas as $e) {
            if($e['id'] === $id && $this->rolPermitido($roles, $e['roles'])) {
                return ['tipo' => 'respuesta', 'entrada' => $e, 'puntaje' => 1.0];
            }
        }
        return null;
    }

    /** Lista de ids válidos de la KB. */
    public function idsValidos(): array
    {
        return array_column($this->entradas, 'id');
    }

    /**
     * Puntúa una entrada contra el mensaje (0 a ~1.4 con bonus):
     *  - keywords: 0.55 × frases-clave presentes (subset de tokens), tope 0.80
     *  - ejemplos: overlap de tokens (Jaccard) + similar_text (typos)
     *  - título:   overlap moderado
     *  - bonus módulo de pantalla actual (+0.10) o relacionado (+0.05)
     */
    private function puntuar(array $tokens, string $rawTxt, array $e, ?string $modulo): float
    {
        $score = 0.0;
        $tokenSet = array_fill_keys($tokens, true);

        // 1) Palabras clave (frase = subset de tokens, en cualquier orden).
        foreach($e['kws'] as $kwTokens) {
            if($kwTokens !== [] && !array_diff($kwTokens, $tokens)) {
                $score += 0.55 * count($kwTokens);
            }
        }
        $score = min(0.80, $score);

        // 2) Preguntas de ejemplo: overlap + tolerancia a errores de tipeo.
        $mejorEj = 0.0;
        foreach($e['ejemplos'] as $ej) {
            $ejTokens = $ej['tokens'];
            if($ejTokens === []) {
                continue;
            }
            $inter = count(array_intersect_key($tokenSet, array_fill_keys($ejTokens, true)));
            $union = count($tokenSet + array_fill_keys($ejTokens, true));
            $jaccard = $union > 0 ? $inter / $union : 0.0;

            similar_text($rawTxt, $ej['raw'], $simPct);
            $mejorEj = max($mejorEj, (0.7 * $jaccard) + (0.3 * ($simPct / 100.0)));
        }
        $score += 0.35 * $mejorEj;

        // 3) Título (peso medio).
        if($e['titulo_tokens'] !== []) {
            $inter = count(array_intersect_key($tokenSet, array_fill_keys($e['titulo_tokens'], true)));
            $score += 0.10 * min(1.0, $inter / count($e['titulo_tokens']));
        }

        // 4) Bonus por pantalla actual.
        if($modulo !== null) {
            if($e['modulo'] === $modulo) {
                $score += 0.10;
            } elseif(in_array($e['modulo'], self::MODULOS_RELACIONADOS[$modulo] ?? [], true)) {
                $score += 0.05;
            }
        }

        return $score;
    }

    /** Temas destacados para el mensaje "no encontré eso". */
    public function temasDestacados(): array
    {
        $ids = ['conv_que_podes_hacer', 'mov_ingreso', 'mov_egreso', 'alq_nuevo_contrato', 'glo_iva', 'gastos_crear'];
        $temas = [];
        foreach($ids as $id) {
            foreach($this->entradas as $e) {
                if($e['id'] === $id) {
                    $temas[] = ['texto' => $e['titulo'], 'mensaje' => $e['titulo']];
                    continue 2;
                }
            }
        }
        return $temas;
    }

    /** Sugerencias del módulo de la pantalla actual (bienvenida del widget). */
    public function sugerenciasPorPantalla(string $pantalla): array
    {
        $default = [
            ['texto' => '¿Qué podés hacer?', 'mensaje' => '¿Qué podés hacer?'],
            ['texto' => '¿Cuántos lugares libres hay?', 'mensaje' => '¿Cuántos lugares libres hay?'],
            ['texto' => '¿Cuál es la deuda total?', 'mensaje' => '¿Cuál es la deuda total?'],
        ];
        return $this->sugerencias[$this->moduloDePantalla($pantalla) ?? ''] ?? $default;
    }

    /** Resuelve el módulo actual a partir de la ruta (prefijo más largo). */
    public function moduloDePantalla(string $ruta): ?string
    {
        $ruta = '/' . trim($ruta, '/');
        $mejorLen = 0;
        $modulo = null;
        foreach($this->pantallas as $prefijo => $mod) {
            if(str_starts_with($ruta, $prefijo) && strlen($prefijo) > $mejorLen) {
                $mejorLen = strlen($prefijo);
                $modulo = $mod;
            }
        }
        return $modulo;
    }

    /** ¿Los roles del usuario habilitan la entrada? ['*'] = sin restricción. */
    public function rolPermitido(array $rolesUsuario, array $rolesNecesarios): bool
    {
        return in_array('*', $rolesNecesarios, true)
            || array_intersect($rolesUsuario, $rolesNecesarios) !== [];
    }
}
