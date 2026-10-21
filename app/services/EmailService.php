<?php
namespace App\Services;

class EmailService {
    
    /**
     * Envía un email. Si SMTP no está configurado, registra el intento
     * en storage/logs/mail.log y devuelve false.
     */
    public function enviar($para, $asunto, $cuerpo) {
        $logLine = date('Y-m-d H:i:s') . " | EMAIL | Para: {$para} | Asunto: {$asunto}";
        $logDir = BASE_PATH . '/storage/logs';
        
        if(!is_dir($logDir)) {
            @mkdir($logDir, 0775, true);
        }
        
        if(!filter_var($para, FILTER_VALIDATE_EMAIL)) {
            file_put_contents($logDir . '/mail.log', $logLine . " | ERROR: email inválido\n", FILE_APPEND);
            return false;
        }
        
        if(defined('SMTP_USER') && SMTP_USER !== '') {
            $headers = "From: " . SMTP_USER . "\r\n"
                     . "Reply-To: " . SMTP_USER . "\r\n"
                     . "Content-Type: text/html; charset=UTF-8\r\n";
            
            $ok = @mail($para, $asunto, $cuerpo, $headers);
            file_put_contents($logDir . '/mail.log', $logLine . ($ok ? " | ENVIADO\n" : " | ERROR\n"), FILE_APPEND);
            return $ok;
        }
        
        file_put_contents($logDir . '/mail.log', $logLine . " | PENDIENTE (SMTP sin configurar)\n", FILE_APPEND);
        return false;
    }
}
