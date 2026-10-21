<?php $titulo = 'Configuración de Notificaciones'; ?>

<div class="row">
    <div class="col-md-8 mx-auto">
        <div class="card">
            <div class="card-header"><i class="fas fa-cog"></i> Configuración de Email y WhatsApp</div>
            <div class="card-body">
                <form action="<?= BASE_URL ?>/notificaciones/configuracion" method="POST">
                    <h6 class="text-muted">Servidor de correo (SMTP)</h6>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">SMTP Host</label>
                            <input type="text" class="form-control" name="smtp_host" value="<?= $config['smtp_host'] ?? '' ?>" placeholder="smtp.gmail.com">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">SMTP Usuario</label>
                            <input type="text" class="form-control" name="smtp_user" value="<?= $config['smtp_user'] ?? '' ?>" placeholder="tucorreo@gmail.com">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">SMTP Contraseña</label>
                            <input type="password" class="form-control" name="smtp_pass" value="<?= $config['smtp_pass'] ?? '' ?>">
                        </div>
                    </div>
                    
                    <h6 class="text-muted mt-4">WhatsApp Business API</h6>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">API Key</label>
                            <input type="text" class="form-control" name="whatsapp_api_key" value="<?= $config['whatsapp_api_key'] ?? '' ?>">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Phone Number ID</label>
                            <input type="text" class="form-control" name="whatsapp_phone_number_id" value="<?= $config['whatsapp_phone_number_id'] ?? '' ?>">
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Guardar configuración
                    </button>
                </form>
            </div>
        </div>
        
        <div class="card mt-3">
            <div class="card-header"><i class="fas fa-bell"></i> Enviar alerta de cambio de tarifa</div>
            <div class="card-body">
                <form action="<?= BASE_URL ?>/notificaciones/alerta-tarifa" method="POST" class="row g-2 align-items-end">
                    <div class="col-md-4">
                        <label class="form-label">Tipo de vehículo</label>
                        <select class="form-select" name="tipo_vehiculo" required>
                            <option value="auto">Auto</option>
                            <option value="moto">Moto</option>
                            <option value="camioneta">Camioneta</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Nueva tarifa/hora</label>
                        <input type="number" class="form-control" name="nueva_tarifa" step="0.01" min="0" required>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Fecha efectiva</label>
                        <input type="date" class="form-control" name="fecha_efectiva" required>
                    </div>
                    <div class="col-12 mt-2">
                        <button type="submit" class="btn btn-warning">
                            <i class="fas fa-paper-plane"></i> Notificar a clientes afectados
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
