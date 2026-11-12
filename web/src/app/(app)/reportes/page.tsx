import Link from "next/link";
import { getPool } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";

import { TIMEZONE_AR } from "@/lib/format";
import { reporteCaja, reporteDeudas, reporteOcupacion } from "@/lib/reportes";
import { rangoPeriodoSchema } from "@/lib/validations/contable";
import { Download, Building2, LandPlot, DollarSign, AlertTriangle, Clock } from "lucide-react";
export const dynamic = "force-dynamic";
type Vista = "caja" | "deudas" | "ocupacion";

const VISTAS: { id: Vista; label: string; endpoint: string; icono: typeof Building2 }[] = [
  { id: "caja", label: "Caja", endpoint: "/api/reportes/caja", icono: DollarSign },
  { id: "deudas", label: "Deudas", endpoint: "/api/reportes/deudas", icono: AlertTriangle },
  { id: "ocupacion", label: "Ocupación", endpoint: "/api/reportes/ocupacion", icono: LandPlot },
];

function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE_AR }).format(new Date());
}

function formatearFecha(fecha: string): string {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildUrl(
  baseParams: { desde: string; hasta: string; vista: Vista },
  overrides: Record<string, string | undefined>,
) {
  const newParams = new URLSearchParams({
    desde: baseParams.desde,
    hasta: baseParams.hasta,
    vista: baseParams.vista,
  });
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined || value === "") newParams.delete(key);
    else newParams.set(key, value);
  });
  return `/reportes?${newParams.toString()}`;
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">{icon}</div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
function CajaView({ caja }: { caja: Awaited<ReturnType<typeof reporteCaja>> }) {
  if (caja.dias.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <DollarSign className="mx-auto text-slate-300" size={48} />
        <h3 className="mt-4 text-lg font-semibold text-slate-700">Sin movimientos en el período</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total facturado" value={`$ ${caja.totales.total}`} icon={<DollarSign className="text-teal-600" size={20} />} />
        <StatCard label="Efectivo" value={`$ ${caja.totales.efectivo}`} icon={<Building2 className="text-green-600" size={20} />} />
        <StatCard label="Tarjeta" value={`$ ${caja.totales.tarjeta}`} icon={<LandPlot className="text-blue-600" size={20} />} />
        <StatCard label="Transferencia" value={`$ ${caja.totales.transferencia}`} icon={<Clock className="text-purple-600" size={20} />} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Efectivo</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarjeta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Transferencia</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Otras</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ops.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {caja.dias.map((dia) => (
                <tr key={dia.fecha} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatearFecha(dia.fecha)}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700 font-semibold">${dia.total}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">${dia.efectivo}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">${dia.tarjeta}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">${dia.transferencia}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">${dia.otras}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-500">{dia.operaciones}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-sm text-slate-900">TOTALES</td>
                <td className="px-4 py-3 text-right text-sm text-slate-900">${caja.totales.total}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">${caja.totales.efectivo}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">${caja.totales.tarjeta}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">${caja.totales.transferencia}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">${caja.totales.otras}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">{caja.totales.operaciones}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    vista?: string;
  }>;
}) {
  await requirePageUser(["admin", "operador", "contador"], "reportes.read");

  const params = await searchParams;
  const hoy = hoyEnArgentina();

  const vista: Vista = VISTAS.find((v) => v.id === params.vista)?.id ?? "caja";

  const rangoParseado = rangoPeriodoSchema.safeParse({
    desde: params.desde ?? `${hoy.slice(0, 7)}-01`,
    hasta: params.hasta ?? hoy,
  });

  const periodo = rangoParseado.success
    ? rangoParseado.data
    : { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };

  const pool = getPool();

  const [caja, deudas, ocupacion] = await Promise.all([
    vista === "caja" ? reporteCaja(pool, periodo) : null,
    vista === "deudas" ? reporteDeudas(pool, periodo) : null,
    vista === "ocupacion" ? reporteOcupacion(pool) : null,
  ]);

  const endpointActual = VISTAS.find((v) => v.id === vista)!.endpoint;
  const csvUrl = vista === "ocupacion"
    ? `${endpointActual}?export=csv`
    : `${endpointActual}?desde=${periodo.desde}&hasta=${periodo.hasta}&export=csv`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reportes operativos</h1>
          <p className="text-sm text-slate-500">
            Caja diaria, deudas pendientes y ocupación en tiempo real
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={csvUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Download size={16} />
            Exportar CSV
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <nav className="flex overflow-x-auto" role="tablist">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={vista === v.id}
              onClick={() => window.location.href = buildUrl({ desde: periodo.desde, hasta: periodo.hasta, vista: v.id }, { vista: v.id })}
              className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                vista === v.id
                  ? "bg-teal-50 text-teal-700 border-b-2 border-teal-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <v.icono size={16} />
              {v.label}
            </button>
          ))}
        </nav>
      </div>

      {vista !== "ocupacion" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <form method="GET" className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="vista" value={vista} />
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="desde" className="block text-xs font-medium text-slate-500 mb-1">
                Desde
              </label>
              <input
                type="date"
                id="desde"
                name="desde"
                defaultValue={periodo.desde}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="hasta" className="block text-xs font-medium text-slate-500 mb-1">
                Hasta
              </label>
              <input
                type="date"
                id="hasta"
                name="hasta"
                defaultValue={periodo.hasta}
                max={hoy}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              <Building2 size={16} />
              Filtrar
            </button>
          </form>
        </div>
      )}

      {vista === "caja" && caja && <CajaView caja={caja} />}
      {vista === "deudas" && deudas && <DeudasView deudas={deudas} />}
      {vista === "ocupacion" && ocupacion && <OcupacionView ocupacion={ocupacion} />}
    </div>
  );
}
function DeudasView({ deudas }: { deudas: Awaited<ReturnType<typeof reporteDeudas>> }) {
  if (deudas.filas.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <AlertTriangle className="mx-auto text-slate-300" size={48} />
        <h3 className="mt-4 text-lg font-semibold text-slate-700">Sin deudas pendientes</h3>
        <p className="mt-1 text-sm text-slate-500">¡Todo al día!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total deudores" value={deudas.totales.cantidad} icon={<AlertTriangle className="text-amber-600" size={20} />} />
        <StatCard label="Monto original" value={`$ ${deudas.totales.monto_original}`} icon={<DollarSign className="text-slate-600" size={20} />} />
        <StatCard label="Con interés" value={`$ ${deudas.totales.monto_con_interes}`} icon={<DollarSign className="text-red-600" size={20} />} />
        <StatCard label="Vencidas" value={deudas.totales.vencidas} icon={<Clock className="text-red-600" size={20} />} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Doc./Contacto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Referencia</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Original</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Con interés</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Vence</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Atraso</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deudas.filas.map((fila) => (
                <tr key={`${fila.tipo}-${fila.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{fila.cliente_nombre}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {fila.cliente_documento ?? "—"}<br />
                    {fila.cliente_email ?? "—"}<br />
                    {fila.cliente_telefono ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 capitalize">{fila.tipo}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fila.referencia}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">${fila.monto_original}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-900 font-medium">${fila.monto_con_interes}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-600">{formatearFecha(fila.fecha_vencimiento)}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium">
                    {fila.dias_atraso > 0 ? (
                      <span className="text-red-600">{fila.dias_atraso} días</span>
                    ) : (
                      <span className="text-green-600">Al día</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        fila.estado === "pendiente"
                          ? "bg-amber-100 text-amber-800"
                          : fila.estado === "pagada"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {fila.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function OcupacionView({ ocupacion }: { ocupacion: Awaited<ReturnType<typeof reporteOcupacion>> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total plazas" value={ocupacion.resumen.total_plazas} icon={<LandPlot className="text-slate-600" size={20} />} />
        <StatCard label="Ocupadas (rotación)" value={ocupacion.resumen.ocupadas_rotacion} icon={<Building2 className="text-blue-600" size={20} />} />
        <StatCard label="Ocupadas (alquiler)" value={ocupacion.resumen.ocupadas_alquiler} icon={<Building2 className="text-green-600" size={20} />} />
        <StatCard label="Libres" value={ocupacion.resumen.libres} icon={<AlertTriangle className="text-green-600" size={20} />} />
        <StatCard label="% Ocupación" value={`${ocupacion.resumen.porcentaje_ocupacion}%`} icon={<Clock className="text-teal-600" size={20} />} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">
          Ocupación por sector
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sector</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ocupadas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Libres</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">% Ocupación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ocupacion.por_sector.map((s) => (
                <tr key={s.sector} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{s.sector}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{s.total}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{s.ocupadas}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">{s.libres}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-teal-700">{s.porcentaje}%</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-sm text-slate-900">TOTAL</td>
                <td className="px-4 py-3 text-right text-sm text-slate-900">{ocupacion.resumen.total_plazas}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">{ocupacion.resumen.ocupadas_rotacion + ocupacion.resumen.ocupadas_alquiler}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">{ocupacion.resumen.libres}</td>
                <td className="px-4 py-3 text-right text-sm text-teal-700">{ocupacion.resumen.porcentaje_ocupacion}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {ocupacion.contratos_activos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">
            Contratos activos ({ocupacion.contratos_activos.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plaza</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sector</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha fin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ocupacion.contratos_activos.map((c) => (
                  <tr key={c.plaza_numero} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.plaza_numero}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{c.sector}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{c.cliente_nombre}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {c.fecha_fin ? formatearFecha(c.fecha_fin) : "Indefinido"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
