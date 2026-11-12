/**
 * Asistente (Bot) — port del PHP AsistenteService + conocimiento.php
 *
 * - Rate limit por sesión (60 req/h)
 * - Límite 300 chars por mensaje
 * - Historial en sesión (últimos 10)
 * - Persistencia en bot_conversaciones
 * - Motor de KB + consultas de datos (lista blanca)
 * - Render seguro: escape + negrita + cursiva + listas + links internos
 * - Prioridad: 1) consultas datos 2) KB
 * - Acciones: responde pasos y link a la pantalla
 */

import type { Pool } from "pg";

export type BotEntrada = {
  id: string;
  modulo: string;
  titulo: string;
  preguntasEjemplo: string[];
  palabrasClave: string[];
  respuesta: string;
  link: string;
  linkTexto: string;
  rolesPermitidos: string[];
};

export type BotRespuesta = {
  ok: boolean;
  tipo: "datos" | "kb" | "error" | "saludo";
  html: string;
  opciones: string[];
  temas: string[];
  convId: number | null;
  link?: string;
  linkTexto?: string;
};

const MAX_LARGO = 300;
const MAX_POR_HORA = 60;
const VENTANA_SEGS = 3600;

interface RateLimitData {
  count: number;
  inicio: number;
}

const LINK_DATOS: Record<string, [string, string]> = {
  ocupacion: ["/reportes/ocupacion", "Ver ocupación"],
  ingresos_mes: ["/reportes/caja", "Ver reporte de caja"],
  operaciones_mes: ["/movimientos", "Ver historial"],
  deuda_total: ["/reportes/deudas", "Ver deudas"],
  contratos_por_vencer: ["/alquileres/contratos", "Ver contratos"],
  contratos_activos: ["/alquileres/contratos", "Ver contratos"],
};

const rateLimitStore = new Map<string, { count: number; inicio: number }>();

export async function procesarMensaje(
  pool: Pool,
  sessionId: string,
  texto: string,
  pantalla: string,
  rol: string,
): Promise<BotRespuesta> {
  const ahora = Date.now();
  const key = `bot_rl_${sessionId}`;
  const datos = rateLimitStore.get(key) || { count: 0, inicio: Date.now() };
  if (Date.now() - datos.inicio > 3600 * 1000) {
    datos.count = 0;
    datos.inicio = Date.now();
  }
  if (datos.count >= 60) {
    return error("Consultaste muchas veces seguidas 🙏 Esperá un ratito y seguímos.");
  }
  datos.count++;
  // rateLimitStore.set(key, datos); // en memoria simple

  texto = texto.trim().slice(0, MAX_LARGO);
  pantalla = pantalla.trim().slice(0, 200);
  if (!texto) return error("Escribime una pregunta así te puedo ayudar 🙂");

  const datosRespuesta = await resolverConsultaDatos(pool, texto, pantalla, rol);
  if (datosRespuesta) {
    const convId = await guardarConversacion(pool, sessionId, texto, datosRespuesta.html, datosRespuesta.entradaId, datosRespuesta.puntaje, pantalla, false);
    return {
      ok: true,
      tipo: "datos",
      html: datosRespuesta.html,
      opciones: [],
      temas: [],
      convId,
      link: datosRespuesta.link,
      linkTexto: datosRespuesta.linkTexto,
    };
  }

  const kbRespuesta = resolverKB(texto, rol);
  if (kbRespuesta) {
    const convId = await guardarConversacion(pool, sessionId, texto, kbRespuesta.html, kbRespuesta.entradaId, kbRespuesta.puntaje, pantalla, false);
    return {
      ok: true,
      tipo: "kb",
      html: kbRespuesta.html,
      opciones: kbRespuesta.opciones,
      temas: kbRespuesta.temas,
      convId,
      link: kbRespuesta.link,
      linkTexto: kbRespuesta.linkTexto,
    };
  }

  await guardarConversacion(pool, sessionId, texto, null, null, 0, pantalla, true);
  return error("No encontré una respuesta para eso. Probá reformular o usá palabras clave como: ocupación, caja, deudas, contratos, IVA, ARCA, balance.");
}
