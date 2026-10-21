<?php
namespace App\Services;

use App\Models\Notificacion;

class NotificacionService {
    
    /**
     * Alerta al cliente sobre una deuda generada en un egreso.
     * Nunca interrumpe el flujo del egreso.
     */
    public function enviarAlertaDeuda($cliente, $monto) {
        try {
            $mensaje = "Estimado " . ($cliente['nombre'] ?? 'cliente') . ": registramos una deuda de $"
                     . number_format((float)$monto, 2, ',', '.')
                     . " en Estacionamiento. Regularice su pago para evitar recargos.";
            
            if(!empty($cliente['email'])) {
                (new EmailService())->enviar($cliente['email'], 'Aviso de deuda - Estacionamiento', $mensaje);
            }
            
            (new Notificacion())->registrar(
                $cliente['id'] ?? null,
                $mensaje,
                'deuda',
                !empty($cliente['email']) ? 'email' : 'sistema',
                !empty($cliente['email']) ? 'enviado' : 'pendiente'
            );
            
            return true;
        } catch(\Throwable $e) {
            return false;
        }
    }
}
