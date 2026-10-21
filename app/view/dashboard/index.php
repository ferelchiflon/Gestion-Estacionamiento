<?php $titulo = 'Dashboard'; ?>
<!-- Chart.js: única vista que lo usa (movido aquí desde el layout en Fase 2) -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<div class="row">
    <!-- Tarjetas de resumen -->
    <div class="col-md-3 mb-3">
        <div class="card text-white bg-primary">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="card-title">Lugares Ocupados</h6>
                        <h2 class="mb-0"><?= $ocupacion['ocupadas'] ?> / <?= $ocupacion['total'] ?></h2>
                    </div>
                    <i class="fas fa-parking fa-2x"></i>
                </div>
                <small class="text-white-50"><?= $ocupacion['libres'] ?> lugares libres</small>
            </div>
        </div>
    </div>
    
    <div class="col-md-3 mb-3">
        <div class="card text-white bg-success">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="card-title">Ingresos Hoy</h6>
                        <h2 class="mb-0">$<?= number_format($caja_hoy['efectivo'] + $caja_hoy['tarjeta'], 2) ?></h2>
                    </div>
                    <i class="fas fa-dollar-sign fa-2x"></i>
                </div>
                <small>Efectivo: $<?= number_format($caja_hoy['efectivo'], 2) ?></small>
            </div>
        </div>
    </div>
    
    <div class="col-md-3 mb-3">
        <div class="card text-white bg-danger">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="card-title">Clientes Morosos</h6>
                        <h2 class="mb-0"><?= $deudores ?></h2>
                    </div>
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                </div>
                <small>Con deudas pendientes</small>
            </div>
        </div>
    </div>
    
    <div class="col-md-3 mb-3">
        <div class="card text-white bg-info">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="card-title">Alquileres Activos</h6>
                        <h2 class="mb-0"><?= $alquileres_activos ?></h2>
                    </div>
                    <i class="fas fa-calendar-check fa-2x"></i>
                </div>
                <small>Contratos vigentes</small>
            </div>
        </div>
    </div>
</div>

<!-- Alertas del sistema -->
<?php if(!empty($alertas)): ?>
    <div class="row mb-3">
        <div class="col-12">
            <?php foreach($alertas as $alerta): ?>
                <div class="alert alert-<?= $alerta['tipo'] ?> alert-dismissible fade show" role="alert">
                    <i class="fas fa-bell"></i> <?= $alerta['mensaje'] ?>
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
<?php endif; ?>

<div class="row">
    <!-- Gráfico de ingresos del mes -->
    <div class="col-md-8 mb-3">
        <div class="card">
            <div class="card-header">
                <i class="fas fa-chart-line"></i> Ingresos Diarios - Mes Actual
            </div>
            <div class="card-body">
                <canvas id="ingresosChart" height="300"></canvas>
            </div>
        </div>
    </div>
    
    <!-- Top de vehículos -->
    <div class="col-md-4 mb-3">
        <div class="card">
            <div class="card-header">
                <i class="fas fa-chart-pie"></i> Tipo de Vehículos - Este Mes
            </div>
            <div class="card-body">
                <canvas id="vehiculosChart" height="250"></canvas>
            </div>
        </div>
    </div>
</div>

<!-- Movimientos recientes -->
<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header">
                <i class="fas fa-history"></i> Últimos Movimientos
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Patente</th>
                                <th>Cliente</th>
                                <th>Entrada</th>
                                <th>Salida</th>
                                <th>Monto</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach($movimientos_recientes as $mov): ?>
                            <tr>
                                <td><?= $mov['patente'] ?></td>
                                <td><?= $mov['cliente_nombre'] ?? 'Ocasional' ?></td>
                                <td><?= date('H:i', strtotime($mov['hora_entrada'])) ?></td>
                                <td><?= $mov['hora_salida'] ? date('H:i', strtotime($mov['hora_salida'])) : '-' ?></td>
                                <td>$<?= number_format($mov['monto_pagado'] ?? 0, 2) ?></td>
                                <td>
                                    <?php if(!$mov['hora_salida']): ?>
                                        <span class="badge bg-warning">Activo</span>
                                    <?php elseif($mov['estado_pago'] == 'pagado'): ?>
                                        <span class="badge bg-success">Pagado</span>
                                    <?php else: ?>
                                        <span class="badge bg-danger">Deuda</span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
// Gráfico de ingresos
const ctx1 = document.getElementById('ingresosChart').getContext('2d');
new Chart(ctx1, {
    type: 'line',
    data: {
        labels: [<?php foreach($ingresos_mes as $i): ?>'<?= $i['dia'] ?>',<?php endforeach; ?>],
        datasets: [{
            label: 'Ingresos diarios',
            data: [<?php foreach($ingresos_mes as $i): ?><?= $i['total'] ?>,<?php endforeach; ?>],
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                ticks: {
                    callback: function(value) {
                        return '$' + value;
                    }
                }
            }
        }
    }
});

// Gráfico de vehículos
const ctx2 = document.getElementById('vehiculosChart').getContext('2d');
const topVehiculos = <?= json_encode($top_vehiculos ?? []) ?>;
new Chart(ctx2, {
    type: 'pie',
    data: {
        labels: topVehiculos.map(v => v.tipo),
        datasets: [{
            data: topVehiculos.map(v => v.cantidad),
            backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0']
        }]
    }
});
</script>