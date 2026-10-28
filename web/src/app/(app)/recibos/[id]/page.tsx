import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Printer,
  CheckCircle2,
  Calendar,
  Car,
  CreditCard,
  Building2,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { formatMoneySign, formatFechaHora } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(["admin", "operador", "contador"], "operaciones.read");
  const { id } = await params;
  const reciboId = Number(id);

  if (isNaN(reciboId) || reciboId <= 0) {
    notFound();
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
    notFound();
  }
  const recibo = res.rows[0];

  // Datos fiscales
  const fiscalRes = await pool.query("SELECT * FROM configuracion_fiscal WHERE id = 1");
  const fiscal = fiscalRes.rows[0] ?? { razon_social: "Estacionamiento Central", cuit: "" };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Botones de acción en pantalla (ocultos al imprimir) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/movimientos"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
        >
          <ChevronLeft size={16} />
          Volver a Movimientos
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-800"
        >
          <Printer size={16} />
          Imprimir Ticket
        </button>
      </div>

      {/* Ticket / Comprobante Imprimible */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none">
        {/* Cabecera */}
        <div className="border-b border-dashed border-slate-300 pb-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-teal-800 font-black tracking-tight text-lg">
            <Building2 size={20} />
            <span>{fiscal.razon_social || "ESTACIONAMIENTO CENTRAL"}</span>
          </div>
          {fiscal.cuit && (
            <p className="mt-0.5 text-2xs text-slate-500 font-mono">CUIT: {fiscal.cuit}</p>
          )}
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 size={13} />
            COMPROBANTE DE PAGO
          </div>
          <div className="mt-2 font-mono text-xl font-bold tracking-wider text-slate-900">
            RECIBO N° {String(recibo.numero).padStart(6, "0")}
          </div>
          <p className="text-2xs text-slate-500">
            Emisión: {formatFechaHora(recibo.fecha_emision)}
          </p>
        </div>

        {/* Detalles de Estadía */}
        <div className="space-y-3 py-4 text-xs text-slate-700 border-b border-dashed border-slate-300">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 flex items-center gap-1">
              <Car size={13} /> Dominio / Patente:
            </span>
            <span className="font-mono text-sm font-bold text-slate-900">
              {recibo.patente}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500">Tipo de Vehículo:</span>
            <span className="capitalize font-medium text-slate-800">
              {recibo.vehiculo_tipo || "Auto"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500">Plaza Asignada:</span>
            <span className="font-semibold text-slate-800">
              Cochera {recibo.plaza_numero} (Sector {recibo.plaza_sector})
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500">Cliente:</span>
            <span className="font-medium text-slate-800">
              {recibo.cliente_nombre || "Consumidor Final"}
            </span>
          </div>

          <div className="mt-2 rounded-lg bg-slate-50 p-2.5 space-y-1 text-2xs">
            <div className="flex justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar size={11} /> Ingreso:
              </span>
              <span className="font-mono font-medium">
                {formatFechaHora(recibo.hora_entrada)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar size={11} /> Egreso:
              </span>
              <span className="font-mono font-medium">
                {formatFechaHora(recibo.hora_salida)}
              </span>
            </div>
          </div>
        </div>

        {/* Total y Pago */}
        <div className="pt-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <CreditCard size={13} /> Forma de Pago:
            </span>
            <span className="font-bold uppercase text-xs text-slate-800">
              {recibo.forma_pago || "Efectivo"}
            </span>
          </div>

          <div className="flex justify-between items-center rounded-xl bg-slate-900 px-4 py-3 text-white">
            <span className="text-sm font-semibold uppercase tracking-wider">
              Total Abonado
            </span>
            <span className="font-mono text-2xl font-bold">
              {formatMoneySign(recibo.monto)}
            </span>
          </div>

          <div className="text-center text-3xs text-slate-400 pt-2">
            Gracias por su visita · Guarde este comprobante
          </div>
        </div>
      </div>
    </div>
  );
}
