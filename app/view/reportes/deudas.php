<?php $titulo = 'Deudas Pendientes'; ?>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-file-invoice-dollar"></i> Deudas pendientes</span>
                <span class="badge bg-danger fs-6">Total: $<?= number_format($total, 2) ?></span>
            </div>
            <div class="card-body">
                <?php if(empty($deudas)): ?>
                    <p class="text-muted text-center py-4">No hay deudas pendientes. Todo al día. ✓</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Documento</th>
                                <th>Contacto</th>
                                <th>Monto original</th>
                                <th>Con interés</th>
                                <th>Vencimiento</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach($deudas as $d): ?>
                            <tr class="<?= $d['fecha_vencimiento'] && strtotime($d['fecha_vencimiento']) < time() ? 'table-danger' : '' ?>">
                                <td><strong><?= htmlspecialchars($d['cliente_nombre']) ?></strong></td>
                                <td><?= $d['documento'] ?? '-' ?></td>
                                <td><small><?= $d['email'] ?? '' ?><?= $d['telefono'] ?? '' ?: '' ?></small></td>
                                <td>$<?= number_format($d['monto_original'], 2) ?></td>
                                <td><strong>$<?= number_format($d['monto_con_interes'], 2) ?></strong></td>
                                <td><?= $d['fecha_vencimiento'] ? date('d/m/Y', strtotime($d['fecha_vencimiento'])) : '-' ?></td>
                                <td>
                                    <form action="<?= BASE_URL ?>/deudas/pagar" method="POST">
                                        <input type="hidden" name="deuda_id" value="<?= $d['id'] ?>">
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
