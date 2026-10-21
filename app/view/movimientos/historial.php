<?php $titulo = 'Historial de Movimientos'; ?>

<div class="row mb-3">
    <div class="col-12">
        <div class="btn-group">
            <a href="<?= BASE_URL ?>/movimientos/historial?filtro=hoy" class="btn btn-<?= $filtro === 'hoy' ? 'primary' : 'outline-primary' ?>">Hoy</a>
            <a href="<?= BASE_URL ?>/movimientos/historial?filtro=semana" class="btn btn-<?= $filtro === 'semana' ? 'primary' : 'outline-primary' ?>">Última semana</a>
            <a href="<?= BASE_URL ?>/movimientos/historial?filtro=mes" class="btn btn-<?= $filtro === 'mes' ? 'primary' : 'outline-primary' ?>">Este mes</a>
        </div>
    </div>
</div>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header"><i class="fas fa-history"></i> Movimientos (<?= count($movimientos) ?>)</div>
            <div class="card-body">
                <?php if(empty($movimientos)): ?>
                    <p class="text-muted text-center py-4">No hay movimientos en el período seleccionado.</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Patente</th>
                                <th>Cliente</th>
                                <th>Vehículo</th>
                                <th>Plaza</th>
                                <th>Entrada</th>
                                <th>Salida</th>
                                <th>Monto</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach($movimientos as $mov): ?>
                            <tr>
                                <td><?= $mov['id'] ?></td>
                                <td><strong><?= $mov['patente'] ?></strong></td>
                                <td><?= $mov['cliente_nombre'] ?? 'Ocasional' ?></td>
                                <td><?= $mov['tipo'] ?></td>
                                <td>N° <?= $mov['plaza_numero'] ?></td>
                                <td><?= date('d/m H:i', strtotime($mov['hora_entrada'])) ?></td>
                                <td><?= $mov['hora_salida'] ? date('d/m H:i', strtotime($mov['hora_salida'])) : '-' ?></td>
                                <td>$<?= number_format($mov['monto_pagado'] ?? 0, 2) ?></td>
                                <td>
                                    <?php if(!$mov['hora_salida']): ?>
                                        <span class="badge bg-warning text-dark">Activo</span>
                                    <?php elseif($mov['estado_pago'] === 'pagado'): ?>
                                        <span class="badge bg-success">Pagado</span>
                                    <?php else: ?>
                                        <span class="badge bg-danger">Deuda</span>
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
