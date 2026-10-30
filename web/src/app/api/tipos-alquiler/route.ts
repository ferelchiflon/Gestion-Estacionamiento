import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { getTiposAlquiler } from "@/lib/alquiler";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireApiUser(["admin", "operador", "contador"], "operaciones.read");

    const pool = getPool();
    const tipos = await getTiposAlquiler(pool);

    return Response.json({ data: tipos });
  } catch (error) {
    return errorResponse(error);
  }
}
