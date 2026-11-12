import Link from "next/link";
import { Download, Filter, Scale, ShieldAlert, ShoppingCart, TrendingUp, Landmark, BarChart3, Calendar, FileText } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { ivaCompras, ivaVentas, posicionIva, iibb, balance, reporteMensual, arca } from "@/lib/contable";
import { TIMEZONE_AR } from "@/lib/format";
import { rangoPeriodoSchema } from "@/lib/validations/contable";
import { VistaCompras, VistaPosicion, VistaVentas } from "./vistas";

export const dynamic = "force-dynamic";

type Vista = "ventas" | "compras" | "posicion" | "iibb" | "balance" | "mensual" | "arca";

const VISTAS: { id: Vista; label: string; endpoint: string; icono: typeof TrendingUp }[] = [
  { id: "ventas", label: "IVA Ventas", endpoint: "/api/contable/iva-ventas", icono: TrendingUp },
  { id: "compras", label: "IVA Compras", endpoint: "/api/contable/iva-compras", icono: ShoppingCart },
  { id: "posicion", label: "Posición IVA", endpoint: "/api/contable/posicion-iva", icono: Scale },
  { id: "iibb", label: "IIBB", endpoint: "/api/contable/iibb", icono: Landmark },
  { id: "balance", label: "Balance", endpoint: "/api/contable/balance", icono: BarChart3 },
  { id: "mensual", label: "Mensual", endpoint: "/api/contable/mensual", icono: Calendar },
  { id: "arca", label: "ARCA", endpoint: "/api/contable/arca", icono: FileText },
];

function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE_AR }).format(new Date());
}

