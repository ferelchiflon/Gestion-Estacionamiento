<?php
/**
 * Layout — Parte 1 (Fase 2)
 * Abre el buffer que captura la salida de la vista incluida a continuación
 * (Controller::view hace: require header → require vista → require footer).
 * El documento completo se ensambla en footer.php, donde ya están disponibles
 * $titulo (definida por cada vista) y el contenido capturado.
 */
ob_start();
