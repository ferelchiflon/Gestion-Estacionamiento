<?php $titulo = 'Configuración Fiscal'; ?>

<div class="row justify-content-center">
    <div class="col-12 col-xl-10">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span><i class="fas fa-file-invoice"></i> Datos de la empresa (facturación e impuestos)</span>
                <span class="badge bg-secondary">ARCA (ex AFIP)</span>
            </div>
            <div class="card-body">
                <p class="text-muted small mb-4">
                    Estos datos se usan en los reportes de <strong>IVA</strong>, <strong>IIBB</strong> y
                    <strong>ARCA (ex AFIP)</strong>, en el encabezado de los PDF exportables y para
                    <strong>enviar los reportes al contador</strong> por email.
                    Si la condición frente al IVA es <em>Monotributo</em>, los reportes de ventas mostrarán
                    los totales sin discriminar IVA.
                </p>

                <form action="<?= BASE_URL ?>/configuracion-fiscal" method="POST">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label" for="razon_social">Razón social</label>
                            <input type="text" class="form-control" id="razon_social" name="razon_social" maxlength="120"
                                   value="<?= htmlspecialchars($config['razon_social'] ?? '') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="cuit">CUIT</label>
                            <input type="text" class="form-control" id="cuit" name="cuit" placeholder="20-12345678-9" maxlength="13"
                                   value="<?= htmlspecialchars($config['cuit'] ?? '') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="condicion_iva">Condición frente al IVA</label>
                            <select class="form-select" id="condicion_iva" name="condicion_iva">
                                <?php foreach($condiciones as $valor => $etiqueta): ?>
                                <option value="<?= $valor ?>" <?= ($config['condicion_iva'] ?? '') === $valor ? 'selected' : '' ?>>
                                    <?= $etiqueta ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="col-md-3">
                            <label class="form-label" for="alicuota_iva">Alícuota IVA por defecto (%)</label>
                            <input type="number" step="0.01" min="0" max="100" class="form-control" id="alicuota_iva" name="alicuota_iva"
                                   value="<?= htmlspecialchars($config['alicuota_iva'] ?? '21.00') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="alicuota_iibb">Alícuota IIBB (%)</label>
                            <input type="number" step="0.01" min="0" max="100" class="form-control" id="alicuota_iibb" name="alicuota_iibb"
                                   value="<?= htmlspecialchars($config['alicuota_iibb'] ?? '3.00') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="jurisdiccion_iibb">Jurisdicción IIBB</label>
                            <input type="text" class="form-control" id="jurisdiccion_iibb" name="jurisdiccion_iibb" maxlength="60"
                                   value="<?= htmlspecialchars($config['jurisdiccion_iibb'] ?? 'CABA') ?>">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="nro_inscripcion_iibb">N° inscripción IIBB</label>
                            <input type="text" class="form-control" id="nro_inscripcion_iibb" name="nro_inscripcion_iibb" maxlength="30"
                                   value="<?= htmlspecialchars($config['nro_inscripcion_iibb'] ?? '') ?>">
                        </div>

                        <div class="col-md-3">
                            <label class="form-label" for="punto_venta">Punto de venta</label>
                            <input type="number" min="1" max="9999" class="form-control" id="punto_venta" name="punto_venta"
                                   value="<?= htmlspecialchars($config['punto_venta'] ?? '1') ?>">
                        </div>
                        <div class="col-md-5">
                            <label class="form-label" for="email_contador">Email del contador</label>
                            <input type="email" class="form-control" id="email_contador" name="email_contador" maxlength="120"
                                   placeholder="contador@estudio.com.ar"
                                   value="<?= htmlspecialchars($config['email_contador'] ?? '') ?>">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label" for="inicio_actividades">Inicio de actividades</label>
                            <input type="date" class="form-control" id="inicio_actividades" name="inicio_actividades"
                                   value="<?= htmlspecialchars($config['inicio_actividades'] ?? '') ?>">
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="direccion">Dirección</label>
                            <input type="text" class="form-control" id="direccion" name="direccion" maxlength="150"
                                   value="<?= htmlspecialchars($config['direccion'] ?? '') ?>">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="telefono">Teléfono</label>
                            <input type="text" class="form-control" id="telefono" name="telefono" maxlength="30"
                                   value="<?= htmlspecialchars($config['telefono'] ?? '') ?>">
                        </div>
                    </div>

                    <div class="d-flex justify-content-end gap-2 mt-4">
                        <a href="<?= BASE_URL ?>/reportes" class="btn btn-outline-secondary">Volver a Reportes</a>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save me-1"></i> Guardar configuración
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
