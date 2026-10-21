<?php $titulo = 'Registrar Egreso'; ?>

<div class="row">
    <div class="col-md-6 mx-auto">
        <div class="card">
            <div class="card-header"><i class="fas fa-sign-out-alt"></i> Egreso de vehículo</div>
            <div class="card-body">
                <dl class="row">
                    <dt class="col-5">Patente</dt>
                    <dd class="col-7"><strong><?= $movimiento['patente'] ?></strong></dd>
                    <dt class="col-5">Entrada</dt>
                    <dd class="col-7"><?= date('d/m/Y H:i', strtotime($movimiento['hora_entrada'])) ?></dd>
                    <dt class="col-5">Tiempo transcurrido</dt>
                    <dd class="col-7">
                        <?php
                        $horas = ceil((time() - strtotime($movimiento['hora_entrada'])) / 3600);
                        echo $horas . ($horas == 1 ? ' hora' : ' horas');
                        ?>
                    </dd>
                </dl>
                
                <form action="<?= BASE_URL ?>/movimientos/egreso" method="POST">
                    <input type="hidden" name="movimiento_id" value="<?= $movimiento['id'] ?>">
                    
                    <div class="mb-3">
                        <label for="forma_pago" class="form-label">Forma de pago</label>
                        <select class="form-select" id="forma_pago" name="forma_pago" required>
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="saldo_prepago">Saldo prepago</option>
                        </select>
                    </div>
                    
                    <button type="submit" class="btn btn-warning w-100">
                        <i class="fas fa-check"></i> Confirmar egreso y cobrar
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>
