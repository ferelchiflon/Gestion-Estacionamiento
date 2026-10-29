import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { getDisponibilidad } from "@/lib/alquiler";
import { errorResponse } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "operaciones.read");

    const pool = getPool();
    const disponibilidad = await getDisponibilidad(pool);

    return Response.json({ data: disponibilidad });
  } catch (error) {
    return errorResponse(error);
  }
}
