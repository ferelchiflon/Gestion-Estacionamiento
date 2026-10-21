<?php $titulo = 'Recibo'; ?>

<div class="row">
    <div class="col-md-8 mx-auto">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-receipt"></i> Recibo N° <?= str_pad($recibo['id'], 6, '0', STR_PAD_LEFT) ?></span>
                <span class="badge bg-<?= $recibo['enviado_email'] ? 'success' : 'secondary' ?>">
                    <?= $recibo['enviado_email'] ? 'Enviado por email' : 'No enviado' ?>
                </span>
            </div>
            <div class="card-body">
                <dl class="row">
                    <dt class="col-4">Fecha</dt>
                    <dd class="col-8"><?= date('d/m/Y H:i', strtotime($recibo['fecha_emision'])) ?></dd>
                    <dt class="col-4">Cliente</dt>
                    <dd class="col-8"><?= $recibo['cliente_nombre'] ?? 'Consumidor final' ?></dd>
                    <?php if(!empty($recibo['patente'])): ?>
                    <dt class="col-4">Patente</dt>
                    <dd class="col-8"><?= $recibo['patente'] ?></dd>
                    <dt class="col-4">Período</dt>
                    <dd class="col-8">
                        <?= date('d/m H:i', strtotime($recibo['hora_entrada'])) ?> —
                        <?= $recibo['hora_salida'] ? date('d/m H:i', strtotime($recibo['hora_salida'])) : '-' ?>
                    </dd>
                    <?php endif; ?>
                    <dt class="col-4">Forma de pago</dt>
                    <dd class="col-8"><?= ucfirst($recibo['forma_pago'] ?? '-') ?></dd>
                    <dt class="col-4">Monto</dt>
                    <dd class="col-8"><strong class="fs-4">$<?= number_format($recibo['monto'], 2) ?></strong></dd>
                </dl>
            </div>
            <div class="card-footer d-flex gap-2">
                <a href="<?= BASE_URL ?>/recibos/pdf/<?= $recibo['id'] ?>" class="btn btn-outline-primary" target="_blank">
                    <i class="fas fa-print"></i> Imprimir / PDF
                </a>
                <form action="<?= BASE_URL ?>/recibos/enviar" method="POST" class="d-inline">
                    <input type="hidden" name="recibo_id" value="<?= $recibo['id'] ?>">
                    <button type="submit" class="btn btn-outline-success" <?= empty($recibo['email']) ? 'disabled' : '' ?>>
                        <i class="fas fa-envelope"></i> Enviar por email
                    </button>
                </form>
                <a href="<?= BASE_URL ?>/dashboard" class="btn btn-secondary ms-auto">Volver</a>
            </div>
        </div>
    </div>
</div>
