<?php $titulo = 'Historial de Notificaciones'; ?>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-history"></i> Últimas 100 notificaciones</span>
                <a href="<?= BASE_URL ?>/notificaciones/configuracion" class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-cog"></i> Configurar
                </a>
            </div>
            <div class="card-body">
                <?php if(empty($notificaciones)): ?>
                    <p class="text-muted text-center py-4">No hay notificaciones enviadas todavía.</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-sm table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Canal</th>
                                <th>Tipo</th>
                                <th>Destinatario</th>
                                <th>Mensaje</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach($notificaciones as $n): ?>
                            <tr>
                                <td><?= date('d/m/Y H:i', strtotime($n['fecha_envio'])) ?></td>
                                <td><?= htmlspecialchars($n['cliente_nombre'] ?? '-') ?></td>
                                <td><span class="badge bg-info text-dark"><?= $n['canal'] ?></span></td>
                                <td><?= $n['tipo'] ?></td>
                                <td><?= $n['destinatario'] ?? '-' ?></td>
                                <td><small><?= htmlspecialchars(mb_substr($n['mensaje'] ?? '', 0, 80)) ?></small></td>
                                <td>
                                    <span class="badge bg-<?= $n['estado'] === 'enviado' ? 'success' : 'warning text-dark' ?>">
                                        <?= $n['estado'] ?>
                                    </span>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>
