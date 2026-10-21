<?php $titulo = 'Contratos de Alquiler'; ?>

<div class="row mb-3">
    <div class="col-12 text-end">
        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalContrato">
            <i class="fas fa-file-signature"></i> Nuevo contrato
        </button>
    </div>
</div>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header"><i class="fas fa-file-signature"></i> Contratos (<?= count($contratos) ?>)</div>
            <div class="card-body">
                <?php if(empty($contratos)): ?>
                    <p class="text-muted text-center py-4">No hay contratos registrados todavía.</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Plaza</th>
                                <th>Cliente</th>
                                <th>Tipo</th>
                                <th>Inicio</th>
                                <th>Fin</th>
                                <th>Total</th>
                                <th>Cuota mensual</th>
                                <th>Día vto.</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach($contratos as $c): ?>
                            <tr>
                                <td>N° <?= $c['plaza_numero'] ?> (<?= $c['sector'] ?>)</td>
                                <td><?= htmlspecialchars($c['cliente_nombre']) ?></td>
                                <td><?= $c['tipo_alquiler'] ?></td>
                                <td><?= date('d/m/Y', strtotime($c['fecha_inicio'])) ?></td>
                                <td><?= date('d/m/Y', strtotime($c['fecha_fin'])) ?></td>
                                <td>$<?= number_format($c['monto_total'], 2) ?></td>
                                <td>$<?= number_format($c['cuota_mensual'], 2) ?></td>
                                <td><?= $c['dia_vencimiento'] ?? '-' ?></td>
                                <td>
                                    <?php if($c['estado'] === 'activo'): ?>
                                        <span class="badge bg-success">Activo</span>
                                    <?php else: ?>
                                        <span class="badge bg-secondary"><?= $c['estado'] ?></span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<!-- Modal nuevo contrato -->
<div class="modal fade" id="modalContrato" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form action="<?= BASE_URL ?>/alquileres/contrato" method="POST">
                <div class="modal-header">
                    <h5 class="modal-title">Nuevo contrato de alquiler</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Plaza *</label>
                        <select class="form-select" name="plaza_id" required>
                            <option value="">Seleccionar plaza</option>
                            <?php foreach($plazas as $p): ?>
                                <option value="<?= $p['id'] ?>">N° <?= $p['numero'] ?> - Sector <?= $p['sector'] ?> (<?= $p['estado'] ?>)</option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Cliente *</label>
                        <select class="form-select" name="cliente_id" required>
                            <option value="">Seleccionar cliente</option>
                            <?php foreach($clientes as $c): ?>
                                <option value="<?= $c['id'] ?>"><?= htmlspecialchars($c['nombre']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Tipo de alquiler *</label>
                        <select class="form-select" name="tipo_alquiler_id" required>
                            <?php foreach($tipos_alquiler as $t): ?>
                                <option value="<?= $t['id'] ?>"><?= $t['nombre'] ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Monto total *</label>
                        <input type="number" class="form-control" name="monto_total" step="0.01" min="0.01" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Día de vencimiento (mensual)</label>
                        <input type="number" class="form-control" name="dia_vencimiento" min="1" max="31">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Crear contrato</button>
                </div>
            </form>
        </div>
    </div>
</div>
