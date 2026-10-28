<?php $titulo = 'Gastos y Compras'; ?>

<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
    <h4 class="mb-0"><i class="fas fa-shopping-cart me-2"></i>Gastos y Compras</h4>
    <a href="<?= BASE_URL ?>/gastos/crear" class="btn btn-primary">
        <i class="fas fa-plus me-1"></i> Nuevo gasto
    </a>
</div>

<div class="card mb-3">
    <div class="card-body py-2">
        <form method="GET" action="<?= BASE_URL ?>/gastos" class="row g-2 align-items-end">
            <div class="col-auto">
                <label class="form-label small mb-0">Mes</label>
                <select name="mes" class="form-select form-select-sm">
                    <?php for($m = 1; $m <= 12; $m++): ?>
                    <option value="<?= $m ?>" <?= $m == $mes ? 'selected' : '' ?>><?= str_pad($m, 2, '0', STR_PAD_LEFT) ?></option>
                    <?php endfor; ?>
                </select>
            </div>
            <div class="col-auto">
                <label class="form-label small mb-0">Año</label>
                <select name="anio" class="form-select form-select-sm">
                    <?php for($a = (int)date('Y') - 5; $a <= (int)date('Y'); $a++): ?>
                    <option value="<?= $a ?>" <?= $a == $anio ? 'selected' : '' ?>><?= $a ?></option>
                    <?php endfor; ?>
                </select>
            </div>
            <div class="col-auto">
                <button type="submit" class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-filter me-1"></i> Filtrar
                </button>
            </div>
        </form>
    </div>
</div>

<?php if(empty($gastos)): ?>
<div class="alert alert-info">
    <i class="fas fa-info-circle me-1"></i> Sin gastos registrados en el período seleccionado.
</div>
<?php else: ?>
<div class="card">
    <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
                <tr>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Comprobante</th>
                    <th>Categoría</th>
                    <th class="text-end">Neto</th>
                    <th class="text-end">IVA</th>
                    <th class="text-end">Total</th>
                    <th class="text-center">Acciones</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach($gastos as $g): ?>
                <tr>
                    <td><?= date('d/m/Y', strtotime($g['fecha'])) ?></td>
                    <td>
                        <?= htmlspecialchars($g['proveedor']) ?>
                        <?php if(!empty($g['cuit_proveedor'])): ?>
                        <br><small class="text-muted"><?= htmlspecialchars($g['cuit_proveedor']) ?></small>
                        <?php endif; ?>
                    </td>
                    <td>
                        <?= htmlspecialchars($g['tipo_comprobante']) ?>
                        <?php if(!empty($g['punto_venta']) && !empty($g['numero_comprobante'])): ?>
                        <br><small class="text-muted">
                            N° <?= str_pad((string)$g['punto_venta'], 4, '0', STR_PAD_LEFT) ?>-<?= str_pad((string)$g['numero_comprobante'], 8, '0', STR_PAD_LEFT) ?>
                        </small>
                        <?php endif; ?>
                    </td>
                    <td><?= htmlspecialchars($g['categoria_nombre'] ?? '—') ?></td>
                    <td class="text-end">$ <?= number_format((float)$g['neto_gravado'], 2, ',', '.') ?></td>
                    <td class="text-end">$ <?= number_format((float)($g['iva_21'] + $g['iva_105'] + $g['iva_27']), 2, ',', '.') ?></td>
                    <td class="text-end fw-bold">$ <?= number_format((float)$g['total'], 2, ',', '.') ?></td>
                    <td class="text-center">
                        <a href="<?= BASE_URL ?>/gastos/editar/<?= (int)$g['id'] ?>" class="btn btn-sm btn-outline-primary" title="Editar">
                            <i class="fas fa-edit"></i>
                        </a>
                        <form method="POST" action="<?= BASE_URL ?>/gastos/eliminar" class="d-inline"
                              onsubmit="return confirm('¿Eliminar este gasto?');">
                            <input type="hidden" name="id" value="<?= (int)$g['id'] ?>">
                            <button type="submit" class="btn btn-sm btn-outline-danger" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </form>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
            <tfoot class="table-light">
                <tr>
                    <th colspan="4" class="text-end">Totales (<?= (int)$totales['comprobantes'] ?> comprobantes):</th>
                    <th class="text-end">$ <?= number_format((float)$totales['neto_gravado'], 2, ',', '.') ?></th>
                    <th class="text-end">$ <?= number_format((float)$totales['iva'], 2, ',', '.') ?></th>
                    <th class="text-end">$ <?= number_format((float)$totales['total'], 2, ',', '.') ?></th>
                    <th></th>
                </tr>
            </tfoot>
        </table>
    </div>
</div>
<?php endif; ?>
