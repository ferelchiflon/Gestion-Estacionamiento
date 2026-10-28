<?php
/**
 * Barra compartida de filtros y exportación de los reportes contables.
 * Requiere: $rango (del controlador) y $slug (ruta base del reporte, ej. 'iva-ventas').
 */
$rutaBase = BASE_URL . '/reportes-contables/' . $slug;
?>

<div class="card mb-3">
    <div class="card-body py-2">
        <form method="GET" action="<?= $rutaBase ?>" class="row g-2 align-items-end">
            <div class="col-6 col-md-2">
                <label class="form-label small mb-0">Desde</label>
                <input type="date" class="form-control form-control-sm" name="desde" value="<?= htmlspecialchars($_GET['desde'] ?? '') ?>">
            </div>
            <div class="col-6 col-md-2">
                <label class="form-label small mb-0">Hasta</label>
                <input type="date" class="form-control form-control-sm" name="hasta" value="<?= htmlspecialchars($_GET['hasta'] ?? '') ?>">
            </div>
            <div class="col-6 col-md-2">
                <label class="form-label small mb-0">Mes</label>
                <select name="mes" class="form-select form-select-sm">
                    <?php for($m = 1; $m <= 12; $m++): ?>
                    <option value="<?= $m ?>" <?= $m == $rango['mes'] ? 'selected' : '' ?>><?= str_pad($m, 2, '0', STR_PAD_LEFT) ?></option>
                    <?php endfor; ?>
                </select>
            </div>
            <div class="col-6 col-md-2">
                <label class="form-label small mb-0">Año</label>
                <select name="anio" class="form-select form-select-sm">
                    <?php for($a = (int)date('Y') - 5; $a <= (int)date('Y'); $a++): ?>
                    <option value="<?= $a ?>" <?= $a == $rango['anio'] ? 'selected' : '' ?>><?= $a ?></option>
                    <?php endfor; ?>
                </select>
            </div>
            <div class="col-md-2">
                <button type="submit" class="btn btn-sm btn-outline-primary w-100">
                    <i class="fas fa-filter me-1"></i> Aplicar
                </button>
            </div>
            <div class="col-md-2 d-flex gap-1">
                <a href="<?= $rutaBase ?>?desde=<?= $rango['desde'] ?>&hasta=<?= $rango['hasta'] ?>&export=csv"
                   class="btn btn-sm btn-outline-success w-100" title="CSV para Excel (separador ;)">
                    <i class="fas fa-file-csv me-1"></i> CSV
                </a>
                <a href="<?= $rutaBase ?>?desde=<?= $rango['desde'] ?>&hasta=<?= $rango['hasta'] ?>&export=pdf"
                   class="btn btn-sm btn-outline-danger w-100" title="PDF imprimible">
                    <i class="fas fa-file-pdf me-1"></i> PDF
                </a>
            </div>
        </form>
        <small class="text-muted">Período: <strong><?= htmlspecialchars($rango['texto']) ?></strong> — si completás "Desde" y "Hasta" tiene prioridad sobre mes/año.</small>
    </div>
</div>
