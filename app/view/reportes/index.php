<?php $titulo = 'Reportes'; ?>

<div class="row mb-4">
    <div class="col-md-3">
        <div class="card text-center h-100">
            <div class="card-body">
                <h6 class="text-muted">Ingresos del mes (estacionamiento)</h6>
                <p class="display-6 mb-0">$<?= number_format($ingresos_mes, 0) ?></p>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card text-center h-100">
            <div class="card-body">
                <h6 class="text-muted">Operaciones del mes</h6>
                <p class="display-6 mb-0"><?= $operaciones_mes ?></p>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card text-center h-100">
            <div class="card-body">
                <h6 class="text-muted">Deuda pendiente total</h6>
                <p class="display-6 mb-0 text-danger">$<?= number_format($deuda_total, 0) ?></p>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card text-center h-100">
            <div class="card-body">
                <h6 class="text-muted">Contratos activos</h6>
                <p class="display-6 mb-0"><?= $contratos_activos ?></p>
            </div>
        </div>
    </div>
</div>

<div class="row">
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-header"><i class="fas fa-car"></i> Ocupación actual</div>
            <div class="card-body">
                <?php foreach($ocupacion as $estado => $cant): ?>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-capitalize"><?= $estado ?></span>
                    <span class="badge bg-<?= $estado === 'libre' ? 'success' : ($estado === 'ocupada' ? 'danger' : 'warning text-dark') ?>"><?= $cant ?></span>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100">
            <div class="card-header"><i class="fas fa-chart-bar"></i> Reportes detallados</div>
            <div class="card-body d-grid gap-2">
                <a href="<?= BASE_URL ?>/reportes/caja" class="btn btn-outline-primary">
                    <i class="fas fa-cash-register"></i> Caja diaria del mes
                </a>
                <a href="<?= BASE_URL ?>/reportes/deudas" class="btn btn-outline-danger">
                    <i class="fas fa-file-invoice-dollar"></i> Deudas pendientes
                </a>
                <a href="<?= BASE_URL ?>/reportes/ocupacion" class="btn btn-outline-info">
                    <i class="fas fa-parking"></i> Ocupación por sector
                </a>
            </div>
        </div>
    </div>
</div>

<div class="row mt-4">
    <div class="col-md-6">
        <div class="card h-100 border-warning">
            <div class="card-header bg-warning bg-opacity-10"><i class="fas fa-landmark"></i> Impuestos <span class="badge bg-secondary ms-1">ARCA (ex AFIP)</span></div>
            <div class="card-body d-grid gap-2">
                <a href="<?= BASE_URL ?>/reportes-contables/iva-ventas" class="btn btn-outline-warning text-dark">
                    <i class="fas fa-file-invoice-dollar"></i> IVA Ventas
                </a>
                <a href="<?= BASE_URL ?>/reportes-contables/iva-compras" class="btn btn-outline-warning text-dark">
                    <i class="fas fa-shopping-cart"></i> IVA Compras
                </a>
                <a href="<?= BASE_URL ?>/reportes-contables/posicion-iva" class="btn btn-outline-warning text-dark">
                    <i class="fas fa-balance-scale"></i> Posición de IVA mensual
                </a>
                <a href="<?= BASE_URL ?>/reportes-contables/arca" class="btn btn-outline-warning text-dark">
                    <i class="fas fa-landmark"></i> ARCA (ex AFIP) - Comprobantes
                </a>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card h-100 border-secondary">
            <div class="card-header"><i class="fas fa-calculator"></i> Contabilidad</div>
            <div class="card-body d-grid gap-2">
                <a href="<?= BASE_URL ?>/gastos" class="btn btn-outline-secondary">
                    <i class="fas fa-shopping-cart"></i> Gastos y compras (ABM)
                </a>
                <a href="<?= BASE_URL ?>/configuracion-fiscal" class="btn btn-outline-secondary">
                    <i class="fas fa-cogs"></i> Configuración fiscal (IVA, IIBB, ARCA)
                </a>
            </div>
        </div>
    </div>
</div>
