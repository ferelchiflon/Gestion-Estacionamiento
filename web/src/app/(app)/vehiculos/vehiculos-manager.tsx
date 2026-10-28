"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { normalizarPatente, formatMoneySign, formatFecha } from "@/lib/format";
import type { Rol } from "@/lib/permissions";
import { TIPOS_VEHICULO, type TipoVehiculo } from "@/lib/validations/modulo2";

type Vehiculo = {
  id: number;
  patente: string;
  tipo: TipoVehiculo;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  cliente_id: number | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_deuda_total: string | number;
  created_at: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ClienteOption = {
  id: number;
  nombre: string;
  documento: string | null;
};

export default function VehiculosManager({ userRole }: { userRole: Rol }) {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clientes para autocompletar en modal
  const [clientesList, setClientesList] = useState<ClienteOption[]>([]);

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehiculo, setEditingVehiculo] = useState<Vehiculo | null>(null);
  const [formData, setFormData] = useState({
    patente: "",
    tipo: "auto" as TipoVehiculo,
    marca: "",
    modelo: "",
    color: "",
    cliente_id: "" as string | number,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canWrite = userRole === "admin" || userRole === "operador";

  const fetchVehiculos = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        tipo: tipoFilter,
      });
      if (search.trim()) {
        params.set("q", search.trim());
      }

      const res = await fetch(`/api/vehiculos?${params.toString()}`);
      if (!res.ok) {
        throw new Error("No se pudo cargar el listado de vehículos");
      }
      const json = await res.json();
      setVehiculos(json.data);
      setPagination(json.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [search, tipoFilter]);

  useEffect(() => {
    fetchVehiculos(1);
  }, [fetchVehiculos]);

  // Cargar clientes para el select de asignación
  useEffect(() => {
    if (modalOpen && clientesList.length === 0) {
      fetch("/api/clientes?limit=100")
        .then((res) => res.json())
        .then((json) => {
          if (json.data) {
            setClientesList(json.data);
          }
        })
        .catch(() => {});
    }
  }, [modalOpen, clientesList.length]);

  function handleOpenCreate() {
    setEditingVehiculo(null);
    setFormData({
      patente: "",
      tipo: "auto",
      marca: "",
      modelo: "",
      color: "",
      cliente_id: "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function handleOpenEdit(vehiculo: Vehiculo) {
    setEditingVehiculo(vehiculo);
    setFormData({
      patente: vehiculo.patente,
      tipo: vehiculo.tipo,
      marca: vehiculo.marca || "",
      modelo: vehiculo.modelo || "",
      color: vehiculo.color || "",
      cliente_id: vehiculo.cliente_id || "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = {
      ...formData,
      patente: normalizarPatente(formData.patente),
      cliente_id: formData.cliente_id ? Number(formData.cliente_id) : null,
    };

    startTransition(async () => {
      try {
        const url = editingVehiculo
          ? `/api/vehiculos/${editingVehiculo.id}`
          : "/api/vehiculos";
        const method = editingVehiculo ? "PUT" : "POST";

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
          throw new Error(json.error || "Error al guardar vehículo");
        }

        setModalOpen(false);
        fetchVehiculos(pagination.page);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  async function handleDelete(id: number, patente: string) {
    if (!confirm(`¿Dar de baja lógica al vehículo "${patente}"?`)) return;

    try {
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "No se pudo eliminar el vehículo");
        return;
      }

      fetchVehiculos(pagination.page);
    } catch {
      alert("Error de conexión al eliminar vehículo");
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de filtros y botón nuevo */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por patente, marca, modelo o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-teal-600 focus:outline-hidden"
            />
          </div>

          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-hidden"
          >
            <option value="todos">Todos los tipos</option>
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
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-teal-800"
          >
            <Plus size={16} />
            Nuevo Vehículo
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Patente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">Cliente Asociado</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Registrado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Cargando vehículos...
                  </td>
                </tr>
              ) : vehiculos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No se encontraron vehículos
                  </td>
                </tr>
              ) : (
                vehiculos.map((v) => {
                  const deuda = Number(v.cliente_deuda_total);
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <span className="font-mono text-base font-bold tracking-wider text-slate-900">
                          {v.patente}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                          {v.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-slate-800">
                          {v.marca || "-"} {v.modelo || ""}
                        </div>
                        {v.color && (
                          <div className="text-slate-400 capitalize">{v.color}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {v.cliente_id ? (
                          <div>
                            <Link
                              href={`/clientes/${v.cliente_id}`}
                              className="flex items-center gap-1 font-medium text-slate-800 hover:text-teal-700 hover:underline"
                            >
                              <User size={13} className="text-slate-400" />
                              {v.cliente_nombre}
                            </Link>
                            {deuda > 0 && (
                              <span className="inline-block text-2xs font-bold text-red-600">
                                Deuda: {formatMoneySign(deuda)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Ocasional / Sin asignar</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-xs text-slate-400 sm:table-cell">
                        {formatFecha(v.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                title="Editar"
                                onClick={() => handleOpenEdit(v)}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                title="Baja lógica"
                                onClick={() => handleDelete(v.id, v.patente)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <span>
              Total: <strong>{pagination.total}</strong> vehículos (Pág. {pagination.page} de {pagination.totalPages})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => fetchVehiculos(pagination.page - 1)}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchVehiculos(pagination.page + 1)}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {editingVehiculo ? "Editar Vehículo" : "Nuevo Vehículo"}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              La patente se normaliza automáticamente sin guiones ni espacios
            </p>

            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Patente / Dominio *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formData.patente}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        patente: e.target.value.toUpperCase(),
                      })
                    }
                    className="mt-1 w-full font-mono text-base font-bold uppercase tracking-wider rounded-lg border border-slate-300 p-2 focus:border-teal-600 focus:outline-hidden"
                    placeholder="AA123CD"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tipo de Vehículo *
                  </label>
                  <select
                    value={formData.tipo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tipo: e.target.value as TipoVehiculo,
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
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) =>
                      setFormData({ ...formData, marca: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                    placeholder="Ej: Ford"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={formData.modelo}
                    onChange={(e) =>
                      setFormData({ ...formData, modelo: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                    placeholder="Ej: Fiesta"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Color
                  </label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                    placeholder="Ej: Gris"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Cliente Asignado (Opcional)
                </label>
                <select
                  value={formData.cliente_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cliente_id: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                >
                  <option value="">Ocasional / Sin asignar</option>
                  {clientesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.documento ? `(Doc: ${c.documento})` : ""}
                    </option>
                  ))}
                </select>
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
