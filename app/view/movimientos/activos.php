<?php $titulo = 'Vehículos Activos'; ?>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-car"></i> Vehículos en el estacionamiento</span>
                <a href="<?= BASE_URL ?>/movimientos/ingreso" class="btn btn-sm btn-primary">
                    <i class="fas fa-plus"></i> Nuevo ingreso
                </a>
            </div>
            <div class="card-body">
                <?php if(empty($movimientos)): ?>
                    <p class="text-muted text-center py-4">No hay vehículos ingresados en este momento.</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Patente</th>
                                <th>Vehículo</th>
                                <th>Plaza</th>
                                <th>Entrada</th>
                                <th>Tiempo</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach($movimientos as $mov): ?>
                            <tr>
                                <td><strong><?= $mov['patente'] ?></strong></td>
                                <td><?= $mov['marca'] ?> <?= $mov['modelo'] ?> <span class="badge bg-secondary"><?= $mov['tipo'] ?></span></td>
                                <td>N° <?= $mov['plaza_numero'] ?></td>
                                <td><?= date('d/m H:i', strtotime($mov['hora_entrada'])) ?></td>
                                <td>
                                    <?php
                                    $horas = (time() - strtotime($mov['hora_entrada'])) / 3600;
                                    echo $horas < 1 ? floor($horas * 60) . ' min' : round($horas, 1) . ' h';
                                    ?>
                                </td>
                                <td>
                                    <a href="<?= BASE_URL ?>/movimientos/egreso/<?= $mov['id'] ?>" class="btn btn-sm btn-warning">
                                        <i class="fas fa-sign-out-alt"></i> Egreso
                                    </a>
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
