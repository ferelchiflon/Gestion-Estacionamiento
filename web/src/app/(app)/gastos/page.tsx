import {
  Plus,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Trash2,
  Edit2,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { listarGastos, totalesGastos, listarCategorias } from "@/lib/gastos";
import { formatMoneySign, formatFecha } from "@/lib/format";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { GastoFila, GastoTotales } from "@/lib/gastos";

export const dynamic = "force-dynamic";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{
    fecha_desde?: string;
    fecha_hasta?: string;
    categoria_id?: string;
    proveedor?: string;
    page?: string;
    limit?: string;
  }>;
}) {
await requirePageUser(["admin", "operador", "contador"], "fiscal.read");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit ?? "50", 10)));

  const pool = getPool();

  const [gastosResult, totales, categorias] = await Promise.all([
    listarGastos(pool, {
      fecha_desde: params.fecha_desde,
      fecha_hasta: params.fecha_hasta,
      categoria_id: params.categoria_id ? parseInt(params.categoria_id, 10) : undefined,
      proveedor: params.proveedor,
      limit,
      offset: (page - 1) * limit,
    }),
    totalesGastos(pool, {
      fecha_desde: params.fecha_desde,
      fecha_hasta: params.fecha_hasta,
      categoria_id: params.categoria_id ? parseInt(params.categoria_id, 10) : undefined,
      proveedor: params.proveedor,
    }),
    listarCategorias(pool),
  ]);

  const { data: gastos, total } = gastosResult;
  const totalPages = Math.ceil(total / limit) || 1;

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(params as Record<string, string>);
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined || value === "") newParams.delete(key);
      else newParams.set(key, value);
    });
    return `/gastos?${newParams.toString()}`;
  };

  const clearFiltersUrl = "/gastos";

  const ivaTotal = (
    parseFloat(totales.iva_21) +
    parseFloat(totales.iva_105) +
    parseFloat(totales.iva_27)
  ).toFixed(2);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gastos / Compras</h1>
          <p className="text-sm text-slate-500">Libro de compras - IVA y IIBB</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/gastos/nuevo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <Plus size={16} />
            Nuevo gasto
          </a>
          <a
            href={buildUrl({}) + "&export=csv"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Download size={16} />
            Exportar CSV
          </a>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form method="GET" className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="fecha_desde" className="block text-xs font-medium text-slate-500 mb-1">
              Fecha desde
            </label>
            <input
              type="date"
              id="fecha_desde"
              name="fecha_desde"
              value={params.fecha_desde ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="fecha_hasta" className="block text-xs font-medium text-slate-500 mb-1">
              Fecha hasta
            </label>
            <input
              type="date"
              id="fecha_hasta"
              name="fecha_hasta"
              value={params.fecha_hasta ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="categoria_id" className="block text-xs font-medium text-slate-500 mb-1">
              Categoría
            </label>
            <select
              id="categoria_id"
              name="categoria_id"
              value={params.categoria_id ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="proveedor" className="block text-xs font-medium text-slate-500 mb-1">
              Proveedor
            </label>
            <input
              type="text"
              id="proveedor"
              name="proveedor"
              value={params.proveedor ?? ""}
              placeholder="Buscar proveedor..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors">
              <Filter size={14} />
              Filtrar
            </button>
            <a
              href={clearFiltersUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <X size={14} />
              Limpiar
            </a>
          </div>
        </form>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Comprobantes</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totales.comprobantes}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Neto gravado</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoneySign(totales.neto_gravado)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">IVA total</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{formatMoneySign(ivaTotal)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total período</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatMoneySign(totales.total)}</p>
        </div>
      </div>

      {/* Tabla de gastos */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {gastos.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-slate-500">No hay gastos registrados para los filtros seleccionados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Comprobante</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Categoría</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Neto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">IVA</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Pago</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gastos.map((gasto) => (
                    <tr key={gasto.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">{formatFecha(gasto.fecha)}</div>
                        {gasto.cuit_proveedor && (
                          <div className="text-2xs text-slate-500 font-mono">{gasto.cuit_proveedor}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">{gasto.proveedor}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-mono text-slate-900">{gasto.tipo_comprobante}</div>
                        {gasto.punto_venta && gasto.numero_comprobante && (
                          <div className="text-2xs text-slate-500 font-mono">
                            {String(gasto.punto_venta).padStart(4, "0")}-{String(gasto.numero_comprobante).padStart(8, "0")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {gasto.categoria_nombre ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {gasto.categoria_nombre}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-900 text-right">
                        {formatMoneySign(gasto.neto_gravado)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600 text-right">
                        {formatMoneySign(
                          (
                            parseFloat(gasto.iva_21) +
                            parseFloat(gasto.iva_105) +
                            parseFloat(gasto.iva_27)
                          ).toFixed(2)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-emerald-600 text-right">
                        {formatMoneySign(gasto.total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {gasto.forma_pago && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {gasto.forma_pago}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/gastos/${gasto.id}/editar`}
                            className="inline-flex items-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Página {page} de {totalPages} — {total} resultados
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={page > 1 ? buildUrl({ page: String(page - 1) }) : "#"}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${page > 1 ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}
                    aria-disabled={page <= 1}
                  >
                    <ChevronLeft size={14} />
                  </a>
                  <a
                    href={page < totalPages ? buildUrl({ page: String(page + 1) }) : "#"}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${page < totalPages ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}
                    aria-disabled={page >= totalPages}
                  >
                    <ChevronRight size={14} />
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}