import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPool } from "@/lib/db";
import { procesarMensaje } from "@/lib/bot";
import { errorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, tipo: "error", html: "Sesión requerida", opciones: [], temas: [], convId: null }), { status: 401 });
    }

    const body = await request.json();
    const texto = String(body.mensaje ?? "").trim();
    const pantalla = String(body.pantalla ?? "").trim();
    const entradaId = String(body.entrada_id ?? "").trim();

    const pool = getPool();

    let resultado;
    if (entradaId) {
      // El usuario eligió una opción (botón) -> resolverKB directo por entradaId
      const { resolverKBporId } = await import("@/lib/bot");
      const kb = await resolverKBporId(entradaId, user.rol);
      if (kb) {
        const { guardarConversacion } = await import("@/lib/bot");
        const sessionId = request.headers.get("x-session-id") ?? `sess_${user.id}_${Date.now()}`;
        const convId = await guardarConversacion(pool, sessionId, `entrada:${entradaId}`, kb.html, entradaId, 100, pantalla, false);
        resultado = { ok: true, tipo: "kb", html: kb.html, opciones: kb.opciones, temas: kb.temas, convId, link: kb.link, linkTexto: kb.linkTexto };
      } else {
        resultado = { ok: false, tipo: "error", html: "Opción no válida", opciones: [], temas: [], convId: null };
      }
    } else if (texto) {
      // Texto libre del usuario
      const sessionId = request.headers.get("x-session-id") ?? `sess_${user.id}_${Date.now()}`;
      resultado = await procesarMensaje(pool, sessionId, texto, pantalla, user.rol);
    } else {
      return new Response(JSON.stringify({ ok: false, tipo: "error", html: "Mensaje vacío", opciones: [], temas: [], convId: null }), { status: 400 });
    }

    return new Response(JSON.stringify(resultado), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return errorResponse(error);
  }
}