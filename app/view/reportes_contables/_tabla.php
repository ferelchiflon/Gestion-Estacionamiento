<?php
/**
 * Tabla genérica compartida de los reportes contables.
 * Requiere: $encabezados, $filas, $totalesFila, $numericas.
 */
$numericas = $numericas ?? [];
?>

<?php if(empty($filas)): ?>
<div class="alert alert-info">
    <i class="fas fa-info-circle me-1"></i> No hay datos para el período seleccionado.
</div>
<?php else: ?>
<div class="table-responsive">
    <table class="table table-sm table-hover align-middle bg-white">
        <thead class="table-light">
            <tr>
                <?php foreach($encabezados as $i => $h): ?>
                <th class="<?= in_array($i, $numericas, true) ? 'text-end' : '' ?>"><?= htmlspecialchars((string)$h) ?></th>
                <?php endforeach; ?>
            </tr>
        </thead>
        <tbody>
            <?php foreach($filas as $fila): ?>
            <tr>
                <?php foreach($fila as $i => $celda): ?>
                <td class="<?= in_array($i, $numericas, true) ? 'text-end' : '' ?>"><?= htmlspecialchars((string)$celda) ?></td>
                <?php endforeach; ?>
            </tr>
            <?php endforeach; ?>
        </tbody>
        <?php if(!empty($totalesFila)): ?>
        <tfoot class="table-light fw-bold">
            <tr>
                <?php foreach($totalesFila as $i => $celda): ?>
                <td class="<?= in_array($i, $numericas, true) ? 'text-end' : '' ?>"><?= htmlspecialchars((string)$celda) ?></td>
                <?php endforeach; ?>
            </tr>
        </tfoot>
        <?php endif; ?>
    </table>
</div>
<?php endif; ?>
