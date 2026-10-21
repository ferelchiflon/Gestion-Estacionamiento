<?php $titulo = 'Recibos'; ?>

<div class="page-header mb-4">
    <div>
        <h1>Recibos</h1>
        <p class="text-muted mb-0">Comprobantes emitidos por cobros de estacionamiento y alquileres.</p>
    </div>
</div>

<div class="card">
    <div class="card-body">
        <div class="toolbar mb-3">
            <div class="input-group input-group-sm" style="max-width:320px;">
                <span class="input-group-text bg-white" id="lblBuscarRecibo">
                    <i class="bi bi-search" aria-hidden="true"></i>
                </span>
                <input type="search" class="form-control" placeholder="Buscar por cliente, patente o número..."
                       aria-label="Buscar recibos" aria-describedby="lblBuscarRecibo"
                       data-table-filter="#tablaRecibos">
            </div>
        </div>

        <?php if (empty($recibos)): ?>
        <div class="empty-state">
            <span class="empty-icon"><i class="bi bi-receipt" aria-hidden="true"></i></span>
            <h5>Todavía no hay recibos emitidos</h5>
            <p>Los comprobantes aparecen acá automáticamente al cobrar un egreso o un pago de alquiler.</p>
            <a href="<?= BASE_URL ?>/movimientos/ingreso" class="btn btn-primary btn-sm">
                <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Registrar ingreso
            </a>
        </div>
        <?php else: ?>
        <div class="table-responsive">
            <table class="table align-middle" id="tablaRecibos">
                <thead>
                    <tr>
                        <th scope="col">N°</th>
                        <th scope="col">Fecha</th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Patente</th>
                        <th scope="col" class="text-end">Monto</th>
                        <th scope="col">Forma de pago</th>
                        <th scope="col">Email</th>
                        <th scope="col" class="text-end">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($recibos as $recibo): ?>
                    <tr>
                        <td class="fw-semibold text-dark">N° <?= str_pad((string)$recibo['id'], 6, '0', STR_PAD_LEFT) ?></td>
                        <td><?= date('d/m/Y H:i', strtotime($recibo['fecha_emision'])) ?></td>
                        <td><?= htmlspecialchars($recibo['cliente_nombre'] ?? 'Consumidor final') ?></td>
                        <td><?= !empty($recibo['patente']) ? strtoupper($recibo['patente']) : '<span class="text-muted">—</span>' ?></td>
                        <td class="text-end fw-semibold">$<?= number_format((float)$recibo['monto'], 2) ?></td>
                        <td><span class="badge badge-soft-info"><?= htmlspecialchars($recibo['forma_pago'] ?? '—') ?></span></td>
                        <td>
                            <?php if (!empty($recibo['enviado_email'])): ?>
                                <span class="badge badge-soft-success"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Enviado</span>
                            <?php else: ?>
                                <span class="badge badge-soft-secondary">Pendiente</span>
                            <?php endif; ?>
                        </td>
                        <td class="text-end">
                            <a href="<?= BASE_URL ?>/recibos/ver/<?= (int)$recibo['id'] ?>"
                               class="btn btn-sm btn-outline-secondary" title="Ver recibo">
                                <i class="bi bi-eye me-1" aria-hidden="true"></i>Ver
                            </a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <p class="text-muted small mb-0 mt-2">Mostrando los últimos <?= count($recibos) ?> recibos.</p>
        <?php endif; ?>
    </div>
</div>
