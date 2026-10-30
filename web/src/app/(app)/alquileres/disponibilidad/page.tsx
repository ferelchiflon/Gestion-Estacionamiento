import { Building2, Car, CarFront, Plus, Shield, X } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { getDisponibilidad } from "@/lib/alquiler";
import type { DisponibilidadFila } from "@/lib/alquiler";

export const dynamic = "force-dynamic";

function getEstadoConfig(estado: string, etiqueta: string) {
  switch (estado) {
    case "disponible":
      return {
        label: "Libre",
        icon: <Shield className="text-emerald-600" size={20} />,
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
        cardClass: "border-emerald-200 bg-emerald-50",
        cta: null,
      };
    case "ocupada":
      return {
        label: "Ocupada",
        icon: <Car className="text-amber-600" size={20} />,
        badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
        cardClass: "border-amber-200 bg-amber-50",
        cta: null,
      };
    case "alquilada":
      return {
        label: `Alquilada ${etiqueta ? `· ${etiqueta}` : ""}`,
        icon: <Building2 className="text-blue-600" size={20} />,
        badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
        cardClass: "border-blue-200 bg-blue-50",
        cta: null,
      };
    default:
      return {
        label: estado,
        icon: <X className="text-slate-400" size={20} />,
        badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
        cardClass: "border-slate-200",
        cta: null,
      };
  }
}
export default async function DisponibilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo_vehiculo?: string }>;
}) {
  await requirePageUser(["admin", "operador", "contador"], "operaciones.read");

  const params = await searchParams;
  const tipoFiltro = params.tipo_vehiculo;

  const pool = getPool();
  const disponibilidad = await getDisponibilidad(pool);

  // Filtrar por tipo de vehículo si se especifica
  const filtrados = tipoFiltro
    ? disponibilidad.filter((p) => p.tipo_vehiculo === tipoFiltro)
    : disponibilidad;

  // Tipos únicos para el filtro
  const tipos = [
    ...new Set(disponibilidad.map((p) => p.tipo_vehiculo)),
  ].sort();

  const resumen = {
    libre: filtrados.filter((p) => p.estado === "disponible").length,
    ocupada: filtrados.filter((p) => p.estado === "ocupada").length,
    alquilada: filtrados.filter((p) => p.estado === "alquilada").length,
    total: filtrados.length,
  };
return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Disponibilidad de Plazas</h1>
          <p className="text-sm text-slate-500">
            Vista visual del estado de cada plaza en tiempo real
          </p>
        </div>

        <form action="/alquileres/disponibilidad" method="get" className="flex flex-wrap items-center gap-3">
          <select
            name="tipo_vehiculo"
            defaultValue={tipoFiltro || ""}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            Filtrar
          </button>
        </form>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <Shield className="text-emerald-600" size={20} />
            <span className="text-sm font-medium text-emerald-800">Libres</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{resumen.libre}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <Car className="text-amber-600" size={20} />
            <span className="text-sm font-medium text-amber-800">Ocupadas</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-700">{resumen.ocupada}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Building2 className="text-blue-600" size={20} />
            <span className="text-sm font-medium text-blue-800">Alquiladas</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-700">{resumen.alquilada}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <CarFront className="text-slate-600" size={20} />
            <span className="text-sm font-medium text-slate-700">Total</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">{resumen.total}</p>
        </div>
      </div>

      {/* Grilla de plazas */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="text-slate-300" size={48} />
            <p className="mt-4 text-slate-500">
              {tipoFiltro
                ? `No hay plazas de tipo "${tipoFiltro}"`
                : "No hay plazas registradas"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((plaza: DisponibilidadFila) => {
              const config = getEstadoConfig(plaza.estado, plaza.etiqueta);
              return (
                <article
                  key={plaza.plaza_id}
                  className={`relative ${config.cardClass} rounded-lg border p-4 transition-colors hover:shadow-md ${
                    plaza.estado === "disponible" ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Sector {plaza.sector}
                      </p>
                      <p className="text-2xl font-bold text-slate-900 font-mono">
                        {plaza.numero}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {config.icon}
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${config.badgeClass}`}>
                      {config.label}
                    </span>
                  </div>

                  {plaza.estado === "disponible" && (
                    <a
                      href={`/alquileres/contratos/nuevo?plaza_id=${plaza.plaza_id}`}
                      className="mt-4 block w-full rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      <Plus className="inline mr-1" size={14} />
                      Crear contrato
                    </a>
                  )}

                  {plaza.estado === "alquilada" && plaza.etiqueta && (
                    <div className="mt-3 p-2 rounded-lg bg-blue-50 border border-blue-100">
                      <p className="text-xs text-blue-700 font-medium">
                        Disponible desde: <span className="font-mono">{plaza.etiqueta}</span>
                      </p>
                    </div>
                  )}

                  <p className="mt-2 text-xs text-slate-500 capitalize">
                    {plaza.tipo_vehiculo}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}