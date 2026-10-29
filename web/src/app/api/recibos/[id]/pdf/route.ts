import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { generarReciboPdf } from "@/lib/services/pdf";
import { errorResponse, ApiError } from "@/lib/http";

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

    const recibo = res.rows[0];

    // Datos fiscales
    const fiscalRes = await pool.query("SELECT * FROM configuracion_fiscal WHERE id = 1");
    const fiscal = fiscalRes.rows[0] ?? { razon_social: "Estacionamiento Central", cuit: null };

    const pdfBytes = await generarReciboPdf({
      numero: recibo.numero,
      fecha_emision: recibo.fecha_emision,
      monto: recibo.monto,
      forma_pago: recibo.forma_pago || "efectivo",
      patente: recibo.patente,
      hora_entrada: recibo.hora_entrada,
      hora_salida: recibo.hora_salida,
      plaza_numero: recibo.plaza_numero,
      plaza_sector: recibo.plaza_sector,
      cliente_nombre: recibo.cliente_nombre,
      cliente_documento: recibo.cliente_documento,
      vehiculo_tipo: recibo.vehiculo_tipo,
      razon_social: fiscal.razon_social,
      cuit: fiscal.cuit,
    });

    return new Response(new Blob([pdfBytes.buffer as ArrayBuffer]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="recibo-${String(recibo.numero).padStart(6, '0')}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}