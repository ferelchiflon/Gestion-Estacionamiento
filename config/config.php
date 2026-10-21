<?php
session_start();

define('BASE_URL', 'http://localhost:8888/gestion-estacionamiento');
define('BASE_PATH', dirname(__DIR__));

// Zona horaria
date_default_timezone_set('America/Argentina/Buenos_Aires');

// Configuración de entorno
$env_file = BASE_PATH . '/.env';
if(file_exists($env_file)) {
    $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach($lines as $line) {
        if(strpos($line, '=') !== false && strpos($line, '#') !== 0) {
            list($key, $value) = explode('=', $line, 2);
            putenv(trim($key) . '=' . trim($value));
        }
    }
}

// Configuración de notificaciones
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'smtp.gmail.com');
define('SMTP_USER', getenv('SMTP_USER') ?: '');
define('SMTP_PASS', getenv('SMTP_PASS') ?: '');
define('WHATSAPP_API_KEY', getenv('WHATSAPP_API_KEY') ?: '');
define('WHATSAPP_PHONE_ID', getenv('WHATSAPP_PHONE_ID') ?: '');