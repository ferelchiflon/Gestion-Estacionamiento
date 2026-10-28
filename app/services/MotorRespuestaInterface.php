<?php
namespace App\Services;

/**
 * Contrato de los motores de respuesta del asistente.
 *
 * Hoy existe una única implementación: MotorLocal (sin IA, 100% PHP).
 * Si más adelante se quiere conectar una IA, se agrega otra clase que
 * implemente esta interfaz y se inyecta en AsistenteService — el resto
 * del sistema no cambia.
 *
 * Formato de respuesta de responder():
 *   ['tipo' => 'respuesta',    'entrada' => array, 'puntaje' => float]
 *   ['tipo' => 'opciones',     'opciones' => [entrada, ...], 'puntaje' => float]
 *   ['tipo' => 'no_encontrado']
 *
 * $contexto recibe:
 *   'pantalla' => string  (ruta actual, ej. "/reportes/caja")
 *   'roles'    => array   (roles del usuario; ['*'] = sin restricción)
 */
interface MotorRespuestaInterface
{
    /**
     * Procesa el mensaje del usuario y devuelve la mejor respuesta,
     * opciones parecidas ("¿quisiste decir…?") o "no encontrado".
     */
    public function responder(string $mensaje, array $contexto = []): array;

    /**
     * Temas destacados para sugerir cuando el bot no encuentra una respuesta.
     * Devuelve una lista de ['texto' => etiqueta, 'mensaje' => pregunta a enviar].
     */
    public function temasDestacados(): array;
}
