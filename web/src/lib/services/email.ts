import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.warn("[email] RESEND_API_KEY no configurada; emails se loguearán pero no se enviarán");
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Estacionamiento <no-reply@estacionamiento.local>";

/**
 * Envía un recibo por email al cliente.
 * @returns { success: true } | { success: false; error: string }
 */
export async function enviarReciboPorEmail({
  destinatario,
  asunto,
  html,
  adjuntoPdf,
  nombreArchivo = "recibo.pdf",
}: {
  destinatario: string;
  asunto: string;
  html: string;
  adjuntoPdf: Uint8Array | Buffer;
  nombreArchivo?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log("[email] Simulando envío a", destinatario, "asunto:", asunto);
    return { success: true }; // En dev sin API key, devolvemos éxito
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: destinatario,
      subject: asunto,
      html,
      attachments: [
        {
            filename: nombreArchivo,
            content: Buffer.from(adjuntoPdf),
        },
      ],
    });
    return { success: true };
  } catch (error) {
    console.error("[email] Error enviando:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido enviando email",
    };
  }
}

/**
 * Genera el HTML del email con el recibo adjunto.
 */
export function generarHtmlEmailRecibo({
  numeroRecibo,
  monto,
  fechaEmision,
  razonSocial,
}: {
  numeroRecibo: number;
  monto: string;
  fechaEmision: string;
  razonSocial: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0d9488; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${razonSocial || 'Estacionamiento Central'}</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Comprobante de Pago</p>
        </div>
        <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">Estimado cliente:</p>
          <p>Adjunto encontrará el recibo <strong>N° ${String(numeroRecibo).padStart(6, '0')}</strong> correspondiente a su estadía en nuestro estacionamiento.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Fecha de emisión:</strong> ${fechaEmision}</p>
            <p style="margin: 4px 0;"><strong>Total abonado:</strong> <span style="color: #0d9488; font-size: 18px; font-weight: bold;">$ ${monto}</span></p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Guarde este comprobante para sus registros. Si tiene alguna consulta, no dude en contactarnos.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">Este es un mensaje automático, por favor no responda a este correo.</p>
        </div>
      </body>
    </html>
  `;
}