<?php
/**
 * ============================================================================
 * BASE DE CONOCIMIENTO DEL ASISTENTE ("Ayudi")
 * ============================================================================
 * Archivo editable a mano. Cada entrada documenta una función que EXISTE
 * en el sistema (rutas verificadas en index.php). Si agregás una pantalla
 * nueva, sumá una entrada acá y el bot la empieza a responder sola.
 *
 * Estructura de cada entrada:
 *  id               -> identificador único (se guarda en bot_conversaciones)
 *  modulo           -> módulo al que pertenece (para contexto y sugerencias)
 *  titulo           -> nombre corto de la función
 *  preguntas_ejemplo-> formas naturales de preguntarlo (se normalizan solas)
 *  palabras_clave   -> tokens clave YA SIN TILDES ni mayúsculas (peso alto)
 *  respuesta        -> texto corto con pasos. Formato permitido en el widget:
 *                      **negrita**, listas con "1." o "- ", y links [texto](/ruta)
 *  link             -> ruta interna relativa a BASE_URL ('' si no aplica)
 *  link_texto       -> etiqueta del botón/link
 *  roles_permitidos -> roles que pueden verla. ['*'] = todos (hoy el sistema
 *                      no tiene login; el filtro queda listo para el futuro)
 * ============================================================================
 */

