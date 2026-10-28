/**
 * app.js — comportamiento compartido del layout (Fase 3 · UI espacial)
 * Vanilla JS, sin dependencias más allá de Bootstrap bundle.
 * El tema es ÚNICO oscuro: ya no hay toggle claro/oscuro ni sidebar.
 */
(function () {
  'use strict';

  // --- Toasts de mensajes flash (éxito/error/aviso) ---
  document.querySelectorAll('.toast-stack .toast').forEach(function (el) {
    if (window.bootstrap && window.bootstrap.Toast) {
      window.bootstrap.Toast.getOrCreateInstance(el).show();
    }
  });

  // --- Buscador de tablas: inputs con data-table-filter="#idTabla" ---
  document.querySelectorAll('[data-table-filter]').forEach(function (input) {
    var tabla = document.querySelector(input.getAttribute('data-table-filter'));
    if (!tabla) { return; }
    var filas = tabla.querySelectorAll('tbody tr');
    input.addEventListener('input', function () {
      var consulta = input.value.trim().toLowerCase();
      filas.forEach(function (fila) {
        var visible = fila.textContent.toLowerCase().indexOf(consulta) !== -1;
        fila.style.display = visible ? '' : 'none';
      });
    });
  });

  // --- Inclinación sutil de paneles .tilt (estilo espacial) ---
  // Solo con puntero fino y sin preferencia de movimiento reducido.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.tilt').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', (x * 5).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }
})();
