<?php $titulo = 'Disponibilidad de Plazas'; ?>

<div class="row">
    <?php foreach($disponibilidad as $disp): ?>
    <div class="col-md-4 mb-3">
        <div class="card text-center h-100">
            <div class="card-body">
                <h5 class="card-title">Sector <?= $disp['sector'] ?></h5>
                <p class="display-6 mb-0"><?= $disp['libres'] ?> / <?= $disp['total'] ?></p>
                <p class="text-muted">plazas libres (<?= $disp['tipo'] ?>)</p>
                <div class="progress">
                    <?php $pct = $disp['total'] > 0 ? round(($disp['ocupadas'] / $disp['total']) * 100) : 0; ?>
                    <div class="progress-bar <?= $pct >= 80 ? 'bg-danger' : ($pct >= 50 ? 'bg-warning' : 'bg-success') ?>"
                         style="width: <?= $pct ?>%"><?= $pct ?>% ocupado</div>
                </div>
            </div>
        </div>
    </div>
    <?php endforeach; ?>
</div>
