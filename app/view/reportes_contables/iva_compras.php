<?php $titulo = 'IVA Compras'; $slug = 'iva-compras'; ?>

<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
    <h4 class="mb-0"><i class="fas fa-shopping-cart me-2"></i>Libro IVA Compras</h4>
    <a href="<?= BASE_URL ?>/gastos/crear" class="btn btn-primary btn-sm">
        <i class="fas fa-plus me-1"></i> Cargar compra
    </a>
</div>

<?php include __DIR__ . '/_filtros.php'; ?>

<div class="row mb-3">
    <div class="col-md-3"><div class="card text-center"><div class="card-body">
        <h6 class="text-muted mb-0">Neto gravado</h6>
        <p class="fs-5 mb-0">$ <?= number_format((float)$tot['neto_gravado'], 2, ',', '.') ?></p>
    </div></div></div>
    <div class="col-md-3"><div class="card text-center"><div class="card-body">
        <h6 class="text-muted mb-0">IVA crédito fiscal</h6>
        <p class="fs-5 mb-0 text-success">$ <?= number_format((float)$tot['iva'], 2, ',', '.') ?></p>
    </div></div></div>
    <div class="col-md-3"><div class="card text-center"><div class="card-body">
        <h6 class="text-muted mb-0">Percepciones (IVA + IIBB)</h6>
        <p class="fs-5 mb-0">$ <?= number_format((float)($tot['percepcion_iva'] + $tot['percepcion_iibb']), 2, ',', '.') ?></p>
    </div></div></div>
    <div class="col-md-3"><div class="card text-center"><div class="card-body">
        <h6 class="text-muted mb-0">Total comprado</h6>
        <p class="fs-5 mb-0">$ <?= number_format((float)$tot['total'], 2, ',', '.') ?></p>
    </div></div></div>
</div>

<div class="card">
    <div class="card-header">Comprobantes de compra del período (<?= (int)$tot['comprobantes'] ?>)</div>
    <div class="card-body">
        <?php include __DIR__ . '/_tabla.php'; ?>
        <small class="text-muted">Fuente: ABM de <a href="<?= BASE_URL ?>/gastos">Gastos y Compras</a>.</small>
    </div>
</div>
