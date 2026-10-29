import {
  X,
  AlertTriangle,
  Users,
  DollarSign,
  ArrowUpDown,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { getDeudasUnificadas } from "@/lib/deudas";
import { formatMoneySign, formatFecha } from "@/lib/format";
import DeudaActions from "./deuda-actions";

export const dynamic = "force-dynamic";

export default async function DeudasPage({
  searchParams,
}: {
  searchParams: Promise<{
    cliente_id?: string;
    tipo?: string;
    estado?: string;
    antiguedad_min?: string;
    antiguedad_max?: string;
    sort_by?: string;
    sort_order?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  await requirePageUser(["admin", "operador", "contador"], "operaciones.read");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit ?? "20", 10)));

  const pool = getPool();
  const resultado = await getDeudasUnificadas(pool, {
    cliente_id: params.cliente_id ? parseInt(params.cliente_id, 10) : undefined,
    tipo: (params.tipo as "movimiento" | "alquiler" | "todas") ?? "todas",
    estado: (params.estado as "pendiente" | "pagada" | "todas") ?? "pendiente",
    antiguedad_min: params.antiguedad_min ? parseInt(params.antiguedad_min, 10) : undefined,
    antiguedad_max: params.antiguedad_max ? parseInt(params.antiguedad_max, 10) : undefined,
    sort_by: (params.sort_by as "monto" | "antiguedad" | "cliente") ?? "antiguedad",
    sort_order: (params.sort_order as "asc" | "desc") ?? "desc",
    page,
    limit,
  });

  const { data: deudas, resumen, total } = resultado;
  const totalPages = Math.ceil(total / limit) || 1;

  const clientesRes = await pool.query(
    `SELECT id, nombre FROM clientes WHERE estado = 'activo' AND eliminado_en IS NULL ORDER BY nombre`
  );
  const clientes = clientesRes.rows;

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(params as Record<string, string>);
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined || value === "") newParams.delete(key);
      else newParams.set(key, value);
    });
    return `/deudas?${newParams.toString()}`;
  };

  const clearFiltersUrl = "/deudas";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Deudas</h1>
          <p className="text-sm text-slate-500">Deudas pendientes de movimientos y alquileres</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg">
            <AlertTriangle size={14} />
            <span>{resumen.deudas_criticas} cr&iacute;ticas ({">"})30d)</span>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg">
            <Users size={14} />
            <span>{resumen.clientes_con_deuda} clientes</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg">
            <DollarSign size={14} />
            <span>Total: {formatMoneySign(resumen.total_adeudado)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="tipo" className="text-sm font-medium text-slate-700">Tipo:</label>
            <select
              id="tipo"
              value={params.tipo ?? "todas"}
              onChange={(e) => window.location.href = buildUrl({ tipo: e.target.value === "todas" ? undefined : e.target.value, page: undefined })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
            >
              <option value="todas">Todas</option>
              <option value="movimiento">Movimientos</option>
              <option value="alquiler">Alquileres</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="estado" className="text-sm font-medium text-slate-700">Estado:</label>
            <select
              id="estado"
              value={params.estado ?? "pendiente"}
              onChange={(e) => window.location.href = buildUrl({ estado: e.target.value === "pendiente" ? undefined : e.target.value, page: undefined })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
            >
              <option value="pendiente">Pendientes</option>
              <option value="pagada">Pagadas</option>
              <option value="todas">Todas</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="cliente" className="text-sm font-medium text-slate-700">Cliente:</label>
            <select
              id="cliente"
              value={params.cliente_id ?? ""}
              onChange={(e) => window.location.href = buildUrl({ cliente_id: e.target.value || undefined, page: undefined })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none min-w-[200px]"
            >
              <option value="">Todos los clientes</option>
              {clientes.map((c: { id: number; nombre: string }) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Antigüedad (días):</label>
            <input
              type="number"
              min="0"
              placeholder="Mín"
              value={params.antiguedad_min ?? ""}
              onChange={(e) => window.location.href = buildUrl({ antiguedad_min: e.target.value || undefined, page: undefined })}
              className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              min="0"
              placeholder="Máx"
              value={params.antiguedad_max ?? ""}
              onChange={(e) => window.location.href = buildUrl({ antiguedad_max: e.target.value || undefined, page: undefined })}
              className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label htmlFor="sort" className="text-sm font-medium text-slate-700">Orden:</label>
            <select
              id="sort"
              value={`${params.sort_by ?? "antiguedad"}_${params.sort_order ?? "desc"}`}
              onChange={(e) => {
                const [sort_by, sort_order] = e.target.value.split("_");
                window.location.href = buildUrl({ sort_by, sort_order, page: undefined });
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
            >
              <option value="antiguedad_desc">Antigüedad ↓</option>
              <option value="antiguedad_asc">Antigüedad ↑</option>
              <option value="monto_desc">Monto ↓</option>
              <option value="monto_asc">Monto ↑</option>
              <option value="cliente_asc">Cliente A-Z</option>
              <option value="cliente_desc">Cliente Z-A</option>
            </select>
          </div>

          {Object.keys(params).length > 1 && (
            <a
              href={clearFiltersUrl}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <X size={14} /> Limpiar filtros
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {deudas.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-2 text-lg font-medium text-slate-900">No hay deudas</h3>
            <p className="mt-1 text-slate-500">No se encontraron deudas con los filtros actuales</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span className="flex items-center gap-1">
                        Tipo
                        <ArrowUpDown size={10} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Concepto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span className="flex items-center gap-1 justify-end">
                        Monto
                        <ArrowUpDown size={10} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span className="flex items-center gap-1 justify-end">
                        Antigüedad
                        <ArrowUpDown size={10} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deudas.map((deuda) => {
                    const deudaId = deuda.tipo === "movimiento" ? deuda.id : deuda.contrato_id;
                    return (
                      <tr key={`${deuda.tipo}-${deudaId}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">{deuda.cliente_nombre}</div>
                        {deuda.tipo === "movimiento" && deuda.cliente_documento && (
                          <div className="text-2xs text-slate-500 font-mono">{deuda.cliente_documento}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${deuda.tipo === "movimiento" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {deuda.tipo === "movimiento" ? "Movimiento" : "Alquiler"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">
                        {deuda.tipo === "movimiento"
                          ? `${deuda.patente} - ${formatFecha(deuda.hora_entrada)}`
                          : `Alquiler ${deuda.plaza_numero} (Sector ${deuda.plaza_sector}) - Período ${deuda.periodo}`}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-900 text-right">
                        {formatMoneySign(deuda.tipo === "movimiento" ? deuda.monto_con_interes : deuda.cuota_mensual)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-mono ${(deuda.tipo === "movimiento" ? deuda.dias_antiguedad : deuda.dias_retraso) > 30 ? "text-red-600" : (deuda.tipo === "movimiento" ? deuda.dias_antiguedad : deuda.dias_retraso) > 15 ? "text-amber-600" : "text-slate-600"}`}>
                          {deuda.tipo === "movimiento" ? deuda.dias_antiguedad : deuda.dias_retraso} días
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {deuda.tipo === "movimiento" ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${deuda.estado === "pagada" ? "bg-emerald-50 text-emerald-700" : deuda.estado === "pagada_parcial" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                            {deuda.estado === "pagada" ? "Pagada" : deuda.estado === "pagada_parcial" ? "Parcial" : "Pendiente"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeudaActions
                          deudaId={deudaId}
                          tipo={deuda.tipo}
                          estado={deuda.tipo === "movimiento" ? deuda.estado : "pendiente"}
                          clienteEmail={deuda.cliente_email}
                          monto={deuda.tipo === "movimiento" ? deuda.monto_con_interes : deuda.cuota_mensual}
                        />
                      </td>
                    </tr>
                    );
                  })}
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
                    Anterior
                  </a>
                  <a
                    href={page < totalPages ? buildUrl({ page: String(page + 1) }) : "#"}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${page < totalPages ? "border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}
                    aria-disabled={page >= totalPages}
                  >
                    Siguiente
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
