/* ==========================================================================
   BOT — Lógica del widget (vanilla JS, sin librerías)
   · POST a /bot/mensaje (texto o entrada_id), /bot/feedback y /bot/limpiar.
   · Todo el HTML de las respuestas viene escapado desde el servidor.
   · Enter envía · autoscroll · "escribiendo…" · ¿Te sirvió? · sugerencias.
   ========================================================================== */
(function () {
  'use strict';

  var cfg = window.BOT_CFG || {};
  var BASE = (cfg.base || '').replace(/\/$/, '');
  var fab = document.getElementById('botFab');
  var panel = document.getElementById('botPanel');
  var chat = document.getElementById('botChat');
  var form = document.getElementById('botForm');
  var input = document.getElementById('botInput');
  var btnEnviar = document.getElementById('botEnviar');
  var btnLimpiar = document.getElementById('botLimpiar');
  var enviando = false;
  var bienvenidaMostrada = false;

  /* ---------- utilidades ---------- */

  function el(tag, clase, html) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function scrollAbajo() {
    chat.scrollTop = chat.scrollHeight;
  }

  function escapar(texto) {
    var d = document.createElement('div');
    d.textContent = texto;
    return d.innerHTML;
  }

  function stripTags(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent || '';
  }

  function postear(url, datos) {
    var fd = new FormData();
    Object.keys(datos || {}).forEach(function (k) { fd.append(k, datos[k]); });
    return fetch(BASE + url, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }).then(function (r) { return r.json(); });
  }

  /* ---------- burbujas ---------- */

  function burbujaUsuario(texto) {
    chat.appendChild(el('div', 'bot-msg bot-msg-user', escapar(texto)));
    scrollAbajo();
  }

  function indicadorEscribiendo() {
    var b = el('div', 'bot-msg bot-msg-bot');
    b.innerHTML = '<span class="bot-escribiendo"><span></span><span></span><span></span></span>';
    chat.appendChild(b);
    scrollAbajo();
    return b;
  }

  function burbujaBot(html, respuesta) {
    var b = el('div', 'bot-msg bot-msg-bot', html);

    if (respuesta && respuesta.opciones && respuesta.opciones.length) {
      var cont = el('div', 'bot-opciones');
      respuesta.opciones.forEach(function (op) {
        var btn = el('button', 'bot-opcion', escapar(op.texto));
        btn.type = 'button';
        btn.addEventListener('click', function () {
          cont.remove();
          enviarEntradaId(op.id, op.texto);
        });
        cont.appendChild(btn);
      });
      b.appendChild(cont);
    }

    if (respuesta && respuesta.tipo === 'respuesta' && respuesta.conv_id) {
      var fbWrap = el('span', 'bot-feedback');
      fbWrap.setAttribute('data-conv', respuesta.conv_id);
      fbWrap.innerHTML = '¿Te sirvió? ' +
        '<button type="button" class="bot-fb-si" title="Sí, me sirvió" aria-label="Sí, me sirvió"><i class="fa-solid fa-thumbs-up"></i></button>' +
        '<button type="button" class="bot-fb-no" title="No me sirvió" aria-label="No me sirvió"><i class="fa-solid fa-thumbs-down"></i></button>';
      b.appendChild(fbWrap);
    }

    chat.appendChild(b);
    scrollAbajo();
    return b;
  }

  function pintarRespuesta(data) {
    if (!data || data.ok === false) {
      var msg = (data && data.html) ? stripTags(data.html) : 'Uy, hubo un error. Probá de nuevo.';
      burbujaBot('<p>' + escapar(msg) + '</p>', null);
      return;
    }
    var burbuja = burbujaBot(data.html, data);

    // Temas destacados cuando el bot no encontró la respuesta.
    if (data.temas && data.temas.length) {
      var cont = el('div', 'bot-opciones');
      data.temas.forEach(function (t) {
        var btn = el('button', 'bot-opcion', escapar(t.texto));
        btn.type = 'button';
        btn.addEventListener('click', function () { enviarTexto(t.mensaje); });
        cont.appendChild(btn);
      });
      burbuja.appendChild(cont);
      scrollAbajo();
    }
  }

  /* ---------- envío ---------- */

  function enviarTexto(texto) {
    texto = (texto || '').trim().slice(0, 300);
    if (!texto || enviando) return;
    enviando = true;
    btnEnviar.disabled = true;
    burbujaUsuario(texto);
    var typing = indicadorEscribiendo();

    postear('/bot/mensaje', { mensaje: texto, pantalla: cfg.pantalla })
      .then(function (data) { typing.remove(); pintarRespuesta(data); })
      .catch(function () { typing.remove(); burbujaBot('<p>Uy, no pude conectar. Probá de nuevo.</p>', null); })
      .finally(function () { enviando = false; btnEnviar.disabled = !input.value.trim(); input.focus(); });
  }

  function enviarEntradaId(id, etiqueta) {
    if (!id || enviando) return;
    enviando = true;
    btnEnviar.disabled = true;
    if (etiqueta) burbujaUsuario(etiqueta);
    var typing = indicadorEscribiendo();

    postear('/bot/mensaje', { entrada_id: id, pantalla: cfg.pantalla })
      .then(function (data) { typing.remove(); pintarRespuesta(data); })
      .catch(function () { typing.remove(); burbujaBot('<p>Uy, no pude conectar. Probá de nuevo.</p>', null); })
      .finally(function () { enviando = false; btnEnviar.disabled = !input.value.trim(); input.focus(); });
  }

  /* ---------- feedback ¿Te sirvió? ---------- */

  chat.addEventListener('click', function (e) {
    var btn = e.target.closest('.bot-feedback button');
    if (!btn) return;
    var cont = btn.closest('.bot-feedback');
    var convId = cont.getAttribute('data-conv');
    var util = btn.classList.contains('bot-fb-si') ? 'si' : 'no';
    cont.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    btn.classList.add('bot-elegido');
    postear('/bot/feedback', { id: convId, util: util }).catch(function () {});
  });

  /* ---------- bienvenida + historial ---------- */

  function bienvenida(forzada) {
    if (bienvenidaMostrada && !forzada) return;
    bienvenidaMostrada = true;
    burbujaBot('<p>' + escapar(cfg.saludo || '¡Hola! ¿En qué te ayudo?') + '</p>', null);
    var sugerencias = cfg.sugerencias || [];
    if (sugerencias.length) {
      var cont = el('div', 'bot-opciones');
      sugerencias.forEach(function (s) {
        var btn = el('button', 'bot-opcion', escapar(s.texto));
        btn.type = 'button';
        btn.addEventListener('click', function () { enviarTexto(s.mensaje); });
        cont.appendChild(btn);
      });
      var b = el('div', 'bot-msg bot-msg-bot');
      b.appendChild(cont);
      chat.appendChild(b);
    }
    scrollAbajo();
  }

  /* ---------- panel ---------- */

  function abrir() {
    panel.classList.add('bot-abierto');
    fab.setAttribute('aria-expanded', 'true');
    fab.setAttribute('aria-label', 'Cerrar asistente de ayuda');
    if (!chat.children.length) {
      // Reconstruye el historial corto de sesión (si hay) y la bienvenida.
      (cfg.historial || []).forEach(function (h) {
        burbujaUsuario(h.pregunta);
        burbujaBot(h.respuesta, null);
      });
      bienvenida(true);
    }
    input.focus();
  }

  function cerrar() {
    panel.classList.remove('bot-abierto');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-label', 'Abrir asistente de ayuda');
  }

  fab.addEventListener('click', function () {
    panel.classList.contains('bot-abierto') ? cerrar() : abrir();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('bot-abierto')) cerrar();
  });

  /* ---------- formulario ---------- */

  input.addEventListener('input', function () {
    btnEnviar.disabled = enviando || !input.value.trim();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var t = input.value;
      input.value = '';
      input.style.height = 'auto';
      enviarTexto(t);
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = input.value;
    input.value = '';
    input.style.height = 'auto';
    enviarTexto(t);
  });

  /* ---------- limpiar conversación ---------- */

  btnLimpiar.addEventListener('click', function () {
    chat.innerHTML = '';
    bienvenidaMostrada = false;
    bienvenida(true);
    postear('/bot/limpiar', {}).catch(function () {});
    input.focus();
  });
})();
