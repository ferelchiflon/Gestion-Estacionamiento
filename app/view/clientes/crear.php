<?php $titulo = 'Nuevo Cliente'; ?>

<div class="row">
    <div class="col-md-6 mx-auto">
        <div class="card">
            <div class="card-header"><i class="fas fa-user-plus"></i> Crear cliente</div>
            <div class="card-body">
                <form action="<?= BASE_URL ?>/clientes/crear" method="POST">
                    <div class="mb-3">
                        <label class="form-label">Nombre *</label>
                        <input type="text" class="form-control" name="nombre" required minlength="3">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Documento</label>
                        <input type="text" class="form-control" name="documento">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" name="email">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Teléfono</label>
                        <input type="text" class="form-control" name="telefono" placeholder="5491100000000">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Saldo prepagado inicial</label>
                        <input type="number" class="form-control" name="saldo_actual" step="0.01" min="0" value="0">
                    </div>
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="fas fa-check"></i> Guardar cliente
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>
