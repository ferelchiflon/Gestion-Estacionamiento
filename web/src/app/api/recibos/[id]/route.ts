import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import {
  errorResponse,
  ApiError,
} from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "operaciones.read");
    const { id } = await params;
    const reciboId = Number(id);

    if (isNaN(reciboId) || reciboId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de recibo inválido");
    }

    const pool = getPool();
    const sql = `
      SELECT 
        r.*,
        m.patente,
        m.hora_entrada,
        m.hora_salida,
        m.monto_calculado,
        c.nombre as cliente_nombre,
        c.documento as cliente_documento,
        c.email as cliente_email,
        p.numero as plaza_numero,
        p.sector as plaza_sector,
        v.marca as vehiculo_marca,
        v.modelo as vehiculo_modelo,
        v.tipo as vehiculo_tipo
      FROM recibos r
      LEFT JOIN movimientos m ON r.movimiento_id = m.id
      LEFT JOIN plazas p ON m.plaza_id = p.id
      LEFT JOIN vehiculos v ON m.patente = v.patente AND v.eliminado_en IS NULL
      LEFT JOIN clientes c ON r.cliente_id = c.id
      WHERE r.id = $1 AND r.eliminado_en IS NULL
    `;

    const res = await pool.query(sql, [reciboId]);

    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Recibo no encontrado");
    }

    return Response.json(res.rows[0]);
  } catch (error) {
    return errorResponse(error);
  }
}
