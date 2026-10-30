import { Plus, Search, X, ChevronLeft, ChevronRight, FileText, Trash2, Eye } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { listContratos } from "@/lib/alquiler";
import { formatMoneySign, formatFecha } from "@/lib/format";
import type { ContratoAlquilerFila } from "@/lib/alquiler";
import Link from "next/link";

export const dynamic = "force-dynamic";

function getEstadoConfig(estado: string) {
  switch (estado) {
    case "activo":
      return { label: "Vigente", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "finalizado":
      return { label: "Finalizado", className: "bg-slate-100 text-slate-800 border-slate-200" };
    case "cancelado":
      return { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-200" };
    default:
      return { label: estado, className: "bg-slate-100 text-slate-800 border-slate-200" };
  }
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
  }>;
}) {
  await requirePageUser(["admin", "operador", "contador"], "operaciones.read");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit ?? "20", 10)));
  const q = params.q ?? "";

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(params as Record<string, string>);
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined || value === "") newParams.delete(key);
      else newParams.set(key, value);
    });
    return `/alquileres/contratos?${newParams.toString()}`;
  };

  const pool = getPool();
  const contratos = await listContratos(pool);
  const total = contratos.length;
  const totalPages = Math.ceil(total / limit) || 1;

  const filtrados = q
    ? contratos.filter((c) =>
        c.cliente_nombre?.toLowerCase().includes(q.toLowerCase()),
      )
    : contratos;

  const contratosPaginados = filtrados.slice(
    (page - 1) * limit,
    page * limit,
  );
return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contratos de Alquiler</h1>
          <p className="text-sm text-slate-500">Gestión de contratos vigentes, finalizados y cancelados</p>
        </div>

        <Link
          href="/alquileres/contratos/nuevo"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo contrato
        </Link>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <form className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              name="q"
              value={q}
              placeholder="Buscar por cliente..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          {q && (
            <a
              href="/alquileres/contratos"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <X size={16} />
              Limpiar
            </a>
          )}
        </form>
      </div>

      {/* Tabla de contratos */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="text-slate-300" size={48} />
            <p className="mt-4 text-slate-500">
              {q ? `No hay contratos que coincidan con "${q}"` : "No hay contratos registrados"}
            </p>
            {!q && (
              <Link
                href="/alquileres/contratos/nuevo"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700"
              >
                <Plus size={16} />
                Crear primer contrato
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Plaza</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Inicio</th>
                  <th className="px-4 py-3">Fin</th>
                  <th className="px-4 py-3 text-right">Monto total</th>
                  <th className="px-4 py-3 text-right">Cuota mensual</th>
                  <th className="px-4 py-3 text-center">Vencimiento</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
{contratosPaginados.map((contrato: ContratoAlquilerFila) => {
                    const estadoConfig = getEstadoConfig(contrato.estado);
                    return (
                      <tr key={contrato.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-mono text-slate-900">
                          {contrato.plaza_numero} ({contrato.plaza_sector})
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">{contrato.cliente_nombre}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {contrato.tipo_alquiler_nombre}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatFecha(contrato.fecha_inicio)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{formatFecha(contrato.fecha_fin)}</td>
                        <td className="px-4 py-3 text-right text-sm font-mono font-semibold text-slate-900">{formatMoneySign(contrato.monto_total)}</td>
                        <td className="px-4 py-3 text-right text-sm font-mono text-blue-600">{formatMoneySign(contrato.cuota_mensual)}</td>
                        <td className="px-4 py-3 text-center text-sm font-mono text-slate-700">{contrato.dia_vencimiento ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoConfig.className}`}>
                            {estadoConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/alquileres/contratos/${contrato.id}`}
                              className="inline-flex items-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                              title="Ver detalle"
                            >
                              <Eye size={16} />
                            </Link>
                            {contrato.estado === "activo" && (
                              <form action={`/alquileres/contratos/${contrato.id}/cancelar`} method="POST">
                                <button
                                  type="submit"
                                  onClick={(e) => {
                                    if (!confirm("¿Cancelar este contrato? Esta acción no se puede deshacer.")) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className="inline-flex items-center rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                                  title="Cancelar contrato"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </form>
                            )}
                          </div>
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
                  Página {page} de {totalPages} — {filtrados.length} de {total} resultados
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
