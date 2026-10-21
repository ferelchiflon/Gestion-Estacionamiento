<?php $titulo = 'Registrar Ingreso'; ?>

<div class="row">
    <div class="col-md-6 mx-auto">
        <div class="card">
            <div class="card-body">
                <form action="<?= BASE_URL ?>/movimientos/ingreso" method="POST" id="formIngreso">
                    <div class="mb-3">
                        <label for="patente" class="form-label">Patente</label>
                        <input type="text" class="form-control" id="patente" name="patente" 
                               required pattern="[A-Z0-9]{6,7}" placeholder="ABC123" autofocus>
                        <div id="patenteInfo" class="form-text"></div>
                    </div>
                    
                    <div class="mb-3">
                        <label for="plaza_id" class="form-label">Plaza</label>
                        <select class="form-select" id="plaza_id" name="plaza_id" required>
                            <option value="">Seleccionar plaza</option>
                            <?php foreach($plazas as $plaza): ?>
                                <option value="<?= $plaza['id'] ?>">
                                    N° <?= $plaza['numero'] ?> - Sector <?= $plaza['sector'] ?> 
                                    (<?= $plaza['tipo_vehiculo'] ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <div id="clienteInfo" class="alert alert-info d-none"></div>
                        <div id="deudaInfo" class="alert alert-warning d-none"></div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="fas fa-check"></i> Registrar Ingreso
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>

<script>
document.getElementById('patente').addEventListener('blur', function() {
    const patente = this.value;
    if(patente.length >= 6) {
        fetch(`<?= BASE_URL ?>/api/v1/vehiculos.php?patente=${patente}`)
            .then(response => response.json())
            .then(data => {
                if(data.exists) {
                    document.getElementById('clienteInfo').innerHTML = `
                        <i class="fas fa-user"></i> Cliente: ${data.cliente_nombre}<br>
                        <i class="fas fa-car"></i> Vehículo: ${data.marca} ${data.modelo} (${data.tipo})
                    `;
                    document.getElementById('clienteInfo').classList.remove('d-none');
                    
                    if(data.tiene_deuda) {
                        document.getElementById('deudaInfo').innerHTML = `
                            <i class="fas fa-exclamation-triangle"></i> 
                            ATENCIÓN: Este cliente tiene una deuda de $${data.monto_deuda}
                        `;
                        document.getElementById('deudaInfo').classList.remove('d-none');
                    } else {
                        document.getElementById('deudaInfo').classList.add('d-none');
                    }
                } else {
                    document.getElementById('clienteInfo').innerHTML = `
                        <i class="fas fa-info-circle"></i> 
                        Vehículo no registrado. Se creará un cliente ocasional.
                    `;
                    document.getElementById('clienteInfo').classList.remove('d-none');
                }
            });
    }
});
</script>