"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import type { Rol } from "@/lib/permissions";
import { TIPOS_VEHICULO, type TipoVehiculo } from "@/lib/validations/modulo2";
import { formatMoneySign, formatFecha } from "@/lib/format";

type Tarifa = {
  id: number;
  tipo_vehiculo: TipoVehiculo;
  tarifa_hora: number | string;
  fecha_desde: string;
  fecha_hasta: string | null;
  es_vigente: boolean;
};

export default function TarifasManager({ userRole }: { userRole: Rol }) {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState<Tarifa | null>(null);
  const [formData, setFormData] = useState({
    tipo_vehiculo: "auto" as TipoVehiculo,
    tarifa_hora: 0,
    fecha_desde: "",
    fecha_hasta: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canWrite = userRole === "admin";

  const fetchTarifas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tipoFilter !== "todos") params.set("tipo", tipoFilter);

      const res = await fetch(`/api/tarifas?${params.toString()}`);
      if (!res.ok) {
        throw new Error("No se pudo cargar el listado de tarifas");
      }
      const json = await res.json();
      setTarifas(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [tipoFilter]);

  useEffect(() => {
    fetchTarifas();
  }, [fetchTarifas]);

  function handleOpenCreate() {
    setEditingTarifa(null);
    const today = new Date().toISOString().split("T")[0];
    setFormData({
      tipo_vehiculo: "auto",
      tarifa_hora: 1500,
      fecha_desde: today,
      fecha_hasta: "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function handleOpenEdit(tarifa: Tarifa) {
    setEditingTarifa(tarifa);
    setFormData({
      tipo_vehiculo: tarifa.tipo_vehiculo,
      tarifa_hora: Number(tarifa.tarifa_hora),
      fecha_desde: tarifa.fecha_desde,
      fecha_hasta: tarifa.fecha_hasta || "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = {
      ...formData,
      tarifa_hora: Number(formData.tarifa_hora),
      fecha_hasta: formData.fecha_hasta.trim() ? formData.fecha_hasta : null,
    };

    startTransition(async () => {
      try {
        const url = editingTarifa
          ? `/api/tarifas/${editingTarifa.id}`
          : "/api/tarifas";
        const method = editingTarifa ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Origin: window.location.origin,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Error al procesar la tarifa");
        }

        setModalOpen(false);
        fetchTarifas();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Dar de baja lógica a esta tarifa?")) return;

    try {
      const res = await fetch(`/api/tarifas/${id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "No se pudo eliminar la tarifa");
        return;
      }

      fetchTarifas();
    } catch {
      alert("Error de conexión al eliminar tarifa");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros y botón */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-teal-600 focus:outline-hidden"
          >
            <option value="todos">Todos los tipos de vehículo</option>
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
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
            Nueva Tarifa
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tabla de Tarifas */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tipo de Vehículo</th>
                <th className="px-4 py-3 text-right">Precio por Hora</th>
                <th className="px-4 py-3">Rango de Vigencia</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Cargando tarifas...
                  </td>
                </tr>
              ) : tarifas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No hay tarifas configuradas
                  </td>
                </tr>
              ) : (
                tarifas.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <span className="font-semibold capitalize text-slate-900">
                        {t.tipo_vehiculo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-base font-bold text-slate-900">
                      {formatMoneySign(t.tarifa_hora)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>Desde {formatFecha(t.fecha_desde)}</span>
                        <span>hasta</span>
                        <span>{t.fecha_hasta ? formatFecha(t.fecha_hasta) : "Vigencia abierta"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.es_vigente ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 size={12} />
                          Vigente Hoy
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          Histórica / Futura
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canWrite && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Editar vigencia"
                            onClick={() => handleOpenEdit(t)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            title="Baja lógica"
                            onClick={() => handleDelete(t.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Tarifa */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editingTarifa ? "Editar Tarifa" : "Nueva Tarifa"}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              No puede haber dos tarifas solapadas en fecha para el mismo tipo de vehículo
            </p>

            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tipo de Vehículo *
                </label>
                <select
                  disabled={!!editingTarifa}
                  value={formData.tipo_vehiculo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipo_vehiculo: e.target.value as TipoVehiculo,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden disabled:bg-slate-100"
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
                  Tarifa por Hora ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.tarifa_hora}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tarifa_hora: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 w-full font-mono text-base font-bold rounded-lg border border-slate-300 p-2 focus:border-teal-600 focus:outline-hidden"
                  placeholder="1500.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Fecha Desde *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_desde}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fecha_desde: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-teal-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Fecha Hasta (Opcional)
                  </label>
                  <input
                    type="date"
                    value={formData.fecha_hasta}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fecha_hasta: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-teal-600 focus:outline-hidden"
                  />
                  <span className="text-3xs text-slate-400">Dejar vacío si es abierta</span>
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