return [
    'version' => '2026-10-22',

    'entradas' => [

        // ---------------------------------------------------------------
        // CONVERSACIÓN BÁSICA
        // ---------------------------------------------------------------
        [
            'id' => 'conv_saludo', 'modulo' => 'general', 'titulo' => 'Saludo',
            'preguntas_ejemplo' => ['hola', 'buenas', 'buen dia', 'que tal', 'hey', 'como estas', 'todo bien'],
            'palabras_clave' => ['hola', 'buenas', 'buenos dias', 'buen dia', 'buenas tardes', 'buenas noches', 'que tal', 'hey', 'holis'],
            'respuesta' => "¡Hola! 👋 Soy **Ayudi**, el asistente del sistema de estacionamiento.\nPuedo explicarte cómo usar cualquier función, ayudarte con conceptos de impuestos y darte datos al instante (ocupación, caja, deudas).\n¿Qué necesitás?",
            'link' => '', 'link_texto' => '', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'conv_agradecimiento', 'modulo' => 'general', 'titulo' => 'Agradecimiento',
            'preguntas_ejemplo' => ['gracias', 'muchas gracias', 'genial', 'perfecto', 'excelente', 'muy util', 'de diez'],
            'palabras_clave' => ['gracias', 'grax', 'genial', 'perfecto', 'excelente', 'buenisimo', 'util', 'increible', 'de diez', 'impecable'],
            'respuesta' => "¡De nada! 😊 Si necesitás otra mano, acá estoy.",
            'link' => '', 'link_texto' => '', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'conv_despedida', 'modulo' => 'general', 'titulo' => 'Despedida',
            'preguntas_ejemplo' => ['chau', 'adios', 'hasta luego', 'nos vemos', 'listo gracias'],
            'palabras_clave' => ['chau', 'adios', 'hasta luego', 'nos vemos', 'hasta manana', 'me voy'],
            'respuesta' => "¡Hasta la próxima! 🚗 Cualquier duda con el sistema o los impuestos, me escribís.",
            'link' => '', 'link_texto' => '', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'conv_que_podes_hacer', 'modulo' => 'general', 'titulo' => '¿Qué podés hacer?',
            'preguntas_ejemplo' => ['que podes hacer', 'que sabes hacer', 'como funcionas', 'ayuda', 'para que servis', 'que consultas puedo hacerte', 'como te uso'],
            'palabras_clave' => ['que podes hacer', 'que sabes hacer', 'ayuda', 'funciones', 'como funcionas', 'capacidades', 'comandos', 'para que servis', 'menu'],
            'respuesta' => "Te puedo ayudar con 3 cosas:\n1. **Cómo se usa** cada función: entradas y salidas, cobrar, contratos, deudas, gastos, reportes, etc.\n2. **Conceptos de impuestos** en simple: IVA, débito/crédito fiscal, ARCA ex AFIP, IIBB, balance, percepciones y retenciones.\n3. **Datos al instante** (solo lectura): ocupación actual, ingresos del mes, deuda pendiente, contratos por vencer.\nProbá por ejemplo: **\"¿cuántos lugares libres hay?\"** o **\"¿cómo cobro una salida?\"**",
            'link' => '', 'link_texto' => '', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'conv_consultas_datos', 'modulo' => 'general', 'titulo' => 'Datos que puedo consultarte',
            'preguntas_ejemplo' => ['que datos puedo consultar', 'que numeros me podes dar', 'puedo preguntarte por la ocupacion', 'que informacion tenes'],
            'palabras_clave' => ['datos', 'consultar', 'consultas', 'numeros', 'cifras', 'informacion', 'resumen'],
            'respuesta' => "Puedo darte estos datos **al instante** (solo lectura, no modifico nada):\n1. Ocupación actual: libres, ocupadas y en mantenimiento.\n2. Ingresos y operaciones del mes.\n3. Deuda pendiente total.\n4. Contratos de alquiler activos y por vencer (próximos N días).\nPreguntame directo: **\"¿cuál es la deuda total?\"** o **\"¿qué contratos vencen en 15 días?\"**",
            'link' => '/reportes', 'link_texto' => 'Ver reportes', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // DASHBOARD
        // ---------------------------------------------------------------
        [
            'id' => 'dash_inicio', 'modulo' => 'dashboard', 'titulo' => 'Pantalla de inicio (Dashboard)',
            'preguntas_ejemplo' => ['que veo en el inicio', 'para que sirve el dashboard', 'donde veo el resumen del dia', 'pantalla principal'],
            'palabras_clave' => ['inicio', 'dashboard', 'principal', 'resumen', 'panel', 'pantalla inicial'],
            'respuesta' => "El **dashboard** es el resumen del día:\n1. Ocupación actual con un anillo de progreso.\n2. Caja de hoy (ingresos por movimientos y alquileres).\n3. Mapa de plazas con su estado.\n4. Alertas: deudas, contratos y aviso de tarifa vencida.",
            'link' => '/dashboard', 'link_texto' => 'Ir al inicio', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // MOVIMIENTOS
        // ---------------------------------------------------------------
        [
            'id' => 'mov_ingreso', 'modulo' => 'movimientos', 'titulo' => 'Registrar la entrada de un vehículo',
            'preguntas_ejemplo' => ['como registro una entrada', 'como ingreso un auto', 'registrar ingreso de vehiculo', 'un auto acaba de entrar que hago', 'cargo un auto que llego'],
            'palabras_clave' => ['entrada', 'ingreso', 'ingresar', 'entrar', 'llego auto', 'llegada', 'registro entrada', 'registrar entrada', 'nuevo movimiento', 'estacionar'],
            'respuesta' => "Para registrar la **entrada** de un vehículo:\n1. Andá a **Movimientos → Ingreso**.\n2. Escribí la patente y buscá (si el vehículo ya existe, se cargan sus datos solo).\n3. Si es un vehículo nuevo: se abre el alta rápida con cliente ocasional y el ingreso queda registrado en el mismo paso.\n4. Confirmá: la plaza pasa a **ocupada** y el movimiento queda activo.",
            'link' => '/movimientos/ingreso', 'link_texto' => 'Ir a registrar ingreso', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'mov_egreso', 'modulo' => 'movimientos', 'titulo' => 'Registrar salida y cobrar (egreso)',
            'preguntas_ejemplo' => ['como cobro una salida', 'como hago el egreso de un auto', 'registrar salida de vehiculo', 'cobrar el estacionamiento', 'el cliente se va a retirar'],
            'palabras_clave' => ['salida', 'egreso', 'cobrar', 'cobro', 'cobranza', 'pagar salida', 'retiro', 'retira', 'finalizar movimiento', 'cerrar movimiento'],
            'respuesta' => "Para registrar la **salida** y cobrar:\n1. Andá a **Movimientos → Activos** y tocá **Egreso** en el vehículo que se retira.\n2. El sistema calcula las horas por la tarifa vigente.\n3. Elegí la forma de pago: **efectivo**, **tarjeta** o **saldo prepago**.\n4. Si paga todo → se genera el **recibo** automático. Si queda debiendo → se crea la **deuda** y una notificación.\n⚠️ El bot no puede cobrar por vos: los cobros se hacen desde esa pantalla.",
            'link' => '/movimientos/activos', 'link_texto' => 'Ver vehículos activos', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'mov_activos', 'modulo' => 'movimientos', 'titulo' => 'Vehículos actualmente en el estacionamiento',
            'preguntas_ejemplo' => ['que autos hay adentro', 'ver movimientos activos', 'que vehiculos estan estacionados', 'cuantos autos hay ahora'],
            'palabras_clave' => ['activos', 'adentro', 'estacionados', 'autos dentro', 'vehiculos actuales', 'en el momento', 'ahora mismo'],
            'respuesta' => "En **Movimientos → Activos** ves todos los vehículos que están adentro ahora, con su hora de entrada, plaza y el botón **Egreso** para cobrar la salida cuando se retiren.",
            'link' => '/movimientos/activos', 'link_texto' => 'Ver vehículos activos', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'mov_historial', 'modulo' => 'movimientos', 'titulo' => 'Historial de movimientos',
            'preguntas_ejemplo' => ['donde veo los movimientos pasados', 'historial de autos', 'movimientos de ayer', 'ver movimientos del mes'],
            'palabras_clave' => ['historial', 'pasados', 'anteriores', 'ayer', 'semana anterior', 'movimientos mes', 'registros viejos'],
            'respuesta' => "El **historial** de movimientos muestra lo que ya terminó (con su cobro), filtrable por **hoy**, **semana** o **mes**. Está en Movimientos → Historial.",
            'link' => '/movimientos/historial', 'link_texto' => 'Ver historial', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'vehiculo_alta', 'modulo' => 'movimientos', 'titulo' => 'Dar de alta un vehículo nuevo',
            'preguntas_ejemplo' => ['como cargo un vehiculo nuevo', 'dar de alta un auto', 'el auto no existe en el sistema', 'registrar patente nueva'],
            'palabras_clave' => ['vehiculo nuevo', 'alta vehiculo', 'alta auto', 'patente nueva', 'no existe', 'registrar vehiculo', 'cargar auto'],
            'respuesta' => "Si al buscar la patente en el **ingreso** el vehículo no existe, el sistema te lleva al **alta rápida**: cargás marca/modelo y datos del cliente y al guardar, el ingreso se registra solo. También podés ir directo con el botón de abajo.",
            'link' => '/vehiculo/crear', 'link_texto' => 'Alta de vehículo', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // ALQUILERES / CONTRATOS
        // ---------------------------------------------------------------
        [
            'id' => 'alq_disponibilidad', 'modulo' => 'alquileres', 'titulo' => 'Disponibilidad de plazas para alquilar',
            'preguntas_ejemplo' => ['que plazas estan libres para alquilar', 'disponibilidad de cocheras', 'plazas disponibles'],
            'palabras_clave' => ['disponibilidad', 'disponibles', 'plazas libres', 'cocheras libres', 'libres alquilar', 'vacantes'],
            'respuesta' => "En **Alquileres → Disponibilidad** ves qué plazas están libres para alquilar y cuáles están ocupadas por contratos vigentes.",
            'link' => '/alquileres/disponibilidad', 'link_texto' => 'Ver disponibilidad', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'alq_nuevo_contrato', 'modulo' => 'alquileres', 'titulo' => 'Crear un contrato de alquiler',
            'preguntas_ejemplo' => ['como creo un contrato de alquiler', 'alquilar una plaza', 'nuevo contrato mensual', 'quiero alquilar una cochera'],
            'palabras_clave' => ['contrato', 'contratos', 'alquilar', 'alquiler', 'alquila', 'nuevo contrato', 'crear contrato', 'mensual', 'cochera', 'renta'],
            'respuesta' => "Para crear un **contrato de alquiler**:\n1. Andá a **Alquileres → Contratos**.\n2. Tocá el botón **Nuevo contrato**.\n3. Elegí la plaza, el cliente, el tipo (**Diario**, **Mensual** o **Anual**), el monto y el día de vencimiento.\n4. Guardá: la plaza queda reservada por el contrato y aparece en los pagos pendientes cuando corresponda.\n⚠️ Los contratos se crean desde esa pantalla; el bot solo explica el paso a paso.",
            'link' => '/alquileres/contratos', 'link_texto' => 'Ir a contratos', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'alq_pagos_pendientes', 'modulo' => 'alquileres', 'titulo' => 'Registrar el pago de un alquiler',
            'preguntas_ejemplo' => ['como registro el pago de un alquiler', 'cobrar alquiler mensual', 'pagos pendientes de contratos', 'el inquilino pago la cochera'],
            'palabras_clave' => ['pago alquiler', 'pagar alquiler', 'cobrar alquiler', 'pagos pendientes', 'vencio alquiler', 'cuota alquiler', 'abonar alquiler'],
            'respuesta' => "Para registrar el **pago de un alquiler**:\n1. Andá a **Alquileres → Pagos pendientes**.\n2. Buscá el contrato en la lista y tocá **Registrar pago**.\n3. Confirmá el monto y listo: se genera el recibo correspondiente.",
            'link' => '/alquileres/pagos-pendientes', 'link_texto' => 'Ver pagos pendientes', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // DEUDAS
        // ---------------------------------------------------------------
        [
            'id' => 'deudas_pagar', 'modulo' => 'deudas', 'titulo' => 'Registrar el pago de una deuda',
            'preguntas_ejemplo' => ['como registro el pago de una deuda', 'cobrar una deuda', 'un cliente pago lo que debia', 'cancelar deuda'],
            'palabras_clave' => ['deuda', 'deudas', 'pagar deuda', 'cobrar deuda', 'cancelar deuda', 'adeuda', 'debe', 'moroso', 'saldar'],
            'respuesta' => "Para registrar el **pago de una deuda**:\n1. Andá a **Reportes → Deudas**.\n2. En la lista, tocá **Registrar pago** en la fila correspondiente.\n3. Confirmá: la deuda queda pagada y se descuenta del total pendiente.\nLas deudas se generan solas cuando un egreso queda con saldo pendiente.",
            'link' => '/reportes/deudas', 'link_texto' => 'Ir a deudas', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // RECIBOS
        // ---------------------------------------------------------------
        [
            'id' => 'recibos_listado', 'modulo' => 'recibos', 'titulo' => 'Ver recibos emitidos',
            'preguntas_ejemplo' => ['donde veo los recibos', 'listado de recibos', 'buscar un recibo'],
            'palabras_clave' => ['recibo', 'recibos', 'comprobante', 'comprobantes', 'ticket', 'tickets'],
            'respuesta' => "Todos los **recibos** emitidos están en la sección Recibos: podés ver el detalle de cada uno, descargarlo en PDF o reenviarlo por email.",
            'link' => '/recibos', 'link_texto' => 'Ver recibos', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'recibos_pdf', 'modulo' => 'recibos', 'titulo' => 'Descargar o imprimir un recibo en PDF',
            'preguntas_ejemplo' => ['como descargo un recibo en pdf', 'imprimir un recibo', 'pasar un recibo a pdf'],
            'palabras_clave' => ['pdf', 'descargar', 'imprimir', 'imprecion', 'impresion', 'descarga'],
            'respuesta' => "Para el **PDF de un recibo**:\n1. Andá a **Recibos** y abrí el que necesitás (o el que se generó al cobrar).\n2. Tocá **Descargar PDF** / imprimir.\nTip: el PDF sale directo para imprimir, listo para entregar al cliente.",
            'link' => '/recibos', 'link_texto' => 'Ir a recibos', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'recibos_email', 'modulo' => 'recibos', 'titulo' => 'Enviar un recibo por email',
            'preguntas_ejemplo' => ['como envio un recibo por correo', 'mandar recibo al cliente por email', 'enviar comprobante por mail'],
            'palabras_clave' => ['enviar recibo', 'mandar recibo', 'recibo email', 'recibo correo', 'enviar comprobante', 'mail cliente'],
            'respuesta' => "Para **enviar un recibo por email**:\n1. Abrí el recibo desde **Recibos**.\n2. Tocá **Enviar por email** (usa la configuración SMTP de Notificaciones).\nSi falla el envío, revisá la configuración de correo.",
            'link' => '/recibos', 'link_texto' => 'Ir a recibos', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // NOTIFICACIONES
        // ---------------------------------------------------------------
        [
            'id' => 'notif_config', 'modulo' => 'notificaciones', 'titulo' => 'Configurar email (SMTP) y WhatsApp',
            'preguntas_ejemplo' => ['como configuro el correo', 'configurar whatsapp', 'donde pongo el smtp', 'configuracion de envios'],
            'palabras_clave' => ['smtp', 'correo', 'configuracion email', 'whatsapp', 'notificaciones configurar', 'servidor correo', 'mail config'],
            'respuesta' => "La configuración de envíos está en **Notificaciones → Configuración**:\n1. Cargá los datos **SMTP** (servidor, usuario, clave, puerto) para los emails.\n2. Cargá los datos de la API de **WhatsApp** si la usás.\n3. Guardá y probá con un envío manual.",
            'link' => '/notificaciones/configuracion', 'link_texto' => 'Ir a configuración', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'notif_historial', 'modulo' => 'notificaciones', 'titulo' => 'Historial de notificaciones',
            'preguntas_ejemplo' => ['que notificaciones se enviaron', 'ver historial de avisos', 'si llego el email que mande'],
            'palabras_clave' => ['historial notificaciones', 'avisos enviados', 'emails enviados', 'whatsapps enviados', 'registro envios'],
            'respuesta' => "En **Notificaciones → Historial** ves todo lo enviado: emails y WhatsApp, con fecha, destinatario y estado (enviado / error).",
            'link' => '/notificaciones/historial', 'link_texto' => 'Ver historial', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'notif_enviar', 'modulo' => 'notificaciones', 'titulo' => 'Enviar un aviso a un cliente',
            'preguntas_ejemplo' => ['como aviso a un cliente', 'enviar mensaje a un cliente', 'avisar que debe', 'alerta de tarifa'],
            'palabras_clave' => ['avisar cliente', 'enviar mensaje cliente', 'notificar cliente', 'alerta tarifa', 'aviso deuda', 'contactar cliente'],
            'respuesta' => "Para **avisar a un cliente**:\n1. Andá a **Clientes** y abrí su ficha.\n2. Usá los botones de **envío manual** por email o WhatsApp.\nAdemás el sistema manda avisos automáticos (ej. deuda al quedar un egreso impago) y hay una **alerta de tarifa** para avisar cambios de precios.",
            'link' => '/clientes', 'link_texto' => 'Ir a clientes', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // CLIENTES
        // ---------------------------------------------------------------
        [
            'id' => 'cli_listar', 'modulo' => 'clientes', 'titulo' => 'Buscar y ver clientes',
            'preguntas_ejemplo' => ['donde veo los clientes', 'buscar un cliente', 'lista de clientes'],
            'palabras_clave' => ['cliente', 'clientes', 'buscar cliente', 'listado clientes'],
            'respuesta' => "En **Clientes** está el listado completo con buscador. Desde ahí entrás a la ficha de cada uno con sus vehículos, deudas y notificaciones.",
            'link' => '/clientes', 'link_texto' => 'Ir a clientes', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'cli_crear', 'modulo' => 'clientes', 'titulo' => 'Crear un cliente',
            'preguntas_ejemplo' => ['como doy de alta un cliente', 'registrar un cliente nuevo', 'cargar un cliente'],
            'palabras_clave' => ['alta cliente', 'nuevo cliente', 'crear cliente', 'registrar cliente', 'cargar cliente'],
            'respuesta' => "Para **crear un cliente**:\n1. Andá a **Clientes → Nuevo cliente**.\n2. Cargá nombre, documento, teléfono y email.\n3. Guardá: después podés asociarle vehículos desde su ficha.\nNota: si el cliente es ocasional y solo vino a estacionar, el **ingreso de vehículo** ya lo crea automático.",
            'link' => '/clientes/crear', 'link_texto' => 'Nuevo cliente', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'cli_editar', 'modulo' => 'clientes', 'titulo' => 'Editar los datos de un cliente',
            'preguntas_ejemplo' => ['como cambio el telefono de un cliente', 'editar datos del cliente', 'actualizar un cliente'],
            'palabras_clave' => ['editar cliente', 'modificar cliente', 'cambiar datos', 'actualizar cliente', 'corregir cliente'],
            'respuesta' => "Para **editar un cliente**:\n1. Andá a **Clientes** y buscálo en la lista.\n2. Tocá **Editar** en su fila (o entrá a su ficha).\n3. Modificá los datos y guardá.",
            'link' => '/clientes', 'link_texto' => 'Ir a clientes', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'cli_ficha', 'modulo' => 'clientes', 'titulo' => 'Ficha del cliente',
            'preguntas_ejemplo' => ['que veo en la ficha del cliente', 'detalles de un cliente', 'historial de un cliente'],
            'palabras_clave' => ['ficha', 'perfil cliente', 'detalle cliente', 'ver cliente'],
            'respuesta' => "La **ficha del cliente** muestra todo junto: sus vehículos, deudas pendientes, historial y los botones para enviarle notificaciones por email o WhatsApp.",
            'link' => '/clientes', 'link_texto' => 'Ir a clientes', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // REPORTES OPERATIVOS
        // ---------------------------------------------------------------
        [
            'id' => 'rep_panel', 'modulo' => 'reportes', 'titulo' => 'Centro de reportes',
            'preguntas_ejemplo' => ['donde estan los reportes', 'que reportes hay', 'centro de reportes'],
            'palabras_clave' => ['reportes', 'reporte', 'informes', 'estadisticas'],
            'respuesta' => "En **Reportes** tenés el centro de reportes: **caja diaria**, **deudas**, **ocupación** y los **reportes contables** (IVA, ARCA). Todos se pueden exportar.",
            'link' => '/reportes', 'link_texto' => 'Ir a reportes', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'rep_caja', 'modulo' => 'reportes', 'titulo' => 'Reporte de caja diaria',
            'preguntas_ejemplo' => ['cuanto se recaudo hoy', 'reporte de caja', 'ingresos del dia', 'caja del dia'],
            'palabras_clave' => ['caja', 'recaudacion', 'recaudo', 'ingresos dia', 'caja diaria', 'cuanto juntamos', 'facturado hoy'],
            'respuesta' => "El **reporte de caja** muestra el detalle día por día del mes: ingresos por estacionamiento y por alquileres, con los totales. Ideal para cerrar la caja de la jornada.",
            'link' => '/reportes/caja', 'link_texto' => 'Ver caja', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'rep_deudas', 'modulo' => 'reportes', 'titulo' => 'Reporte de deudas',
            'preguntas_ejemplo' => ['quienes deben', 'reporte de deudas', 'ver deudas pendientes'],
            'palabras_clave' => ['reporte deudas', 'deudas pendientes', 'listado deudas', 'cuentas por cobrar'],
            'respuesta' => "El **reporte de deudas** lista todo lo pendiente de cobro, con el botón **Registrar pago** por fila para saldar cada una.",
            'link' => '/reportes/deudas', 'link_texto' => 'Ver deudas', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'rep_ocupacion', 'modulo' => 'reportes', 'titulo' => 'Reporte de ocupación',
            'preguntas_ejemplo' => ['como estuvo la ocupacion', 'reporte de ocupacion', 'cuanto se uso el estacionamiento'],
            'palabras_clave' => ['ocupacion', 'ocupado', 'porcentaje ocupacion', 'uso estacionamiento', 'rotacion'],
            'respuesta' => "El **reporte de ocupación** muestra cómo se usaron las plazas por sector, incluidas las alquiladas por contrato. Útil para saber si te conviene más alquiler o estacionamiento por hora.",
            'link' => '/reportes/ocupacion', 'link_texto' => 'Ver ocupación', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // REPORTES CONTABLES / IMPOSITIVOS
        // ---------------------------------------------------------------
        [
            'id' => 'cont_iva_ventas', 'modulo' => 'contables', 'titulo' => 'IVA Ventas (libro de ventas)',
            'preguntas_ejemplo' => ['como saco el iva ventas', 'libro de ventas iva', 'cuanto debo de iva por lo que cobre', 'iva de mis ingresos'],
            'palabras_clave' => ['iva ventas', 'libro ventas', 'debito fiscal', 'iva cobrado', 'iva ingresos', 'liquidacion iva'],
            'respuesta' => "**IVA Ventas** (libro de ventas) calcula el IVA de lo que cobraste en el período:\n1. Andá a **Reportes contables → IVA Ventas**.\n2. Elegí mes y año.\n3. Exportalo en **CSV** o **PDF**, o **enviaselo al contador** por email.\nEste IVA que cobrás a tus clientes es el **débito fiscal** (ver glosario).",
            'link' => '/reportes-contables/iva-ventas', 'link_texto' => 'Ver IVA Ventas', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'cont_iva_compras', 'modulo' => 'contables', 'titulo' => 'IVA Compras (libro de compras)',
            'preguntas_ejemplo' => ['como saco el iva compras', 'libro de compras iva', 'iva de mis gastos', 'credito fiscal donde lo veo'],
            'palabras_clave' => ['iva compras', 'libro compras', 'credito fiscal', 'iva gastos', 'iva pagado'],
            'respuesta' => "**IVA Compras** (libro de compras) calcula el IVA de tus gastos del período (se alimenta de lo que cargás en **Gastos**):\n1. Andá a **Reportes contables → IVA Compras**.\n2. Elegí mes y año y exportalo en **CSV** o **PDF**.\nEse IVA que te cobraron tus proveedores es el **crédito fiscal**.",
            'link' => '/reportes-contables/iva-compras', 'link_texto' => 'Ver IVA Compras', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'cont_posicion_iva', 'modulo' => 'contables', 'titulo' => 'Posición de IVA (cuánto pagar)',
            'preguntas_ejemplo' => ['cuanto iva tengo que pagar', 'posicion de iva', 'saldo a favor o en contra de iva', 'liquidacion final iva'],
            'palabras_clave' => ['posicion iva', 'saldo tecnico', 'iva pagar', 'iva a pagar', 'saldo iva', 'liquidar iva', 'a favor', 'en contra'],
            'respuesta' => "La **Posición de IVA** compara ventas contra compras:\n- Si el **débito fiscal** (IVA de ventas) es mayor que el **crédito fiscal** (IVA de compras) → **salís a pagar** ese diferencial.\n- Si es al revés → **saldo a favor** que podés arrastrar.\n1. Andá a **Reportes contables → Posición de IVA**.\n2. Cargá el **saldo técnico** si arrastrás saldo de meses anteriores.",
            'link' => '/reportes-contables/posicion-iva', 'link_texto' => 'Ver Posición de IVA', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'cont_arca', 'modulo' => 'contables', 'titulo' => 'Reporte ARCA (ex AFIP)',
            'preguntas_ejemplo' => ['que es el reporte arca', 'como presento en arca', 'afip donde lo veo', 'declaracion arca'],
            'palabras_clave' => ['arca', 'afip', 'declaracion', 'presentacion', 'fisco', 'nacional', 'ex afip', 'regimen'],
            'respuesta' => "El reporte **ARCA** (el nuevo nombre de **AFIP**) junta la información del período para tu presentación: ventas, compras e IVA.\n1. Andá a **Reportes contables → ARCA**.\n2. Elegí el período y exportalo en **CSV** o **PDF**, o **enviaselo al contador**.",
            'link' => '/reportes-contables/arca', 'link_texto' => 'Ver reporte ARCA', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'cont_exportar', 'modulo' => 'contables', 'titulo' => 'Exportar reportes (CSV / PDF) y enviar al contador',
            'preguntas_ejemplo' => ['como exporto un reporte para el contador', 'descargar reporte en pdf', 'mandar reportes al contador', 'exportar csv'],
            'palabras_clave' => ['exportar', 'export', 'csv', 'excel', 'contador', 'enviar contador', 'descargar reporte', 'pdf reporte'],
            'respuesta' => "Todos los **reportes contables** (IVA Ventas, IVA Compras, Posición de IVA, ARCA) tienen 3 formas de exportar:\n1. Botón **CSV** → planilla para Excel.\n2. Botón **PDF** → para imprimir o archivar.\n3. Botón **Enviar al contador** → manda el reporte por email al correo configurado.\nEl email del contador se carga en **Configuración fiscal**.",
            'link' => '/reportes', 'link_texto' => 'Ir a reportes', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'cont_config_fiscal', 'modulo' => 'contables', 'titulo' => 'Configuración fiscal',
            'preguntas_ejemplo' => ['donde cargo el cuit', 'configuracion fiscal', 'cargar email del contador', 'alicuotas de iva', 'condicion ante iva'],
            'palabras_clave' => ['cuit', 'configuracion fiscal', 'razon social', 'condicion iva', 'responsable inscripto', 'monotributista', 'exento', 'alicuota', 'punto de venta', 'jurisdiccion', 'email contador'],
            'respuesta' => "En **Configuración fiscal** cargás los datos que usan los reportes:\n1. Razón social, **CUIT** y condición frente al IVA (Responsable inscripto, Monotributo, Exento...).\n2. Alícuotas de **IVA** e **IIBB** y jurisdicción.\n3. Punto de venta y **email del contador** (para el envío de reportes).\nCargalo bien al empezar: los reportes se calculan con esos datos.",
            'link' => '/configuracion-fiscal', 'link_texto' => 'Ir a configuración fiscal', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // GASTOS
        // ---------------------------------------------------------------
        [
            'id' => 'gastos_crear', 'modulo' => 'gastos', 'titulo' => 'Cargar un gasto (compra)',
            'preguntas_ejemplo' => ['como cargo un gasto', 'registrar una compra', 'cargar una factura de compra', 'anotar un gasto'],
            'palabras_clave' => ['gasto', 'cargar gasto', 'nuevo gasto', 'compra', 'factura compra', 'proveedor', 'erogacion', 'gastos'],
            'respuesta' => "Para **cargar un gasto**:\n1. Andá a **Gastos → Nuevo gasto**.\n2. Cargá fecha, tipo de gasto, monto e IVA si la factura lo tiene.\n3. Guardá: aparece en el **libro de gastos** y alimenta **IVA Compras**.\nConsejo: cargá todas las facturas de compras del mes para aprovechar el crédito fiscal.",
            'link' => '/gastos/crear', 'link_texto' => 'Cargar gasto', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'gastos_listar', 'modulo' => 'gastos', 'titulo' => 'Libro de gastos',
            'preguntas_ejemplo' => ['donde veo los gastos', 'libro de gastos', 'gastos del mes'],
            'palabras_clave' => ['libro gastos', 'listado gastos', 'gastos mes', 'ver gastos'],
            'respuesta' => "En **Gastos** está el libro de gastos con filtro por **mes y año**, y el total del período. Desde ahí también se editan o eliminan.",
            'link' => '/gastos', 'link_texto' => 'Ver gastos', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'gastos_editar', 'modulo' => 'gastos', 'titulo' => 'Editar o eliminar un gasto',
            'preguntas_ejemplo' => ['como corrijo un gasto mal cargado', 'borrar un gasto', 'modificar un gasto'],
            'palabras_clave' => ['editar gasto', 'eliminar gasto', 'borrar gasto', 'modificar gasto', 'corregir gasto', 'anular gasto'],
            'respuesta' => "Para **corregir un gasto**: andá a **Gastos**, tocá **Editar** en la fila (o **Eliminar** si lo cargaste dos veces). Los cambios se reflejan al instante en IVA Compras.",
            'link' => '/gastos', 'link_texto' => 'Ir a gastos', 'roles_permitidos' => ['*'],
        ],

        // ---------------------------------------------------------------
        // GLOSARIO CONTABLE / IMPOSITIVO ARGENTINO
        // ---------------------------------------------------------------
        [
            'id' => 'glo_iva', 'modulo' => 'glosario', 'titulo' => '¿Qué es el IVA?',
            'preguntas_ejemplo' => ['que es el iva', 'expliname el iva', 'para que es el iva', 'cuanto es el iva'],
            'palabras_clave' => ['iva', 'valor agregado', 'alicuota iva', '21'],
            'respuesta' => "El **IVA** (Impuesto al Valor Agregado) es un impuesto que el cliente paga sobre lo que consume y vos después entregás al Estado (ARCA).\n- En la mayoría de los casos la alícuota es **21%**.\n- Cuando cobrás estacionamiento o alquiler, sumás IVA al precio → eso es IVA *vendido*.\n- Cuando comprás cosas para el negocio, pagás IVA → eso es IVA *comprado*.\nAl final del mes se comparan ambos y pagás la diferencia (ver **Posición de IVA**).",
            'link' => '/reportes-contables/posicion-iva', 'link_texto' => 'Ver Posición de IVA', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_debito_fiscal', 'modulo' => 'glosario', 'titulo' => 'Débito fiscal',
            'preguntas_ejemplo' => ['que es el debito fiscal', 'que significa debito fiscal'],
            'palabras_clave' => ['debito fiscal', 'debito'],
            'respuesta' => "El **débito fiscal** es el IVA que **cobraste** a tus clientes en tus ventas (en este sistema, el IVA de los movimientos y alquileres). Se llama \"débito\" porque es IVA que *debés* entregar al Estado.\nSe calcula en **IVA Ventas**.",
            'link' => '/reportes-contables/iva-ventas', 'link_texto' => 'Ver IVA Ventas', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_credito_fiscal', 'modulo' => 'glosario', 'titulo' => 'Crédito fiscal',
            'preguntas_ejemplo' => ['que es el credito fiscal', 'que significa credito fiscal'],
            'palabras_clave' => ['credito fiscal', 'credito'],
            'respuesta' => "El **crédito fiscal** es el IVA que **pagaste** en tus compras (facturas de gastos y proveedores). Se llama \"crédito\" porque lo podés *descontar* del IVA que cobraste.\nSe calcula en **IVA Compras** y se carga desde **Gastos**.",
            'link' => '/reportes-contables/iva-compras', 'link_texto' => 'Ver IVA Compras', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_saldo_tecnico', 'modulo' => 'glosario', 'titulo' => 'Saldo técnico de IVA',
            'preguntas_ejemplo' => ['que es el saldo tecnico', 'saldo a favor de iva', 'que pasa si tengo credito mayor que debito'],
            'palabras_clave' => ['saldo tecnico', 'saldo favor', 'saldo arrastre', 'credito mayor'],
            'respuesta' => "El **saldo técnico** es IVA a favor que te quedó de un período anterior (cuando compraste más de lo que vendiste). No se pierde: se **arrastra** al mes siguiente y se descuenta de lo que debas.\nSe carga en **Posición de IVA**.",
            'link' => '/reportes-contables/posicion-iva', 'link_texto' => 'Ver Posición de IVA', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_arca', 'modulo' => 'glosario', 'titulo' => 'ARCA (ex AFIP)',
            'preguntas_ejemplo' => ['que es arca', 'que es afip', 'arca y afip es lo mismo', 'quien cobra los impuestos'],
            'palabras_clave' => ['arca', 'afip', 'ex afip', 'organismo', 'recaudacion', 'fisco nacional'],
            'respuesta' => "**ARCA** es el organismo nacional de recaudación y control (desde 2024/2025 reemplazó a **AFIP**, es la misma institución con otro nombre y funciones ajustadas). Ahí te inscribís como contribuyente, presentás tus declaraciones de IVA y pagás tus impuestos. El sistema tiene un reporte preparado para esa presentación.",
            'link' => '/reportes-contables/arca', 'link_texto' => 'Ver reporte ARCA', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_iibb', 'modulo' => 'glosario', 'titulo' => 'IIBB (Ingresos Brutos)',
            'preguntas_ejemplo' => ['que es iibb', 'que es ingresos brutos', 'iibb provincial'],
            'palabras_clave' => ['iibb', 'ingresos brutos', 'provincial', 'arba', 'recaudacion provincial'],
            'respuesta' => "**IIBB** (Impuesto sobre los Ingresos Brutos) es un impuesto **provincial**: se paga sobre lo que facturás, sin descontar gastos. Cada provincia tiene su organismo (en Buenos Aires es ARBA).\nEn **Configuración fiscal** cargás la alícuota y jurisdicción que usan los reportes.",
            'link' => '/configuracion-fiscal', 'link_texto' => 'Ver configuración fiscal', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_base_imponible', 'modulo' => 'glosario', 'titulo' => 'Base imponible',
            'preguntas_ejemplo' => ['que es la base imponible', 'sobre que se calcula el impuesto'],
            'palabras_clave' => ['base imponible', 'imponible', 'base calculo'],
            'respuesta' => "La **base imponible** es el monto sobre el que se calcula un impuesto.\nEjemplo: si cobrás **$121.000** con IVA incluido, la base imponible del IVA es el precio sin IVA (**$100.000**) y el IVA son **$21.000**. Por eso los reportes separan el neto del IVA.",
            'link' => '/reportes-contables/iva-ventas', 'link_texto' => 'Ver IVA Ventas', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_percepcion', 'modulo' => 'glosario', 'titulo' => 'Percepción',
            'preguntas_ejemplo' => ['que es una percepcion', 'me hicieron una percepcion', 'percepciones iibb'],
            'palabras_clave' => ['percepcion', 'percepciones', 'impuesto adelantado'],
            'respuesta' => "Una **percepción** es un impuesto que te cobran *por adelantado* cuando comprás o pagás algo (la suma el proveedor en la factura). Ej.: percepción de **IIBB** en una factura de proveedor.\nDespués esa percepción se descuenta de lo que debés de ese impuesto. Por eso conviene cargarla junto al gasto en el sistema.",
            'link' => '/gastos/crear', 'link_texto' => 'Cargar gasto', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_retencion', 'modulo' => 'glosario', 'titulo' => 'Retención',
            'preguntas_ejemplo' => ['que es una retencion', 'me retuvieron impuestos', 'retenciones de ganancias'],
            'palabras_clave' => ['retencion', 'retenciones', 'descuento pago', 'ganancias'],
            'respuesta' => "Una **retención** es un impuesto que te descuentan *cuando te pagan* (quien te paga lo retiene y lo entrega al Estado por vos). Es típica en alquileres y servicios.\nEj.: te alquilan una cochera por $100.000 y te transfieren $98.500 porque retuvieron IIBB. A fin de mes esa retención se resta de tu impuesto.",
            'link' => '/configuracion-fiscal', 'link_texto' => 'Ver configuración fiscal', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_balance', 'modulo' => 'glosario', 'titulo' => 'Balance',
            'preguntas_ejemplo' => ['que es el balance', 'para que sirve el balance', 'hacer un balance'],
            'palabras_clave' => ['balance', 'estados contables', 'activo pasivo', 'ejercicio', 'patrimonio'],
            'respuesta' => "El **balance** es la foto contable del negocio: qué tenés (**activo**), qué debés (**pasivo**) y la diferencia (patrimonio neto), más el **resultado** del período (ingresos vs gastos).\nEste sistema te da la **materia prima**: ingresos (caja y alquileres), gastos (libro de compras) e IVA. Con eso tu contador arma el balance formal.",
            'link' => '/reportes', 'link_texto' => 'Ir a reportes', 'roles_permitidos' => ['*'],
        ],
        [
            'id' => 'glo_libros', 'modulo' => 'glosario', 'titulo' => 'Libro de compras y libro de ventas',
            'preguntas_ejemplo' => ['que es el libro de compras', 'que es el libro de ventas', 'libros fiscales'],
            'palabras_clave' => ['libro compras', 'libro ventas', 'libros fiscales', 'registro fiscal'],
            'respuesta' => "Los **libros fiscales** son los registros de tus comprobantes:\n- **Libro de ventas**: lo que cobraste (en el sistema: **IVA Ventas**).\n- **Libro de compras**: lo que compraste (en el sistema: **IVA Compras**, alimentado por **Gastos**).\nAntes eran libros de papel; hoy son estos registros digitales que se exportan para ARCA o el contador.",
            'link' => '/reportes', 'link_texto' => 'Ir a reportes', 'roles_permitidos' => ['*'],
        ],
    ],

    // -------------------------------------------------------------------
    // Mapa pantalla → módulo (para respuestas contextuales del bot).
    // Se evalúa el prefijo MÁS LARGO que coincida con la ruta actual.
    // -------------------------------------------------------------------
    'pantallas' => [
        '/' => 'dashboard',
        '/dashboard' => 'dashboard',
        '/movimientos' => 'movimientos',
        '/vehiculo' => 'movimientos',
        '/alquileres' => 'alquileres',
        '/deudas' => 'deudas',
        '/recibos' => 'recibos',
        '/notificaciones' => 'notificaciones',
        '/clientes' => 'clientes',
        '/reportes-contables' => 'contables',
        '/configuracion-fiscal' => 'contables',
        '/reportes' => 'reportes',
        '/gastos' => 'gastos',
        '/bot' => 'general',
    ],

    // -------------------------------------------------------------------
    // Sugerencias de bienvenida por módulo (botones del widget).
    // 'mensaje' es lo que se envía al backend al tocar el botón.
    // -------------------------------------------------------------------
    'sugerencias' => [
        'dashboard' => [
            ['texto' => '¿Qué podés hacer?', 'mensaje' => '¿Qué podés hacer?'],
            ['texto' => '¿Cuántos lugares libres hay?', 'mensaje' => '¿Cuántos lugares libres hay?'],
            ['texto' => '¿Cómo registro una entrada?', 'mensaje' => '¿Cómo registro una entrada?'],
            ['texto' => '¿Cuál es la deuda total?', 'mensaje' => '¿Cuál es la deuda total?'],
        ],
        'movimientos' => [
            ['texto' => '¿Cómo cobro una salida?', 'mensaje' => '¿Cómo cobro la salida de un vehículo?'],
            ['texto' => '¿Cómo registro una entrada?', 'mensaje' => '¿Cómo registro una entrada?'],
            ['texto' => '¿Qué autos hay adentro?', 'mensaje' => '¿Qué autos hay adentro ahora?'],
            ['texto' => '¿Cómo registro un pago de deuda?', 'mensaje' => '¿Cómo registro el pago de una deuda?'],
        ],
        'alquileres' => [
            ['texto' => '¿Cómo creo un contrato?', 'mensaje' => '¿Cómo creo un contrato de alquiler?'],
            ['texto' => '¿Qué plazas están libres?', 'mensaje' => '¿Qué plazas están libres para alquilar?'],
            ['texto' => '¿Cómo registro el pago?', 'mensaje' => '¿Cómo registro el pago de un alquiler?'],
            ['texto' => '¿Qué contratos vencen pronto?', 'mensaje' => '¿Qué contratos vencen en los próximos 15 días?'],
        ],
        'deudas' => [
            ['texto' => '¿Cómo registro un pago de deuda?', 'mensaje' => '¿Cómo registro el pago de una deuda?'],
            ['texto' => '¿Cuál es la deuda total?', 'mensaje' => '¿Cuál es la deuda pendiente total?'],
        ],
        'recibos' => [
            ['texto' => '¿Cómo descargo el PDF?', 'mensaje' => '¿Cómo descargo un recibo en PDF?'],
            ['texto' => '¿Cómo lo envío por email?', 'mensaje' => '¿Cómo envío un recibo por email?'],
        ],
        'notificaciones' => [
            ['texto' => '¿Cómo configuro el correo?', 'mensaje' => '¿Cómo configuro el correo SMTP?'],
            ['texto' => '¿Cómo configuro WhatsApp?', 'mensaje' => '¿Cómo configuro WhatsApp?'],
            ['texto' => '¿Cómo aviso a un cliente?', 'mensaje' => '¿Cómo envío un aviso a un cliente?'],
        ],
        'clientes' => [
            ['texto' => '¿Cómo creo un cliente?', 'mensaje' => '¿Cómo doy de alta un cliente?'],
            ['texto' => '¿Qué veo en su ficha?', 'mensaje' => '¿Qué veo en la ficha del cliente?'],
            ['texto' => '¿Cómo aviso a un cliente?', 'mensaje' => '¿Cómo envío un aviso a un cliente?'],
        ],
        'reportes' => [
            ['texto' => '¿Cómo veo la caja?', 'mensaje' => '¿Cómo veo el reporte de caja?'],
            ['texto' => '¿Cómo exporto al contador?', 'mensaje' => '¿Cómo exporto un reporte para el contador?'],
            ['texto' => '¿Qué es el IVA?', 'mensaje' => '¿Qué es el IVA?'],
        ],
        'contables' => [
            ['texto' => '¿Qué es el débito fiscal?', 'mensaje' => '¿Qué es el débito fiscal?'],
            ['texto' => '¿Cuánto IVA pago?', 'mensaje' => '¿Cuánto IVA tengo que pagar?'],
            ['texto' => '¿Cómo exporto al contador?', 'mensaje' => '¿Cómo envío los reportes al contador?'],
            ['texto' => '¿Qué es ARCA?', 'mensaje' => '¿Qué es ARCA y AFIP?'],
        ],
        'gastos' => [
            ['texto' => '¿Cómo cargo un gasto?', 'mensaje' => '¿Cómo cargo un gasto?'],
            ['texto' => '¿Qué es el crédito fiscal?', 'mensaje' => '¿Qué es el crédito fiscal?'],
            ['texto' => '¿Cómo corrijo un gasto?', 'mensaje' => '¿Cómo corrijo un gasto mal cargado?'],
        ],
    ],
];
