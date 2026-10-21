<?php
namespace App\Services;

class WhatsAppService {
    
    /**
     * Envía un mensaje por WhatsApp Cloud API.
     * Si no hay API key configurada, registra el intento en el log y devuelve false.
     */
    public function enviar($telefono, $mensaje) {
        $logDir = BASE_PATH . '/storage/logs';
        if(!is_dir($logDir)) {
            @mkdir($logDir, 0775, true);
        }
        $logLine = date('Y-m-d H:i:s') . " | WHATSAPP | Para: {$telefono}";
        
        if(!defined('WHATSAPP_API_KEY') || WHATSAPP_API_KEY === '' || !defined('WHATSAPP_PHONE_ID') || WHATSAPP_PHONE_ID === '') {
            file_put_contents($logDir . '/whatsapp.log', $logLine . " | PENDIENTE (API sin configurar)\n", FILE_APPEND);
            return false;
        }
        
        $url = 'https://graph.facebook.com/v18.0/' . WHATSAPP_PHONE_ID . '/messages';
        $payload = json_encode([
            'messaging_product' => 'whatsapp',
            'to' => preg_replace('/[^0-9]/', '', $telefono),
            'type' => 'text',
            'text' => ['body' => $mensaje]
        ]);
        
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Authorization: Bearer " . WHATSAPP_API_KEY . "\r\n"
                          . "Content-Type: application/json\r\n",
                'content' => $payload,
                'timeout' => 10
            ]
        ]);
        
        $response = @file_get_contents($url, false, $context);
        $ok = $response !== false;
        file_put_contents($logDir . '/whatsapp.log', $logLine . ($ok ? " | ENVIADO\n" : " | ERROR\n"), FILE_APPEND);
        
        return $ok;
    }
}
