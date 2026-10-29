import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { getPagosPendientes, registrarPago } from "@/lib/alquiler";
import { errorResponse, clientIp } from "@/lib/http";
import { registrarPagoSchema } from "@/lib/validations/alquiler";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "operaciones.read");

    const pool = getPool();
    const pendientes = await getPagosPendientes(pool);

    return Response.json({ data: pendientes });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(["admin", "operador"], "operaciones.write");

    const body = await request.json();
    const data = registrarPagoSchema.parse(body);

    const pool = getPool();
    const resultado = await registrarPago(pool, data, {
      usuarioId: user.id,
      ip: clientIp(request),
    });

    return Response.json(resultado, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}