<?php $titulo = 'IVA Ventas'; $slug = 'iva-ventas'; ?>

<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
    <h4 class="mb-0"><i class="fas fa-file-invoice-dollar me-2"></i>Libro IVA Ventas</h4>
    <span class="badge bg-secondary">ARCA (ex AFIP)</span>
</div>

<?php include __DIR__ . '/_filtros.php'; ?>

<?php if(!$discriminar): ?>
<div class="alert alert-warning py-2">
    <i class="fas fa-exclamation-triangle me-1"></i>
    Condición fiscal <strong>Monotributo</strong>: no corresponde discriminar IVA; los importes se informan como totales sin IVA.
</div>
<?php endif; ?>

<div class="row mb-3">
    <div class="col-md-4"><div class="card text-center"><div class="card-body">
        <h6 class="text-muted mb-0">Total cobrado</h6>
        <p class="fs-4 mb-0">$ <?= $filas ? end($filas)[3] : '0,00' ?></p>
    </div></div></div>
    <div class="col-md-4"><div class="card text-center"><div class="card-body">
        <h6 class="text-muted mb-0">Neto gravado</h6>
        <p class="fs-4 mb-0">$ <?= $filas ? end($filas)[4] : '0,00' ?></p>
    </div></div></div>
    <div class="col-md-4"><div class="card text-center"><div class="card-body">
        <h6 class="text-muted mb-0">IVA débito fiscal (<?= number_format($alicuota, 2, ',', '.') ?>%)</h6>
        <p class="fs-4 mb-0 text-danger">$ <?= $filas ? end($filas)[5] : '0,00' ?></p>
    </div></div></div>
</div>

<div class="card">
    <div class="card-header">Detalle por día y origen</div>
    <div class="card-body">
        <?php include __DIR__ . '/_tabla.php'; ?>
        <small class="text-muted">
            Los montos provienen de cobros registrados (movimientos pagados, pagos de alquiler y cobros de deudas);
            el neto y el IVA se calculan a partir del precio final usando la alícuota configurada (<?= number_format($alicuota, 2, ',', '.') ?>%).
            Para comprobante por comprobante, ver ARCA / mejora futura de facturación.
            En cobros de deudas la fecha informada es la de generación de la deuda (la tabla no registra fecha de pago).
        </small>
    </div>
</div>
