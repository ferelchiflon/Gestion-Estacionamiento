"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  SquareParking,
  Car,
  Clock,
  User,
} from "lucide-react";
import type { Rol } from "@/lib/permissions";
import { TIPOS_VEHICULO, type TipoVehiculo } from "@/lib/validations/modulo2";
import { ESTADOS_PLAZA, type EstadoPlaza } from "@/lib/validations/modulo3";
import { formatFechaHora } from "@/lib/format";

type Plaza = {
  id: number;
  numero: string;
  sector: string;
  tipo_vehiculo: TipoVehiculo;
  estado: EstadoPlaza;
  movimiento_patente: string | null;
  movimiento_hora_entrada: string | null;
  contrato_id: number | null;
  contrato_cliente_nombre: string | null;
};

type Resumen = {
  libre: number;
  ocupada: number;
  mantenimiento: number;
  total: number;
};

export default function PlazasManager({ userRole }: { userRole: Rol }) {
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [resumen, setResumen] = useState<Resumen>({
    libre: 0,
    ocupada: 0,
    mantenimiento: 0,
    total: 0,
  });
  const [sectorFilter, setSectorFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlaza, setEditingPlaza] = useState<Plaza | null>(null);
  const [formData, setFormData] = useState({
    numero: "",
    sector: "A",
    tipo_vehiculo: "auto" as TipoVehiculo,
    estado: "libre" as EstadoPlaza,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canWrite = userRole === "admin";

  const fetchPlazas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sectorFilter !== "todos") params.set("sector", sectorFilter);
      if (tipoFilter !== "todos") params.set("tipo_vehiculo", tipoFilter);
      if (estadoFilter !== "todos") params.set("estado", estadoFilter);

      const res = await fetch(`/api/plazas?${params.toString()}`);
      if (!res.ok) {
        throw new Error("No se pudo cargar el mapa de plazas");
      }
      const json = await res.json();
      setPlazas(json.data);
      setResumen(json.resumen);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [sectorFilter, tipoFilter, estadoFilter]);

  useEffect(() => {
    fetchPlazas();
  }, [fetchPlazas]);

  // Lista de sectores únicos para el filtro
  const sectoresDisponibles = Array.from(
    new Set(plazas.map((p) => p.sector))
  ).sort();

  function handleOpenCreate() {
    setEditingPlaza(null);
    setFormData({
      numero: "",
      sector: "A",
      tipo_vehiculo: "auto",
      estado: "libre",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function handleOpenEdit(plaza: Plaza) {
    setEditingPlaza(plaza);
    setFormData({
      numero: plaza.numero,
      sector: plaza.sector,
      tipo_vehiculo: plaza.tipo_vehiculo,
      estado: plaza.estado,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      try {
        const url = editingPlaza
          ? `/api/plazas/${editingPlaza.id}`
          : "/api/plazas";
        const method = editingPlaza ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Origin: window.location.origin,
          },
          body: JSON.stringify(formData),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Error al procesar la solicitud");
        }

        setModalOpen(false);
        fetchPlazas();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  async function handleDelete(id: number, numero: string) {
    if (!confirm(`¿Dar de baja lógica a la plaza "${numero}"?`)) return;

    try {
      const res = await fetch(`/api/plazas/${id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "No se pudo eliminar la plaza");
        return;
      }

      fetchPlazas();
    } catch {
      alert("Error de conexión al eliminar plaza");
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumen Superior */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="text-2xs font-semibold uppercase text-slate-500">
            Total Plazas
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-900">
            {resumen.total}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 shadow-xs">
          <div className="text-2xs font-semibold uppercase text-emerald-800">
            Libres
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-700">
            {resumen.libre}
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5 shadow-xs">
          <div className="text-2xs font-semibold uppercase text-amber-800">
            Ocupadas
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-700">
            {resumen.ocupada}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-xs">
          <div className="text-2xs font-semibold uppercase text-slate-500">
            Mantenimiento
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-600">
            {resumen.mantenimiento}
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {sectoresDisponibles.length > 0 && (
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-teal-600 focus:outline-hidden"
            >
              <option value="todos">Todos los sectores</option>
              {sectoresDisponibles.map((s) => (
                <option key={s} value={s}>
                  Sector {s}
                </option>
              ))}
            </select>
          )}

          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-teal-600 focus:outline-hidden"
          >
            <option value="todos">Todos los tipos</option>
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-teal-600 focus:outline-hidden"
          >
            <option value="todos">Todos los estados</option>
            {ESTADOS_PLAZA.map((est) => (
              <option key={est} value={est} className="capitalize">
                {est}
              </option>
            ))}
          </select>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-800"
          >
            <Plus size={15} />
            Nueva Plaza
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Grid de Plazas (Tarjetas visuales) */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Cargando plazas...
        </div>
      ) : plazas.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No se encontraron plazas con los filtros seleccionados
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {plazas.map((p) => {
            const isOcupada = p.estado === "ocupada";
            const isLibre = p.estado === "libre";

            return (
              <div
                key={p.id}
                className={`flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs transition-all ${
                  isLibre
                    ? "border-emerald-200 bg-white hover:border-emerald-300"
                    : isOcupada
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-slate-200 bg-slate-100/60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-black text-slate-900">
                      {p.numero}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ${
                        isLibre
                          ? "bg-emerald-100 text-emerald-800"
                          : isOcupada
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {p.estado}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-1 text-2xs text-slate-500">
                    <SquareParking size={12} />
                    Sector {p.sector} · <span className="capitalize">{p.tipo_vehiculo}</span>
                  </div>

                  {/* Detalle si está ocupada */}
                  {isOcupada && (
                    <div className="mt-3 rounded-md bg-white p-2 text-2xs shadow-2xs">
                      {p.movimiento_patente && (
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                          <Car size={13} className="text-amber-600" />
                          {p.movimiento_patente}
                        </div>
                      )}
                      {p.movimiento_hora_entrada && (
                        <div className="mt-0.5 flex items-center gap-1 text-slate-400">
                          <Clock size={11} />
                          {formatFechaHora(p.movimiento_hora_entrada)}
                        </div>
                      )}
                      {p.contrato_id && (
                        <div className="mt-1 flex items-center gap-1 text-teal-700">
                          <User size={11} />
                          {p.contrato_cliente_nombre}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {canWrite && (
                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => handleOpenEdit(p)}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      title="Baja lógica"
                      onClick={() => handleDelete(p.id, p.numero)}
                      className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Plaza */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editingPlaza ? "Editar Plaza" : "Nueva Plaza"}
            </h2>

            {formError && (
              <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Número de Plaza *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formData.numero}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        numero: e.target.value.toUpperCase(),
                      })
                    }
                    className="mt-1 w-full font-mono text-base font-bold uppercase rounded-lg border border-slate-300 p-2 focus:border-teal-600 focus:outline-hidden"
                    placeholder="01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Sector *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={formData.sector}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sector: e.target.value.toUpperCase(),
                      })
                    }
                    className="mt-1 w-full font-bold uppercase rounded-lg border border-slate-300 p-2 focus:border-teal-600 focus:outline-hidden"
                    placeholder="A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tipo de Vehículo
                  </label>
                  <select
                    value={formData.tipo_vehiculo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tipo_vehiculo: e.target.value as TipoVehiculo,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                  >
                    {TIPOS_VEHICULO.map((t) => (
                      <option key={t} value={t} className="capitalize">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estado: e.target.value as EstadoPlaza,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                  >
                    {ESTADOS_PLAZA.map((est) => (
                      <option key={est} value={est} className="capitalize">
                        {est}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-teal-800 disabled:opacity-50"
                >
                  {isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
