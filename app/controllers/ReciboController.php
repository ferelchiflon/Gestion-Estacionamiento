<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Recibo;
use App\Models\Movimiento;
use App\Services\EmailService;
use App\Services\PDFService;

class ReciboController extends Controller {
    
    /**
     * Genera un recibo a partir de un movimiento pagado.
     * Devuelve el id del recibo creado.
     */
    public function generarPorMovimiento($movimientoId, $formaPago) {
        $movimiento = (new Movimiento())->find($movimientoId);
        
        $clienteId = null;
        if($movimiento) {
            $row = (new Movimiento())->db->query(
                "SELECT v.cliente_id FROM vehiculos v WHERE v.patente = ?",
                [$movimiento['patente']]
            )->fetch();
            $clienteId = $row['cliente_id'] ?? null;
        }
        
        return (new Recibo())->insert([
            'movimiento_id' => $movimientoId,
            'cliente_id' => $clienteId,
            'monto' => $movimiento['monto_pagado'] ?? 0,
            'forma_pago' => $formaPago
        ]);
    }
    
    public function ver($id) {
        $recibo = (new Recibo())->getCompleto($id);
        
        if(!$recibo) {
            $_SESSION['error'] = "Recibo no encontrado";
            $this->redirect("/dashboard");
        }
        
        $this->view('recibos/ver', ['recibo' => $recibo]);
    }
    
    public function descargarPDF($id) {
        $recibo = (new Recibo())->getCompleto($id);
        
        if(!$recibo) {
            http_response_code(404);
            echo "Recibo no encontrado";
            return;
        }
        
        PDFService::descargarRecibo($recibo);
    }
    
    public function enviarPorEmail() {
        $reciboId = (int)($_POST['recibo_id'] ?? 0);
        $reciboModel = new Recibo();
        $recibo = $reciboModel->getCompleto($reciboId);
        
        if(!$recibo || empty($recibo['email'])) {
            $_SESSION['error'] = "Recibo no encontrado o el cliente no tiene email";
            $this->redirect("/recibos/ver/{$reciboId}");
        }
        
        $cuerpo = PDFService::construirHtmlRecibo($recibo);
        $emailService = new EmailService();
        $enviado = $emailService->enviar(
            $recibo['email'],
            "Recibo N° " . str_pad($recibo['id'], 6, '0', STR_PAD_LEFT) . " - Estacionamiento",
            $cuerpo
        );
        
        if($enviado) {
            $reciboModel->marcarEnviado($reciboId);
            $_SESSION['success'] = "Recibo enviado a {$recibo['email']}";
        } else {
            $_SESSION['error'] = "No se pudo enviar el email (revisa la configuración SMTP en Notificaciones)";
        }
        
        $this->redirect("/recibos/ver/{$reciboId}");
    }
}
