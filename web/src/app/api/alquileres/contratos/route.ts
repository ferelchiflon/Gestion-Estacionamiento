import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { listContratos, crearContrato } from "@/lib/alquiler";
import { errorResponse, clientIp } from "@/lib/http";
import { crearContratoSchema } from "@/lib/validations/alquiler";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "operaciones.read");

    const pool = getPool();
    const contratos = await listContratos(pool);

    return Response.json({ data: contratos });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(["admin", "operador"], "operaciones.write");

    const body = await request.json();
    const data = crearContratoSchema.parse(body);

    const pool = getPool();
    const contrato = await crearContrato(pool, data, {
      usuarioId: user.id,
      ip: clientIp(request),
    });

    return Response.json(contrato, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
