import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { errorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "Sesión requerida" }), { status: 401 });
    }

    // El historial en memoria se limpia del lado del cliente; en servidor solo devolvemos OK
    // Si se quisiera limpiar de BD: await pool.query('DELETE FROM bot_conversaciones WHERE sesion_id = $1', [sessionId]);

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return errorResponse(error);
  }
}