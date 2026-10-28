<?php
/**
 * ============================================================================
 * Widget del asistente (bot) — se incluye UNA sola vez desde footer.php.
 * ============================================================================
 * - Botón flotante + panel de chat (Bootstrap ya está cargado; el widget usa
 *   sus propias clases bot-* para no interferir).
 * - $sugerencias e $historial los calcula AsistenteService según la pantalla
 *   actual y la sesión (bienvenida contextual + historial corto).
 * - Todo el HTML de las respuestas lo escapa el backend (renderMd).
 */
use App\Services\AsistenteService;

$asistente   = new AsistenteService();
$sugerencias = $asistente->getSugerenciasBienvenida($_SERVER['REQUEST_URI'] ?? '/');
$historial   = $asistente->historial();

$botCfg = [
    'base'        => rtrim(BASE_URL, '/'),
    'pantalla'    => $_SERVER['REQUEST_URI'] ?? '/',
    'sugerencias' => $sugerencias,
    'historial'   => $historial,
    'saludo'      => '¡Hola! 👋 Soy el asistente del sistema. Preguntame cómo hacer cualquier trámite (cobrar, contratos, reportes, IVA…) o consultame datos: ocupación, deudas, ingresos del mes.',
    'noEntendi'   => 'Mmm, esa no la tengo clara. Probé con otras palabras o tocá un tema:',
];
?>
<!-- ================= Asistente (bot) ================= -->
<link href="<?= BASE_URL ?>/assets/css/bot.css" rel="stylesheet">

<button type="button" id="botFab" class="bot-fab" aria-expanded="false" aria-controls="botPanel"
        aria-label="Abrir asistente de ayuda" title="Asistente de ayuda">
    <i class="fa-solid fa-robot bot-fab-abrir" aria-hidden="true"></i>
    <i class="fa-solid fa-xmark bot-fab-cerrar" aria-hidden="true"></i>
    <span class="bot-fab-badge" id="botBadge" aria-hidden="true"></span>
</button>

<div id="botPanel" class="bot-panel" role="dialog" aria-label="Chat con el asistente" aria-modal="false">
    <div class="bot-head">
        <div class="bot-head-avatar"><i class="fa-solid fa-robot" aria-hidden="true"></i></div>
        <div>
            <div class="bot-head-titulo">Asistente</div>
            <div class="bot-head-estado">En línea · responde al toque</div>
        </div>
        <button type="button" class="bot-btn-icono" id="botLimpiar" title="Limpiar conversación" aria-label="Limpiar conversación">
            <i class="fa-solid fa-broom" aria-hidden="true"></i>
        </button>
        <a class="bot-btn-icono bot-head-admin" href="<?= BASE_URL ?>/bot/admin" title="Panel de la base de conocimiento"
           aria-label="Panel de la base de conocimiento" target="_blank" rel="noopener">
            <i class="fa-solid fa-database" aria-hidden="true"></i>
        </a>
    </div>

    <div class="bot-chat" id="botChat" aria-live="polite"></div>

    <form class="bot-form" id="botForm" autocomplete="off">
        <textarea id="botInput" class="form-control bot-input" rows="1" maxlength="300"
                  placeholder="Escribí tu pregunta…" aria-label="Mensaje para el asistente"></textarea>
        <button type="submit" class="bot-enviar" id="botEnviar" aria-label="Enviar mensaje" disabled>
            <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
        </button>
    </form>
</div>

<script>window.BOT_CFG = <?= json_encode($botCfg, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>
<script src="<?= BASE_URL ?>/assets/js/bot.js" defer></script>
<!-- ================= /Asistente ================= -->
