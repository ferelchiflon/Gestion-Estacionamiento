import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPool } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "Sesión requerida" }), { status: 401 });
    }

    const body = await request.json();
    const convId = Number(body.id ?? 0);
    const util = String(body.util ?? "");

    if (convId <= 0 || !["si", "no"].includes(util)) {
      return new Response(JSON.stringify({ ok: false, error: "Datos inválidos" }), { status: 422 });
    }

    const pool = getPool();
    const res = await pool.query(
      `UPDATE bot_conversaciones SET util = $1 WHERE id = $2 RETURNING id`,
      [util, convId],
    );

    return new Response(JSON.stringify({ ok: res.rowCount !== null && res.rowCount > 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}