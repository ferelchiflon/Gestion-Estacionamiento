<?php $titulo = 'Pagos de Alquiler'; ?>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header"><i class="fas fa-money-check-alt"></i> Pagos pendientes de contratos activos</div>
            <div class="card-body">
                <?php if(empty($pendientes)): ?>
                    <p class="text-muted text-center py-4">No hay pagos pendientes. Todo al día. ✓</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Contrato</th>
                                <th>Cliente</th>
                                <th>Plaza</th>
                                <th>Período</th>
                                <th>Monto</th>
                                <th>Vencimiento</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach($pendientes as $p): ?>
                            <tr class="<?= $p['dias_retraso'] > 0 ? 'table-danger' : '' ?>">
                                <td>#<?= $p['contrato_id'] ?></td>
                                <td><?= htmlspecialchars($p['cliente_nombre']) ?></td>
                                <td>N° <?= $p['plaza_numero'] ?></td>
                                <td><?= $p['periodo'] ?></td>
                                <td>$<?= number_format($p['monto'], 2) ?></td>
                                <td><?= date('d/m/Y', strtotime($p['fecha_vencimiento'])) ?></td>
                                <td>
                                    <?php if($p['dias_retraso'] > 0): ?>
                                        <span class="badge bg-danger"><?= $p['dias_retraso'] ?> días de retraso</span>
                                    <?php else: ?>
                                        <span class="badge bg-warning text-dark">Pendiente</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <form action="<?= BASE_URL ?>/alquileres/registrarPago" method="POST">
                                        <input type="hidden" name="contrato_id" value="<?= $p['contrato_id'] ?>">
                                        <input type="hidden" name="periodo" value="<?= $p['periodo'] ?>">
                                        <input type="hidden" name="monto" value="<?= $p['monto'] ?>">
                                        <button type="submit" class="btn btn-sm btn-success">
                                            <i class="fas fa-check"></i> Registrar pago
                                        </button>
                                    </form>
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
