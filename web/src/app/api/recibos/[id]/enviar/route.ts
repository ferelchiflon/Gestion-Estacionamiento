import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { generarReciboPdf } from "@/lib/services/pdf";
import { enviarReciboPorEmail, generarHtmlEmailRecibo } from "@/lib/services/email";
import { errorResponse, ApiError } from "@/lib/http";
import { clientIp } from "@/lib/http";
import { auditar } from "@/lib/audit";
import { z } from "zod";

const enviarReciboSchema = z.object({
  email: z.string().email("Email inválido"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireApiUser(["admin", "operador"], "operaciones.write");
    const { id } = await params;
    const reciboId = Number(id);

    if (isNaN(reciboId) || reciboId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de recibo inválido");
    }

    const body = await request.json();
    const { email } = enviarReciboSchema.parse(body);

    const pool = getPool();

    // Obtener recibo con datos completos
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

    // Generar PDF
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

    // Generar HTML del email
    const html = generarHtmlEmailRecibo({
      numeroRecibo: recibo.numero,
      monto: recibo.monto,
      fechaEmision: formatFechaHora(recibo.fecha_emision),
      razonSocial: fiscal.razon_social || "Estacionamiento Central",
    });

    // Enviar email
    const resultado = await enviarReciboPorEmail({
      destinatario: email,
      asunto: `Recibo N° ${String(recibo.numero).padStart(6, '0')} - ${fiscal.razon_social || "Estacionamiento Central"}`,
      html,
      adjuntoPdf: pdfBytes,
      nombreArchivo: `recibo-${String(recibo.numero).padStart(6, '0')}.pdf`,
    });

    if (!resultado.success) {
      throw new ApiError(500, "EMAIL_ERROR", resultado.error || "Error enviando email");
    }

    // Auditar envío
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      try {
        await auditar(client, {
          usuarioId: user.id,
          accion: "UPDATE",
          tabla: "recibos",
          registroId: reciboId,
          antes: { enviado_email: recibo.enviado_email },
          despues: { enviado_email: true, email_enviado_a: email, enviado_en: new Date().toISOString() },
          ip: clientIp(request),
        });

        await client.query(
          `UPDATE recibos SET enviado_email = true, email_enviado_a = $1, enviado_en = now() WHERE id = $2`,
          [email, reciboId]
        );

        await client.query("COMMIT");
      } catch (auditError) {
        await client.query("ROLLBACK");
        throw auditError;
      }
    } finally {
      client.release();
    }

    return Response.json({
      success: true,
      message: `Recibo enviado correctamente a ${email}`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// Helper para formatear fecha en el endpoint
function formatFechaHora(val: Date | string | null | undefined): string {
  if (!val) return "-";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return String(val);

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}