export default async function ContablePage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    vista?: string;
  }>;
}) {
  await requirePageUser(["admin", "contador"], "fiscal.read");

  const params = await searchParams;
  const hoy = hoyEnArgentina();

  const vista: Vista =
    params.vista === "compras" || params.vista === "posicion" ? params.vista : "ventas";

  const rangoParseado = rangoPeriodoSchema.safeParse({
    desde: params.desde ?? `${hoy.slice(0, 7)}-01`,
    hasta: params.hasta ?? hoy,
  });

  const rangoInvalido = !rangoParseado.success;
  const periodo = rangoParseado.success
    ? rangoParseado.data
    : { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams({
      desde: periodo.desde,
      hasta: periodo.hasta,
      vista,
    });
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined || value === "") newParams.delete(key);
      else newParams.set(key, value);
    });
    return `/contable?${newParams.toString()}`;
  };

  const pool = getPool();

  const ventas = vista === "ventas" ? await ivaVentas(pool, periodo) : null;
  const compras = vista === "compras" ? await ivaCompras(pool, periodo) : null;
  const posicion = vista === "posicion" ? await posicionIva(pool, periodo) : null;
  const iibbData = vista === "iibb" ? await iibb(pool, periodo) : null;
  const balanceData = vista === "balance" ? await balance(pool, periodo) : null;
  const mensualData = vista === "mensual" ? await reporteMensual(pool, Number(periodo.hasta.slice(5, 7)), Number(periodo.hasta.slice(0, 4))) : null;
  const arcaData = vista === "arca" ? await arca(pool, periodo) : null;

  const endpointActual = VISTAS.find((v) => v.id === vista)!.endpoint;
  const csvUrl = vista === "mensual"
    ? `${endpointActual}?mes=${periodo.hasta.slice(5, 7)}&anio=${periodo.hasta.slice(0, 4)}&export=csv`
    : `${endpointActual}?desde=${periodo.desde}&hasta=${periodo.hasta}&export=csv`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contable — Referencia interna</h1>
          <p className="text-sm text-slate-500">
            IVA de ventas, IVA de compras y posición de IVA por alícuota
          </p>
        </div>

        <a
          href={csvUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <Download size={16} />
          Exportar CSV
        </a>
      </div>

      {/* Cartel permanente: estos reportes no son oficiales */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
        <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={20} />
        <div>
          <p className="text-sm font-semibold">
            Reporte de referencia interna — sujeto a aprobación del contador
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            No constituye una declaración jurada. No genera archivos oficiales (ARCA/AFIP) ni
            incluye IIBB. Las cifras son de apoyo y requieren revisión y aprobación del contador
            antes de ser utilizadas.
          </p>
        </div>
      </div>

      {/* Selector de período compartido */}
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Filter size={14} />
              Aplicar
            </button>
            <Link
              href={buildUrl({ desde: `${hoy.slice(0, 7)}-01`, hasta: hoy })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              Mes actual
            </Link>
          </div>
        </form>
        {rangoInvalido && (
          <p className="mt-3 text-sm text-red-600">
            El período indicado no es válido: se muestra el mes actual.
          </p>
        )}
      </div>

      {/* Selector de vista */}
      <div className="flex flex-wrap gap-2">
        {VISTAS.map((v) => {
          const activo = v.id === vista;
          const Icono = v.icono;
          return (
            <Link
              key={v.id}
              href={buildUrl({ vista: v.id })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                activo
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icono size={16} />
              {v.label}
            </Link>
          );
        })}
      </div>


      {ventas && <VistaVentas reporte={ventas} />}
      {compras && <VistaCompras reporte={compras} />}
      {posicion && <VistaPosicion reporte={posicion} />}
      {iibbData && <VistaIibb reporte={iibbData} />}
      {balanceData && <VistaBalance reporte={balanceData} />}
      {mensualData && <VistaMensual reporte={mensualData} />}
      {arcaData && <VistaArca reporte={arcaData} />}
    </div>
  );
}

function VistaIibb({ reporte }: { reporte: Awaited<ReturnType<typeof iibb>> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Ventas brutas" value={`$ ${reporte.ventasBrutas}`} icon={<Landmark className="text-slate-600" size={20} />} />
        <StatCard label="Base imponible" value={`$ ${reporte.baseImponible}`} icon={<Scale className="text-blue-600" size={20} />} />
        <StatCard label="Impuesto determinado" value={`$ ${reporte.impuestoDeterminado}`} icon={<BarChart3 className="text-amber-600" size={20} />} />
        <StatCard label="Saldo" value={`$ ${reporte.saldo}`} icon={<Landmark className={reporte.estado === "a_pagar" ? "text-red-600" : "text-green-600"} size={20} />} />
        <StatCard label="Alícuota IIBB" value={`${reporte.alicuotaIibb}%`} icon={<FileText className="text-slate-500" size={20} />} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Percepciones y retenciones por jurisdicción</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Jurisdicción</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Percepciones</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Retenciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.porJurisdiccion.map((j) => (
                <tr key={j.jurisdiccion} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{j.jurisdiccion}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">${j.percepciones}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">${j.retenciones}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-sm text-slate-900">TOTALES</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">${reporte.percepciones}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">${reporte.retenciones}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold mb-2">Advertencias:</p>
        <ul className="list-disc list-inside space-y-1">
          {reporte.advertencias.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>
    </div>
  );
}

function VistaBalance({ reporte }: { reporte: Awaited<ReturnType<typeof balance>> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Ingresos" value={`$ ${reporte.ingresos.total}`} icon={<TrendingUp className="text-green-600" size={20} />} />
        <StatCard label="Gastos" value={`$ ${reporte.gastos.total}`} icon={<ShoppingCart className="text-red-600" size={20} />} />
        <StatCard label="Resultado" value={`$ ${reporte.resultado}`} icon={<BarChart3 className={Number(pesosTextoACentavos(reporte.resultado)) >= 0 ? "text-green-600" : "text-red-600"} size={20} />} />
        <StatCard label="Por cobrar" value={`$ ${reporte.cuentasPorCobrar.total}`} icon={<Landmark className="text-amber-600" size={20} />} />
        <StatCard label="Vencidas" value={reporte.cuentasPorCobrar.vencidas} icon={<AlertTriangle className="text-red-600" size={20} />} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Ingresos por rubro</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rubro</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Operaciones</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50"><td className="px-4 py-3 text-sm font-medium text-slate-900">Estacionamiento</td><td className="px-4 py-3 text-right text-sm text-slate-700">{reporte.ingresos.estacionamiento.ops}</td><td className="px-4 py-3 text-right text-sm text-slate-700">${reporte.ingresos.estacionamiento.total}</td></tr>
              <tr className="hover:bg-slate-50"><td className="px-4 py-3 text-sm font-medium text-slate-900">Alquileres</td><td className="px-4 py-3 text-right text-sm text-slate-700">{reporte.ingresos.alquileres.ops}</td><td className="px-4 py-3 text-right text-sm text-slate-700">${reporte.ingresos.alquileres.total}</td></tr>
              <tr className="hover:bg-slate-50"><td className="px-4 py-3 text-sm font-medium text-slate-900">Deudas cobradas</td><td className="px-4 py-3 text-right text-sm text-slate-700">{reporte.ingresos.deudas.ops}</td><td className="px-4 py-3 text-right text-sm text-slate-700">${reporte.ingresos.deudas.total}</td></tr>
              <tr className="bg-slate-50 font-semibold"><td className="px-4 py-3 text-sm text-slate-900">TOTAL INGRESOS</td><td className="px-4 py-3 text-right text-sm text-slate-700">{reporte.ingresos.estacionamiento.ops + reporte.ingresos.alquileres.ops + reporte.ingresos.deudas.ops}</td><td className="px-4 py-3 text-right text-sm text-slate-900">${reporte.ingresos.total}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Gastos por categoría</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Comprobantes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.gastos.porCategoria.map((c) => (
                <tr key={c.categoria} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.categoria}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{c.comprobantes}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">${c.total}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-sm text-slate-900">TOTAL GASTOS</td>
                <td className="px-4 py-3 text-right text-sm text-slate-700">{reporte.gastos.porCategoria.reduce((s, c) => s + c.comprobantes, 0)}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-900">${reporte.gastos.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Cuentas por cobrar</div>
        <div className="p-4 grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-900">${reporte.cuentasPorCobrar.total}</p>
            <p className="text-xs text-slate-500">Total por cobrar</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-900">{reporte.cuentasPorCobrar.cantidad}</p>
            <p className="text-xs text-slate-500">Deudores</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{reporte.cuentasPorCobrar.vencidas}</p>
            <p className="text-xs text-red-600">Vencidas</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold mb-2">Advertencias:</p>
        <ul className="list-disc list-inside space-y-1">
          {reporte.advertencias.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>
    </div>
  );
}

function VistaMensual({ reporte }: { reporte: Awaited<ReturnType<typeof reporteMensual>> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Ingresos" value={`$ ${reporte.ingresos.total}`} icon={<TrendingUp className="text-green-600" size={20} />} />
        <StatCard label="Gastos" value={`$ ${reporte.gastos.total}`} icon={<ShoppingCart className="text-red-600" size={20} />} />
        <StatCard label="Ocupación" value={`${reporte.plazas.ocupacionPct}%`} icon={<Landmark className="text-blue-600" size={20} />} />
        <StatCard label="Deudas" value={`$ ${reporte.deudas.total}`} icon={<AlertTriangle className="text-amber-600" size={20} />} />
        <StatCard label="Vencidas" value={reporte.deudas.vencidas} icon={<AlertTriangle className="text-red-600" size={20} />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Ingresos por rubro</div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between"><span>Estacionamiento</span><span className="font-semibold">${reporte.ingresos.estacionamiento}</span></div>
            <div className="flex justify-between"><span>Alquileres</span><span className="font-semibold">${reporte.ingresos.alquileres}</span></div>
            <div className="flex justify-between"><span>Deudas cobradas</span><span className="font-semibold">${reporte.ingresos.deudas}</span></div>
            <div className="border-t pt-2 flex justify-between font-semibold"><span>Total</span><span>${reporte.ingresos.total}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Gastos por categoría</div>
          <div className="p-4 space-y-2">
            {reporte.gastos.porCategoria.map((c) => (
              <div key={c.categoria} className="flex justify-between">
                <span>{c.categoria}</span><span className="font-semibold">${c.total}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-semibold"><span>Total</span><span>${reporte.gastos.total}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Plazas y ocupación</div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <StatCard label="Total" value={reporte.plazas.total} icon={<Landmark className="text-slate-600" size={16} />} />
            <StatCard label="Rotación" value={reporte.plazas.ocupadasRotacion} icon={<TrendingUp className="text-blue-600" size={16} />} />
            <StatCard label="Alquiler" value={reporte.plazas.ocupadasAlquiler} icon={<ShoppingCart className="text-green-600" size={16} />} />
            <StatCard label="Libres" value={reporte.plazas.libres} icon={<AlertTriangle className="text-green-600" size={16} />} />
            <StatCard label="% Ocupación" value={`${reporte.plazas.ocupacionPct}%`} icon={<BarChart3 className="text-teal-600" size={16} />} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Deudas</div>
          <div className="p-4 grid grid-cols-3 gap-4">
            <StatCard label="Pendientes" value={reporte.deudas.pendientes} icon={<AlertTriangle className="text-amber-600" size={16} />} />
            <StatCard label="Total" value={`$ ${reporte.deudas.total}`} icon={<TrendingUp className="text-slate-600" size={16} />} />
            <StatCard label="Vencidas" value={reporte.deudas.vencidas} icon={<AlertTriangle className="text-red-600" size={16} />} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold mb-2">Advertencias:</p>
        <ul className="list-disc list-inside space-y-1">
          {reporte.advertencias.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>
    </div>
  );
}

function VistaArca({ reporte }: { reporte: Awaited<ReturnType<typeof arca>> }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">ARCA (ex AFIP) — Comprobantes emitidos</h2>
          <p className="text-sm text-slate-500">Punto de venta: {reporte.puntoVenta}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Resumen por día</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Comprobantes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Neto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">IVA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.dias.map((d) => (
                <tr key={d.fecha} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{d.fecha}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{d.comprobantes}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">${d.neto}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">${d.iva}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">${d.total}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-sm text-slate-900">TOTALES</td>
                <td className="px-4 py-3 text-right text-sm text-slate-900">{reporte.totales.comprobantes}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-900">${reporte.totales.neto}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-900">${reporte.totales.iva}</td>
                <td className="px-4 py-3 text-right text-sm text-slate-900">${reporte.totales.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Cobros de estacionamiento por forma de pago</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Forma de pago</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Operaciones</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.porFormaPago.map((f) => (
                <tr key={f.forma_pago} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900 capitalize">{f.forma_pago}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{f.operaciones}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">${f.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold mb-2">Advertencias:</p>
        <ul className="list-disc list-inside space-y-1">
          {reporte.advertencias.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>
    </div>
  );
}
