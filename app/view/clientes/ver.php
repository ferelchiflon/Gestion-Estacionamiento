<?php $titulo = 'Detalle del Cliente'; ?>

<div class="row mb-3">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-user"></i> <?= htmlspecialchars($cliente['nombre']) ?></span>
                <a href="<?= BASE_URL ?>/clientes/editar/<?= $cliente['id'] ?>" class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-edit"></i> Editar
                </a>
            </div>
            <div class="card-body">
                <dl class="row mb-0">
                    <dt class="col-4">Documento</dt>
                    <dd class="col-8"><?= $cliente['documento'] ?? '-' ?></dd>
                    <dt class="col-4">Email</dt>
                    <dd class="col-8"><?= $cliente['email'] ?? '-' ?></dd>
                    <dt class="col-4">Teléfono</dt>
                    <dd class="col-8"><?= $cliente['telefono'] ?? '-' ?></dd>
                    <dt class="col-4">Saldo prepagado</dt>
                    <dd class="col-8">$<?= number_format($cliente['saldo_actual'], 2) ?></dd>
                    <dt class="col-4">Deuda pendiente</dt>
                    <dd class="col-8">
                        <?php if($deuda_total > 0): ?>
                            <span class="badge bg-danger">$<?= number_format($deuda_total, 2) ?></span>
                        <?php else: ?>
                            <span class="badge bg-success">Al día</span>
                        <?php endif; ?>
                    </dd>
                </dl>
            </div>
        </div>
    </div>
    <div class="col-md-4">
        <div class="card">
            <div class="card-header"><i class="fas fa-envelope"></i> Enviar notificación</div>
            <div class="card-body">
                <form action="<?= BASE_URL ?>/notificaciones/enviar-manual" method="POST">
                    <input type="hidden" name="cliente_id" value="<?= $cliente['id'] ?>">
                    <div class="mb-2">
                        <select class="form-select form-select-sm" name="via" required>
                            <option value="email">Por Email</option>
                            <option value="whatsapp">Por WhatsApp</option>
                        </select>
                    </div>
                    <div class="mb-2">
                        <select class="form-select form-select-sm" name="tipo">
                            <option value="manual">Recordatorio</option>
                            <option value="deuda">Aviso de deuda</option>
                            <option value="tarifa">Aviso de tarifa</option>
                        </select>
                    </div>
                    <div class="mb-2">
                        <textarea class="form-control form-control-sm" name="mensaje" rows="3" required
                                  placeholder="Mensaje para el cliente..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-sm btn-primary w-100">
                        <i class="fas fa-paper-plane"></i> Enviar
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>

<div class="row">
    <div class="col-md-6">
        <div class="card">
            <div class="card-header"><i class="fas fa-car"></i> Vehículos</div>
            <div class="card-body">
                <?php if(empty($vehiculos)): ?>
                    <p class="text-muted mb-0">Sin vehículos registrados.</p>
                <?php else: ?>
                    <ul class="list-group list-group-flush">
                        <?php foreach($vehiculos as $veh): ?>
                        <li class="list-group-item d-flex justify-content-between">
                            <span><strong><?= $veh['patente'] ?></strong> <?= $veh['marca'] ?> <?= $veh['modelo'] ?></span>
                            <span class="badge bg-secondary"><?= $veh['tipo'] ?></span>
                        </li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card">
            <div class="card-header"><i class="fas fa-file-invoice-dollar"></i> Historial de notificaciones</div>
            <div class="card-body">
                <?php if(empty($notificaciones)): ?>
                    <p class="text-muted mb-0">Sin notificaciones enviadas.</p>
                <?php else: ?>
                    <ul class="list-group list-group-flush">
                        <?php foreach($notificaciones as $noti): ?>
                        <li class="list-group-item">
                            <small>
                                <span class="badge bg-info text-dark"><?= $noti['canal'] ?></span>
                                <?= date('d/m/Y H:i', strtotime($noti['fecha_envio'])) ?><br>
                                <?= htmlspecialchars(mb_substr($noti['mensaje'] ?? '', 0, 120)) ?>
                            </small>
                        </li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>
