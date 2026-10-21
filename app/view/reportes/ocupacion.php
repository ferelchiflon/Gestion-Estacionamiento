<?php $titulo = 'Ocupación'; ?>

<div class="row mb-4">
    <div class="col-md-5">
        <div class="card h-100">
            <div class="card-header"><i class="fas fa-chart-pie"></i> Por estado</div>
            <div class="card-body">
                <?php foreach($por_estado as $fila): ?>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-capitalize"><?= $fila['estado'] ?></span>
                    <span class="badge bg-<?= $fila['estado'] === 'libre' ? 'success' : ($fila['estado'] === 'ocupada' ? 'danger' : 'warning text-dark') ?>">
                        <?= $fila['cantidad'] ?>
                    </span>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
    <div class="col-md-7">
        <div class="card h-100">
            <div class="card-header"><i class="fas fa-th"></i> Por sector</div>
            <div class="card-body">
                <table class="table table-sm">
                    <thead><tr><th>Sector</th><th>Total</th><th>Ocupadas</th><th>Ocupación</th></tr></thead>
                    <tbody>
                        <?php foreach($por_sector as $s): ?>
                        <tr>
                            <td><strong><?= $s['sector'] ?></strong></td>
                            <td><?= $s['total'] ?></td>
                            <td><?= $s['ocupadas'] ?></td>
                            <td style="width:50%">
                                <?php $pct = $s['total'] > 0 ? round(($s['ocupadas'] / $s['total']) * 100) : 0; ?>
                                <div class="progress">
                                    <div class="progress-bar <?= $pct >= 80 ? 'bg-danger' : ($pct >= 50 ? 'bg-warning' : 'bg-success') ?>"
                                         style="width: <?= $pct ?>%"><?= $pct ?>%</div>
                                </div>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header"><i class="fas fa-file-signature"></i> Plazas alquiladas (contratos activos)</div>
            <div class="card-body">
                <?php if(empty($alquiladas)): ?>
                    <p class="text-muted text-center py-4">No hay plazas alquiladas mediante contratos.</p>
                <?php else: ?>
                <table class="table table-hover align-middle">
                    <thead>
                        <tr><th>Plaza</th><th>Sector</th><th>Cliente</th><th>Vence</th></tr>
                    </thead>
                    <tbody>
                        <?php foreach($alquiladas as $a): ?>
                        <tr>
                            <td>N° <?= $a['numero'] ?></td>
                            <td><?= $a['sector'] ?></td>
                            <td><?= htmlspecialchars($a['cliente_nombre']) ?></td>
                            <td><?= date('d/m/Y', strtotime($a['fecha_fin'])) ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>
