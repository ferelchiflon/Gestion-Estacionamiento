<?php $titulo = 'Caja Diaria'; ?>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header"><i class="fas fa-cash-register"></i> Movimientos de caja del mes actual</div>
            <div class="card-body">
                <?php if(empty($dias)): ?>
                    <p class="text-muted text-center py-4">No hay cobros registrados este mes.</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Operaciones</th>
                                <th>Efectivo</th>
                                <th>Tarjeta</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php $totales = ['efectivo' => 0, 'tarjeta' => 0, 'total' => 0, 'ops' => 0]; ?>
                            <?php foreach($dias as $d): ?>
                            <tr>
                                <td><?= date('d/m/Y', strtotime($d['fecha'])) ?></td>
                                <td><?= $d['operaciones'] ?></td>
                                <td>$<?= number_format($d['efectivo'], 2) ?></td>
                                <td>$<?= number_format($d['tarjeta'], 2) ?></td>
                                <td><strong>$<?= number_format($d['total'], 2) ?></strong></td>
                            </tr>
                            <?php 
                            $totales['efectivo'] += $d['efectivo'];
                            $totales['tarjeta'] += $d['tarjeta'];
                            $totales['total'] += $d['total'];
                            $totales['ops'] += $d['operaciones'];
                            endforeach; ?>
                        </tbody>
                        <tfoot class="table-dark">
                            <tr>
                                <th>TOTAL MES</th>
                                <th><?= $totales['ops'] ?></th>
                                <th>$<?= number_format($totales['efectivo'], 2) ?></th>
                                <th>$<?= number_format($totales['tarjeta'], 2) ?></th>
                                <th>$<?= number_format($totales['total'], 2) ?></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>
