import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  FileText,
  Car,
  Calendar,
  CreditCard,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { formatMoneySign, formatFecha, formatFechaHora } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser(
    ["admin", "operador", "contador"],
    "clientes.read"
  );
  const { id } = await params;
  const clienteId = Number(id);

  if (isNaN(clienteId) || clienteId <= 0) {
    notFound();
  }

  const pool = getPool();

  // Cliente
  const clienteRes = await pool.query(
    "SELECT * FROM clientes WHERE id = $1 AND eliminado_en IS NULL",
    [clienteId]
  );
  if (clienteRes.rowCount === 0) {
    notFound();
  }
  const cliente = clienteRes.rows[0];

  // Vehículos
  const vehiculosRes = await pool.query(
    "SELECT * FROM vehiculos WHERE cliente_id = $1 AND eliminado_en IS NULL ORDER BY patente ASC",
    [clienteId]
  );
  const vehiculos = vehiculosRes.rows;

  // Deudas
  const deudasRes = await pool.query(
    `SELECT d.*, m.patente, m.hora_entrada, m.hora_salida
     FROM deudas d
     LEFT JOIN movimientos m ON d.movimiento_id = m.id
     WHERE d.cliente_id = $1 AND d.eliminado_en IS NULL
     ORDER BY d.created_at DESC`,
    [clienteId]
  );
  const deudas = deudasRes.rows;

  // Contratos
  const contratosRes = await pool.query(
    `SELECT c.*, p.numero as plaza_numero, p.sector as plaza_sector, t.nombre as tipo_alquiler_nombre
     FROM contratos_alquiler c
     JOIN plazas p ON c.plaza_id = p.id
     LEFT JOIN tipos_alquiler t ON c.tipo_alquiler_id = t.id
     WHERE c.cliente_id = $1 AND c.eliminado_en IS NULL
     ORDER BY c.fecha_inicio DESC`,
    [clienteId]
  );
  const contratos = contratosRes.rows;

  const deudaTotal = deudas
    .filter((d) => d.estado === "pendiente")
    .reduce((sum, d) => sum + Number(d.monto_con_interes), 0);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/clientes"
            className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100"
            title="Volver al listado"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {cliente.nombre}
              </h1>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  cliente.estado === "activo"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {cliente.estado}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Registrado el {formatFecha(cliente.fecha_registro)}
            </p>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Saldo Prepagado
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900">
            {formatMoneySign(cliente.saldo_actual)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Disponible para consumo de estadías
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Deuda Pendiente
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-bold ${
              deudaTotal > 0 ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {formatMoneySign(deudaTotal)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {deudaTotal > 0
              ? "Requiere regularización de pagos"
              : "Sin deudas pendientes registradas"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Vehículos Asociados
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900">
            {vehiculos.length}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {contratos.filter((c) => c.estado === "activo").length} contratos
            vigentes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna Izquierda: Información de contacto */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <User size={16} className="text-teal-700" />
              Datos de Contacto
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Documento / CUIT</dt>
                <dd className="flex items-center gap-1.5 font-medium text-slate-800">
                  <FileText size={14} className="text-slate-400" />
                  {cliente.documento || "No especificado"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Teléfono</dt>
                <dd className="flex items-center gap-1.5 font-medium text-slate-800">
                  <Phone size={14} className="text-slate-400" />
                  {cliente.telefono || "No especificado"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Email</dt>
                <dd className="flex items-center gap-1.5 font-medium text-slate-800">
                  <Mail size={14} className="text-slate-400" />
                  {cliente.email || "No especificado"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Vehículos del cliente */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Car size={16} className="text-teal-700" />
              Vehículos Registrados ({vehiculos.length})
            </h2>

            {vehiculos.length === 0 ? (
              <p className="text-xs text-slate-400">Sin vehículos asignados</p>
            ) : (
              <div className="space-y-2">
                {vehiculos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-sm"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900">
                        {v.patente}
                      </span>
                      <p className="text-xs text-slate-500">
                        {v.marca || ""} {v.modelo || ""} {v.color ? `(${v.color})` : ""}
                      </p>
                    </div>
                    <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium capitalize text-slate-700 shadow-2xs">
                      {v.tipo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Contratos y Deudas */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contratos de Alquiler */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Calendar size={16} className="text-teal-700" />
              Contratos de Alquiler / Cocheras Fijas
            </h2>

            {contratos.length === 0 ? (
              <p className="text-xs text-slate-400">Sin contratos registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-2">Plaza</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Vigencia</th>
                      <th className="p-2 text-right">Cuota Mensual</th>
                      <th className="p-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contratos.map((con) => (
                      <tr key={con.id}>
                        <td className="p-2 font-semibold text-slate-800">
                          Plaza {con.plaza_numero} ({con.plaza_sector})
                        </td>
                        <td className="p-2 text-slate-600">
                          {con.tipo_alquiler_nombre || "-"}
                        </td>
                        <td className="p-2 text-slate-600">
                          {formatFecha(con.fecha_inicio)} al {formatFecha(con.fecha_fin)}
                        </td>
                        <td className="p-2 text-right font-mono font-medium text-slate-800">
                          {formatMoneySign(con.cuota_mensual)}
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
                              con.estado === "activo"
                                ? "bg-emerald-100 text-emerald-800"
                                : con.estado === "finalizado"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {con.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Historial de Deudas */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <CreditCard size={16} className="text-teal-700" />
              Historial de Deudas
            </h2>

            {deudas.length === 0 ? (
              <p className="text-xs text-slate-400">Sin registro de deudas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-2">Fecha</th>
                      <th className="p-2">Patente / Movimiento</th>
                      <th className="p-2 text-right">Original</th>
                      <th className="p-2 text-right">Con Interés</th>
                      <th className="p-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deudas.map((d) => (
                      <tr key={d.id}>
                        <td className="p-2 text-slate-600">
                          {formatFechaHora(d.created_at)}
                        </td>
                        <td className="p-2 font-mono font-medium text-slate-800">
                          {d.patente || `Mov #${d.movimiento_id || "-"}`}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600">
                          {formatMoneySign(d.monto_original)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatMoneySign(d.monto_con_interes)}
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
                              d.estado === "pendiente"
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {d.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
