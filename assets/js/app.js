/**
 * app.js — comportamiento compartido del layout (Fase 2)
 * Vanilla JS, sin dependencias más allá de Bootstrap bundle.
 */
(function () {
  'use strict';

  var body = document.body;
  var toggle = document.querySelector('[data-sidebar-toggle]');
  var backdrop = document.querySelector('[data-sidebar-close]');

  function cerrarSidebar() {
    body.classList.remove('sidebar-open');
    if (toggle) { toggle.setAttribute('aria-expanded', 'false'); }
  }

  // --- Sidebar colapsable en móvil ---
  if (toggle) {
    toggle.addEventListener('click', function () {
      var abierto = body.classList.toggle('sidebar-open');
      toggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
  }
  if (backdrop) { backdrop.addEventListener('click', cerrarSidebar); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { cerrarSidebar(); }
  });

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

  // --- Modo claro/oscuro: toggle + persistencia ---
  // El atributo data-theme en <html> lo fija el anti-FOUC del layout antes del CSS.
  var themeIcon = document.querySelector('[data-theme-icon]');

  function pintarIconoTema() {
    var oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
    if (themeIcon) {
      themeIcon.classList.toggle('bi-moon-stars', !oscuro);
      themeIcon.classList.toggle('bi-sun', oscuro);
    }
  }
  pintarIconoTema();

  document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
      var nuevo = oscuro ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nuevo);
      try { localStorage.setItem('theme', nuevo); } catch (e) { /* almacenamiento no disponible */ }
      pintarIconoTema();
    });
  });
})();
