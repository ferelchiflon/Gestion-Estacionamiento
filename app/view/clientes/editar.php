<?php $titulo = 'Editar Cliente'; ?>

<div class="row">
    <div class="col-md-6 mx-auto">
        <div class="card">
            <div class="card-header"><i class="fas fa-user-edit"></i> Editar: <?= htmlspecialchars($cliente['nombre']) ?></div>
            <div class="card-body">
                <form action="<?= BASE_URL ?>/clientes/editar/<?= $cliente['id'] ?>" method="POST">
                    <div class="mb-3">
                        <label class="form-label">Nombre *</label>
                        <input type="text" class="form-control" name="nombre" required minlength="3"
                               value="<?= htmlspecialchars($cliente['nombre']) ?>">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Documento</label>
                        <input type="text" class="form-control" name="documento" value="<?= $cliente['documento'] ?? '' ?>">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" name="email" value="<?= $cliente['email'] ?? '' ?>">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Teléfono</label>
                        <input type="text" class="form-control" name="telefono" value="<?= $cliente['telefono'] ?? '' ?>">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Saldo prepagado</label>
                        <input type="number" class="form-control" name="saldo_actual" step="0.01" min="0"
                               value="<?= $cliente['saldo_actual'] ?>">
                    </div>
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="fas fa-check"></i> Guardar cambios
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>
