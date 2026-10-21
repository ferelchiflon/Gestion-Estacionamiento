<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Services\EmailService;
use App\Services\WhatsAppService;
use App\Models\Notificacion;
use App\Models\Cliente;
use App\Models\Tarifa;

class NotificacionController extends Controller {
    
    public function configuracion() {
        $config = $this->getConfiguracion();
        $this->view('notificaciones/configuracion', ['config' => $config]);
    }
    
    public function guardarConfiguracion() {
        $data = [
            'smtp_host' => $_POST['smtp_host'],
            'smtp_user' => $_POST['smtp_user'],
            'smtp_pass' => $_POST['smtp_pass'],
            'whatsapp_api_key' => $_POST['whatsapp_api_key'],
            'whatsapp_phone_number_id' => $_POST['whatsapp_phone_number_id']
        ];
        
        $sql = "UPDATE configuracion_notificaciones SET 
                smtp_host = ?, smtp_user = ?, smtp_pass = ?, 
                whatsapp_api_key = ?, whatsapp_phone_number_id = ?,
                ultima_actualizacion = NOW()";
        
        (new Notificacion())->db->query($sql, array_values($data));
        
        $_SESSION['success'] = "Configuración guardada correctamente";
        $this->redirect("/notificaciones/configuracion");
    }
    
    public function enviarAlertaTarifa() {
        $tipoVehiculo = $_POST['tipo_vehiculo'];
        $nuevaTarifa = $_POST['nueva_tarifa'];
        $fechaEfectiva = $_POST['fecha_efectiva'];
        
        $tarifaModel = new Tarifa();
        $tarifaModel->notificarCambio($tipoVehiculo, $nuevaTarifa, $fechaEfectiva);
        
        $_SESSION['success'] = "Alertas enviadas a todos los clientes afectados";
        $this->redirect("/notificaciones/historial");
    }
    
    public function enviarManual() {
        $clienteId = $_POST['cliente_id'];
        $mensaje = $_POST['mensaje'];
        $tipo = $_POST['tipo'];
        $via = $_POST['via'];
        
        $clienteModel = new Cliente();
        $cliente = $clienteModel->find($clienteId);
        
        $resultado = false;
        
        if($via == 'email') {
            $emailService = new EmailService();
            $resultado = $emailService->enviar($cliente['email'], "Notificación Estacionamiento", $mensaje);
        } elseif($via == 'whatsapp') {
            $whatsappService = new WhatsAppService();
            $resultado = $whatsappService->enviar($cliente['telefono'], $mensaje);
        }
        
        if($resultado) {
            $notificacionModel = new Notificacion();
            $notificacionModel->registrar($clienteId, $mensaje, $tipo, $via);
            $_SESSION['success'] = "Notificación enviada correctamente";
        } else {
            $_SESSION['error'] = "Error al enviar la notificación";
        }
        
        $this->redirect("/clientes/ver/{$clienteId}");
    }
    
    public function historial() {
        $sql = "SELECT n.*, c.nombre as cliente_nombre, c.email, c.telefono
                FROM logs_notificaciones n
                JOIN clientes c ON n.cliente_id = c.id
                ORDER BY n.fecha_envio DESC
                LIMIT 100";
        $notificaciones = (new Notificacion())->db->query($sql)->fetchAll();
        
        $this->view('notificaciones/historial', ['notificaciones' => $notificaciones]);
    }
    
    private function getConfiguracion() {
        $sql = "SELECT * FROM configuracion_notificaciones LIMIT 1";
        $result = (new Notificacion())->db->query($sql)->fetch();
        
        if(!$result) {
            // Insertar configuración por defecto
            $sql = "INSERT INTO configuracion_notificaciones (id) VALUES (1)";
            (new Notificacion())->db->query($sql);
            return ['smtp_host' => '', 'smtp_user' => '', 'smtp_pass' => '', 'whatsapp_api_key' => '', 'whatsapp_phone_number_id' => ''];
        }
        
        return $result;
    }
}