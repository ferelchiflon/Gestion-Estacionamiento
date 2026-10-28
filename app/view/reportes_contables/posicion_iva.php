<?php $titulo = 'Posición de IVA'; $slug = 'posicion-iva'; ?>

<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
    <h4 class="mb-0"><i class="fas fa-balance-scale me-2"></i>Posición de IVA mensual</h4>
    <span class="badge bg-secondary">ARCA (ex AFIP)</span>
</div>

<?php include __DIR__ . '/_filtros.php'; ?>

<div class="row justify-content-center">
    <div class="col-12 col-lg-8">
        <table class="table table-striped align-middle bg-white">
            <tbody>
                <tr><td>Ventas brutas (con IVA)</td><td class="text-end">$ <?= number_format($totalVentas, 2, ',', '.') ?></td></tr>
                <tr><td>Ventas netas</td><td class="text-end">$ <?= number_format($netoVentas, 2, ',', '.') ?></td></tr>
                <tr class="table-warning">
                    <td><strong>Débito fiscal (IVA ventas, <?= number_format($alicuota, 2, ',', '.') ?>%)</strong></td>
                    <td class="text-end"><strong>$ <?= number_format($debitoFiscal, 2, ',', '.') ?></strong></td>
                </tr>
                <tr><td>IVA compras (crédito fiscal)</td><td class="text-end">$ <?= number_format((float)$totCompras['iva'], 2, ',', '.') ?></td></tr>
                <tr><td>Percepciones de IVA de compras</td><td class="text-end">$ <?= number_format((float)$totCompras['percepcion_iva'], 2, ',', '.') ?></td></tr>
                <tr class="table-success">
                    <td><strong>Crédito fiscal total</strong></td>
                    <td class="text-end"><strong>$ <?= number_format($creditoFiscal, 2, ',', '.') ?></strong></td>
                </tr>
                <tr><td>Resultado del período (débito − crédito)</td>
                    <td class="text-end">$ <?= number_format($resultado, 2, ',', '.') ?></td></tr>
                <tr>
                    <td>
                        Saldo técnico anterior (a favor)
                        <form method="POST" action="<?= BASE_URL ?>/reportes-contables/posicion-iva/saldo-tecnico" class="d-flex gap-1 mt-1">
                            <input type="hidden" name="mes" value="<?= $rango['mes'] ?>">
                            <input type="hidden" name="anio" value="<?= $rango['anio'] ?>">
                            <input type="number" step="0.01" min="0" class="form-control form-control-sm" name="saldo_tecnico"
                                   value="<?= number_format($saldoTecnico, 2, '.', '') ?>" style="max-width:130px">
                            <button type="submit" class="btn btn-sm btn-outline-secondary">Guardar</button>
                        </form>
                    </td>
                    <td class="text-end align-top">$ <?= number_format($saldoTecnico, 2, ',', '.') ?></td>
                </tr>
                <tr class="<?= $saldoFinal >= 0 ? 'table-danger' : 'table-primary' ?>">
                    <td><strong><?= $saldoFinal >= 0 ? 'Saldo a pagar' : 'Saldo a favor' ?></strong></td>
                    <td class="text-end"><strong>$ <?= number_format(abs($saldoFinal), 2, ',', '.') ?></strong></td>
                </tr>
            </tbody>
        </table>

        <div class="alert alert-light border small">
            <i class="fas fa-info-circle me-1"></i>
            El saldo técnico anterior se carga manualmente (es el saldo a favor que quedó del período previo según tu último FD865/declaración).
            El cálculo es: resultado = débito − crédito; saldo final = resultado − saldo técnico.
        </div>
    </div>
</div>
