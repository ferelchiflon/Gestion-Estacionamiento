<?php
/**
 * ============================================================================
 * /bot/admin — Panel de mejora de la base de conocimiento del asistente
 * ============================================================================
 * - Métricas de uso y feedback ("¿Te sirvió?").
 * - Preguntas que el bot NO pudo responder (sin_respuesta=1) para saber qué
 *   agregar a app/Bot/conocimiento.php.
 * - Temas con más feedback positivo / negativo.
 * ============================================================================
 */
$titulo = $titulo ?? 'Asistente · Base de conocimiento';
$fmtFecha = fn(?string $f): string => $f ? date('d/m/Y H:i', strtotime($f)) : '—';
?>

<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
    <h1 class="h3 mb-0"><i class="fas fa-robot me-2"></i>Asistente · Base de conocimiento</h1>
    <div class="d-flex gap-2">
        <span class="badge bg-secondary">KB v<?= htmlspecialchars($kbVersion) ?></span>
        <span class="badge bg-info text-dark"><?= (int)$kbTotal ?> temas</span>
        <a href="<?= BASE_URL ?>/dashboard" class="btn btn-sm btn-outline-secondary"><i class="fas fa-arrow-left me-1"></i>Volver</a>
    </div>
</div>

<!-- Métricas -->
<div class="row mb-4">
    <div class="col-md-2 col-6">
        <div class="card text-center h-100"><div class="card-body">
            <h6 class="text-muted">Consultas totales</h6>
            <p class="display-6 mb-0"><?= (int)$stats['total'] ?></p>
        </div></div>
    </div>
    <div class="col-md-2 col-6">
        <div class="card text-center h-100"><div class="card-body">
            <h6 class="text-muted">Hoy</h6>
            <p class="display-6 mb-0"><?= (int)$stats['hoy'] ?></p>
        </div></div>
    </div>
    <div class="col-md-3 col-6">
        <div class="card text-center h-100 border-warning"><div class="card-body">
            <h6 class="text-muted">Sin respuesta</h6>
            <p class="display-6 mb-0 text-warning"><?= (int)$stats['sin_respuesta'] ?></p>
        </div></div>
    </div>
    <div class="col-md-2 col-6">
        <div class="card text-center h-100 border-success"><div class="card-body">
            <h6 class="text-muted">👍 Útiles</h6>
            <p class="display-6 mb-0 text-success"><?= (int)$stats['utiles'] ?></p>
        </div></div>
    </div>
    <div class="col-md-3 col-6">
        <div class="card text-center h-100 border-danger"><div class="card-body">
            <h6 class="text-muted">👎 No útiles</h6>
            <p class="display-6 mb-0 text-danger"><?= (int)$stats['no_utiles'] ?></p>
        </div></div>
    </div>
</div><div class="row mb-4">
    <!-- Sin respuesta (últimas) -->
    <div class="col-lg-7 mb-3">
        <div class="card h-100">
            <div class="card-header"><i class="fas fa-question-circle me-1"></i> Preguntas sin respuesta (últimas 50)</div>
            <div class="card-body">
                <?php if (empty($sinRespuesta)): ?>
                    <p class="text-muted text-center py-4 mb-0">El bot respondió todo por ahora. ✓</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead><tr><th>Fecha</th><th>Pantalla</th><th>Pregunta</th></tr></thead>
                        <tbody>
                            <?php foreach ($sinRespuesta as $p): ?>
                            <tr>
                                <td class="text-nowrap"><?= $fmtFecha($p['fecha']) ?></td>
                                <td><code class="small"><?= htmlspecialchars((string)($p['pantalla'] ?? '')) ?></code></td>
                                <td><?= htmlspecialchars((string)$p['pregunta']) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Frecuentes sin respuesta -->
    <div class="col-lg-5 mb-3">
        <div class="card h-100">
            <div class="card-header"><i class="fas fa-fire me-1"></i> Más frecuentes sin respuesta</div>
            <div class="card-body">
                <?php if (empty($frecuentes)): ?>
                    <p class="text-muted text-center py-4 mb-0">Sin datos todavía.</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead><tr><th>Pregunta</th><th class="text-end">Veces</th><th>Última</th></tr></thead>
                        <tbody>
                            <?php foreach ($frecuentes as $f): ?>
                            <tr>
                                <td><?= htmlspecialchars((string)$f['pregunta']) ?></td>
                                <td class="text-end"><span class="badge bg-warning text-dark"><?= (int)$f['veces'] ?></span></td>
                                <td class="text-nowrap"><?= $fmtFecha($f['ultima']) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div><div class="row">
    <!-- Feedback negativo -->
    <div class="col-lg-7 mb-3">
        <div class="card h-100">
            <div class="card-header"><i class="fas fa-thumbs-down me-1"></i> Respuestas marcadas "no sirvió" (últimas 50)</div>
            <div class="card-body">
                <?php if (empty($noUtiles)): ?>
                    <p class="text-muted text-center py-4 mb-0">Sin feedback negativo. 🎉</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead><tr><th>Fecha</th><th>Pantalla</th><th>Pregunta</th><th>Tema</th></tr></thead>
                        <tbody>
                            <?php foreach ($noUtiles as $n): ?>
                            <tr>
                                <td class="text-nowrap"><?= $fmtFecha($n['fecha']) ?></td>
                                <td><code class="small"><?= htmlspecialchars((string)($n['pantalla'] ?? '')) ?></code></td>
                                <td><?= htmlspecialchars((string)$n['pregunta']) ?></td>
                                <td class="small text-muted"><?= htmlspecialchars($titulos[$n['entrada_id']] ?? (string)($n['entrada_id'] ?? '—')) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Feedback positivo -->
    <div class="col-lg-5 mb-3">
        <div class="card h-100">
            <div class="card-header"><i class="fas fa-thumbs-up me-1"></i> Temas con mejor feedback</div>
            <div class="card-body">
                <?php if (empty($utilesPorTema)): ?>
                    <p class="text-muted text-center py-4 mb-0">Sin feedback todavía. Aparecerá cuando usen el 👍 del widget.</p>
                <?php else: ?>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead><tr><th>Tema</th><th class="text-end">👍</th></tr></thead>
                        <tbody>
                            <?php foreach ($utilesPorTema as $u): ?>
                            <tr>
                                <td><?= htmlspecialchars($titulos[$u['entrada_id']] ?? (string)$u['entrada_id']) ?></td>
                                <td class="text-end"><span class="badge bg-success"><?= (int)$u['veces'] ?></span></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php endif; ?>
                <hr>
                <p class="small text-muted mb-0">
                    <i class="fas fa-lightbulb me-1"></i>
                    Para enseñarle respuestas nuevas al bot, editá
                    <code>app/Bot/conocimiento.php</code>: cada entrada lleva id, título,
                    preguntas de ejemplo, palabras clave, respuesta y link interno.
                </p>
            </div>
        </div>
    </div>
</div>