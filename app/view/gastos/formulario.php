<?php $titulo = isset($gasto) ? 'Editar Gasto' : 'Nuevo Gasto'; ?>
<?php $esEdicion = !empty($gasto); ?>

<div class="row justify-content-center">
    <div class="col-12 col-xl-10">
        <div class="card">
            <div class="card-header">
                <i class="fas fa-<?= $esEdicion ? 'edit' : 'plus' ?> me-1"></i>
                <?= $esEdicion ? 'Editar gasto / compra' : 'Registrar gasto / compra' ?>
            </div>
            <div class="card-body">
                <form method="POST"
                      action="<?= BASE_URL ?>/gastos/<?= $esEdicion ? 'actualizar' : 'guardar' ?>">
                    <?php if($esEdicion): ?>
                    <input type="hidden" name="id" value="<?= (int)$gasto['id'] ?>">
                    <?php endif; ?>

                    <div class="row g-3">
                        <div class="col-md-3">
                            <label class="form-label" for="fecha">Fecha *</label>
                            <input type="date" class="form-control" id="fecha" name="fecha" required
                                   value="<?= htmlspecialchars($gasto['fecha'] ?? date('Y-m-d')) ?>">
                        </div>
                        <div class="col-md-5">
                            <label class="form-label" for="proveedor">Proveedor *</label>
                            <input type="text" class="form-control" id="proveedor" name="proveedor" maxlength="120" required
                                   value="<?= htmlspecialchars($gasto['proveedor'] ?? '') ?>">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="cuit_proveedor">CUIT proveedor</label>
                            <input type="text" class="form-control" id="cuit_proveedor" name="cuit_proveedor"
                                   placeholder="20-12345678-9" maxlength="13"
                                   value="<?= htmlspecialchars($gasto['cuit_proveedor'] ?? '') ?>">
                        </div>

                        <div class="col-md-4">
                            <label class="form-label" for="tipo_comprobante">Tipo de comprobante</label>
                            <select class="form-select" id="tipo_comprobante" name="tipo_comprobante">
                                <?php foreach($tipos_comprobante as $tipo): ?>
                                <option value="<?= htmlspecialchars($tipo) ?>" <?= ($gasto['tipo_comprobante'] ?? '') === $tipo ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($tipo) ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label" for="punto_venta">Pto. venta</label>
                            <input type="number" min="1" max="9999" class="form-control" id="punto_venta" name="punto_venta"
                                   value="<?= htmlspecialchars($gasto['punto_venta'] ?? '') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="numero_comprobante">N° comprobante</label>
                            <input type="number" min="1" class="form-control" id="numero_comprobante" name="numero_comprobante"
                                   value="<?= htmlspecialchars($gasto['numero_comprobante'] ?? '') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="categoria_id">Categoría</label>
                            <select class="form-select" id="categoria_id" name="categoria_id">
                                <option value="">— Sin categoría —</option>
                                <?php foreach($categorias as $cat): ?>
                                <option value="<?= (int)$cat['id'] ?>" <?= (int)($gasto['categoria_id'] ?? 0) === (int)$cat['id'] ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($cat['nombre']) ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="col-12">
                            <hr class="my-1">
                            <span class="text-muted small">Importes (los dejás en 0 si no aplican)</span>
                        </div>

                        <div class="col-md-3">
                            <label class="form-label" for="neto_gravado">Neto gravado</label>
                            <input type="number" step="0.01" min="0" class="form-control" id="neto_gravado" name="neto_gravado"
                                   value="<?= htmlspecialchars($gasto['neto_gravado'] ?? '0.00') ?>">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label" for="iva_21">IVA 21%</label>
                            <input type="number" step="0.01" min="0" class="form-control" id="iva_21" name="iva_21"
                                   value="<?= htmlspecialchars($gasto['iva_21'] ?? '0.00') ?>">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label" for="iva_105">IVA 10,5%</label>
                            <input type="number" step="0.01" min="0" class="form-control" id="iva_105" name="iva_105"
                                   value="<?= htmlspecialchars($gasto['iva_105'] ?? '0.00') ?>">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label" for="iva_27">IVA 27%</label>
                            <input type="number" step="0.01" min="0" class="form-control" id="iva_27" name="iva_27"
                                   value="<?= htmlspecialchars($gasto['iva_27'] ?? '0.00') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="no_gravado">No gravado / exento</label>
                            <input type="number" step="0.01" min="0" class="form-control" id="no_gravado" name="no_gravado"
                                   value="<?= htmlspecialchars($gasto['no_gravado'] ?? '0.00') ?>">
                        </div>

                        <div class="col-md-3">
                            <label class="form-label" for="percepcion_iva">Percepción IVA</label>
                            <input type="number" step="0.01" min="0" class="form-control" id="percepcion_iva" name="percepcion_iva"
                                   value="<?= htmlspecialchars($gasto['percepcion_iva'] ?? '0.00') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="percepcion_iibb">Percepción IIBB</label>
                            <input type="number" step="0.01" min="0" class="form-control" id="percepcion_iibb" name="percepcion_iibb"
                                   value="<?= htmlspecialchars($gasto['percepcion_iibb'] ?? '0.00') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="forma_pago">Forma de pago</label>
                            <select class="form-select" id="forma_pago" name="forma_pago">
                                <?php foreach($formas_pago as $fp): ?>
                                <option value="<?= $fp ?>" <?= ($gasto['forma_pago'] ?? '') === $fp ? 'selected' : '' ?>>
                                    <?= ucfirst($fp) ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="notas">Notas</label>
                            <input type="text" class="form-control" id="notas" name="notas" maxlength="255"
                                   value="<?= htmlspecialchars($gasto['notas'] ?? '') ?>">
                        </div>
                    </div>

                    <div class="d-flex justify-content-end gap-2 mt-4">
                        <a href="<?= BASE_URL ?>/gastos" class="btn btn-outline-secondary">Cancelar</a>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save me-1"></i> <?= $esEdicion ? 'Actualizar' : 'Guardar' ?> gasto
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
