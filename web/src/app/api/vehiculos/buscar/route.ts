import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { normalizarPatente } from "@/lib/format";
import { errorResponse, ApiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "clientes.read");

    const searchParams = request.nextUrl.searchParams;
    const rawPatente = searchParams.get("patente");

    if (!rawPatente) {
      throw new ApiError(400, "MISSING_PARAM", "Se requiere el parámetro 'patente'");
    }

    const patente = normalizarPatente(rawPatente);
    const pool = getPool();

    const vehiculoRes = await pool.query(
      `SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.documento as cliente_documento
       FROM vehiculos v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       WHERE v.patente = $1 AND v.eliminado_en IS NULL`,
      [patente]
    );

    if (vehiculoRes.rowCount === 0) {
      return Response.json({
        exists: false,
        patente,
        tiene_deuda: false,
        monto_deuda: 0,
      });
    }

    const vehiculo = vehiculoRes.rows[0];
    let deudaTotal = 0;

    if (vehiculo.cliente_id) {
      const deudaRes = await pool.query(
        `SELECT sum(monto_con_interes)::numeric(14,2) as total
         FROM deudas
         WHERE cliente_id = $1 AND estado = 'pendiente' AND eliminado_en IS NULL`,
        [vehiculo.cliente_id]
      );
      deudaTotal = Number(deudaRes.rows[0]?.total ?? 0);
    }

    return Response.json({
      exists: true,
      patente: vehiculo.patente,
      tipo: vehiculo.tipo,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      color: vehiculo.color,
      cliente_id: vehiculo.cliente_id,
      cliente_nombre: vehiculo.cliente_nombre ?? "Ocasional",
      tiene_deuda: deudaTotal > 0,
      monto_deuda: deudaTotal,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
