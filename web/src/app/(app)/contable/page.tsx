import Link from "next/link";
import { Download, Filter, Scale, ShieldAlert, ShoppingCart, TrendingUp } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { ivaCompras, ivaVentas, posicionIva } from "@/lib/contable";
import { TIMEZONE_AR } from "@/lib/format";
import { rangoPeriodoSchema } from "@/lib/validations/contable";
import { VistaCompras, VistaPosicion, VistaVentas } from "./vistas";

export const dynamic = "force-dynamic";

type Vista = "ventas" | "compras" | "posicion";

const VISTAS: { id: Vista; label: string; endpoint: string; icono: typeof TrendingUp }[] = [
  { id: "ventas", label: "IVA Ventas", endpoint: "/api/contable/iva-ventas", icono: TrendingUp },
  { id: "compras", label: "IVA Compras", endpoint: "/api/contable/iva-compras", icono: ShoppingCart },
  { id: "posicion", label: "Posición IVA", endpoint: "/api/contable/posicion-iva", icono: Scale },
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

  const endpointActual = VISTAS.find((v) => v.id === vista)!.endpoint;
  const csvUrl = `${endpointActual}?desde=${periodo.desde}&hasta=${periodo.hasta}&export=csv`;

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
    </div>
  );
}

