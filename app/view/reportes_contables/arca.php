<?php $titulo = 'ARCA (ex AFIP)'; $slug = 'arca'; ?>

<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
    <h4 class="mb-0"><i class="fas fa-landmark me-2"></i>ARCA (ex AFIP) — Comprobantes emitidos</h4>
    <span class="badge bg-dark">Punto de venta: <?= (int)$pv ?></span>
</div>

<?php include __DIR__ . '/_filtros.php'; ?>

<div class="alert alert-light border small">
    <i class="fas fa-info-circle me-1"></i>
    El sistema no emite comprobantes electrónicos: se listan los <strong>recibos internos</strong> como "Recibo C"
    por punto de venta configurado, con neto e IVA calculados sobre el precio final.
    El formato del Libro IVA Digital queda como mejora futura.
</div>

<div class="card mb-3">
    <div class="card-header">Resumen por día</div>
    <div class="card-body">
        <?php include __DIR__ . '/_tabla.php'; ?>
    </div>
</div>

<div class="card">
    <div class="card-header">Cobros de estacionamiento por forma de pago</div>
    <div class="card-body">
        <?php if(empty($porFormaPago)): ?>
        <div class="alert alert-info mb-0"><i class="fas fa-info-circle me-1"></i> Sin datos para el período.</div>
        <?php else: ?>
        <div class="table-responsive">
            <table class="table table-sm table-striped bg-white">
                <thead class="table-light"><tr><th>Forma de pago</th><th class="text-end">Operaciones</th><th class="text-end">Total</th></tr></thead>
                <tbody>
                    <?php foreach($porFormaPago as $f): ?>
                    <tr>
                        <td><?= htmlspecialchars(ucfirst((string)$f['forma_pago'])) ?></td>
                        <td class="text-end"><?= (int)$f['operaciones'] ?></td>
                        <td class="text-end">$ <?= number_format((float)$f['total'], 2, ',', '.') ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>
    </div>
</div>
