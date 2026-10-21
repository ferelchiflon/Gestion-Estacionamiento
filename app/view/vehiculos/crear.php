<?php $titulo = 'Alta de Vehículo e Ingreso'; ?>

<div class="row">
    <div class="col-md-6 mx-auto">
        <div class="card">
            <div class="card-header"><i class="fas fa-car-side"></i> Vehículo no registrado: <?= $patente ?></div>
            <div class="card-body">
                <form action="<?= BASE_URL ?>/vehiculo/crear" method="POST">
                    <input type="hidden" name="patente" value="<?= $patente ?>">
                    <input type="hidden" name="plaza_id" value="<?= $plazaId ?>">
                    
                    <div class="alert alert-info">
                        Se registrará el vehículo <strong><?= $patente ?></strong> y su ingreso
                        <?php if($plazaId): ?>en la plaza seleccionada<?php endif; ?>.
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Tipo de vehículo *</label>
                        <select class="form-select" name="tipo" required>
                            <option value="auto">Auto</option>
                            <option value="moto">Moto</option>
                            <option value="camioneta">Camioneta</option>
                            <option value="discapacidad">Discapacidad</option>
                        </select>
                    </div>
                    
                    <div class="row">
                        <div class="col-4 mb-3">
                            <label class="form-label">Marca</label>
                            <input type="text" class="form-control" name="marca">
                        </div>
                        <div class="col-4 mb-3">
                            <label class="form-label">Modelo</label>
                            <input type="text" class="form-control" name="modelo">
                        </div>
                        <div class="col-4 mb-3">
                            <label class="form-label">Color</label>
                            <input type="text" class="form-control" name="color">
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Cliente existente (opcional)</label>
                        <select class="form-select" name="cliente_id">
                            <option value="">-- Crear cliente ocasional --</option>
                            <?php foreach($clientes as $cli): ?>
                                <option value="<?= $cli['id'] ?>"><?= htmlspecialchars($cli['nombre']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="fas fa-check"></i> Registrar e ingresar
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>
