<?php $titulo = 'Clientes'; ?>

<div class="row mb-3">
    <div class="col-md-6">
        <form action="<?= BASE_URL ?>/clientes/buscar" method="POST" class="d-flex gap-2">
            <input type="text" class="form-control" name="term" placeholder="Buscar por nombre, documento o email..."
                   value="<?= htmlspecialchars($busqueda ?? '') ?>">
            <button type="submit" class="btn btn-outline-primary"><i class="fas fa-search"></i></button>
        </form>
    </div>
    <div class="col-md-6 text-end">
        <a href="<?= BASE_URL ?>/clientes/crear" class="btn btn-primary">
            <i class="fas fa-user-plus"></i> Nuevo cliente
        </a>
    </div>
</div>

<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header"><i class="fas fa-users"></i> Listado de clientes (<?= count($clientes) ?>)</div>
            <div class="card-body">
                <?php if(empty($clientes)): ?>
                    <p class="text-muted text-center py-4">No se encontraron clientes.</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Documento</th>
                                <th>Email</th>
                                <th>Teléfono</th>
                                <th>Saldo</th>
                                <th>Vehículos</th>
                                <th>Deuda</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach($clientes as $cli): ?>
                            <tr>
                                <td><strong><?= htmlspecialchars($cli['nombre']) ?></strong></td>
                                <td><?= $cli['documento'] ?? '-' ?></td>
                                <td><?= $cli['email'] ?? '-' ?></td>
                                <td><?= $cli['telefono'] ?? '-' ?></td>
                                <td>$<?= number_format($cli['saldo_actual'], 2) ?></td>
                                <td><span class="badge bg-info text-dark"><?= $cli['cantidad_vehiculos'] ?? 0 ?></span></td>
                                <td>
                                    <?php $deuda = (float)($cli['deuda_total'] ?? 0); ?>
                                    <?php if($deuda > 0): ?>
                                        <span class="badge bg-danger">$<?= number_format($deuda, 2) ?></span>
                                    <?php else: ?>
                                        <span class="badge bg-success">Al día</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <a href="<?= BASE_URL ?>/clientes/ver/<?= $cli['id'] ?>" class="btn btn-sm btn-outline-secondary" title="Ver"><i class="fas fa-eye"></i></a>
                                    <a href="<?= BASE_URL ?>/clientes/editar/<?= $cli['id'] ?>" class="btn btn-sm btn-outline-primary" title="Editar"><i class="fas fa-edit"></i></a>
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
