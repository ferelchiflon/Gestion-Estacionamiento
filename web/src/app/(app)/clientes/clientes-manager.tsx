"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  Car,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import { formatMoneySign } from "@/lib/format";
import type { Rol } from "@/lib/permissions";

type Cliente = {
  id: number;
  nombre: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  saldo_actual: string | number;
  estado: "activo" | "inactivo";
  deuda_total: string | number;
  cantidad_vehiculos: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function ClientesManager({ userRole }: { userRole: Rol }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    documento: "",
    email: "",
    telefono: "",
    saldo_actual: 0,
    estado: "activo" as "activo" | "inactivo",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canWrite = userRole === "admin" || userRole === "operador";

  const fetchClientes = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        estado: estadoFilter,
      });
      if (search.trim()) {
        params.set("q", search.trim());
      }

      const res = await fetch(`/api/clientes?${params.toString()}`);
      if (!res.ok) {
        throw new Error("No se pudo cargar el listado de clientes");
      }
      const json = await res.json();
      setClientes(json.data);
      setPagination(json.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [search, estadoFilter]);

  useEffect(() => {
    fetchClientes(1);
  }, [fetchClientes]);

  function handleOpenCreate() {
    setEditingCliente(null);
    setFormData({
      nombre: "",
      documento: "",
      email: "",
      telefono: "",
      saldo_actual: 0,
      estado: "activo",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function handleOpenEdit(cliente: Cliente) {
    setEditingCliente(cliente);
    setFormData({
      nombre: cliente.nombre,
      documento: cliente.documento || "",
      email: cliente.email || "",
      telefono: cliente.telefono || "",
      saldo_actual: Number(cliente.saldo_actual) || 0,
      estado: cliente.estado,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      try {
        const url = editingCliente
          ? `/api/clientes/${editingCliente.id}`
          : "/api/clientes";
        const method = editingCliente ? "PUT" : "POST";

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
        fetchClientes(pagination.page);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  async function handleDelete(id: number, nombre: string) {
    if (!confirm(`¿Dar de baja lógica al cliente "${nombre}"?`)) return;

    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "No se pudo eliminar el cliente");
        return;
      }

      fetchClientes(pagination.page);
    } catch {
      alert("Error de conexión al eliminar cliente");
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
              placeholder="Buscar por nombre, documento, email o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-teal-600 focus:outline-hidden"
            />
          </div>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-hidden"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Solo Activos</option>
            <option value="inactivo">Solo Inactivos</option>
          </select>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-teal-800"
          >
            <Plus size={16} />
            Nuevo Cliente
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tabla Mobile-friendly */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="hidden px-4 py-3 md:table-cell">Contacto</th>
                <th className="px-4 py-3">Vehículos</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Deuda Pendiente</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Cargando clientes...
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                clientes.map((c) => {
                  const deuda = Number(c.deuda_total);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <Link
                          href={`/clientes/${c.id}`}
                          className="font-medium text-slate-900 hover:text-teal-700 hover:underline"
                        >
                          {c.nombre}
                        </Link>
                        {c.documento && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 sm:hidden">
                            <FileText size={12} />
                            {c.documento}
                          </div>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-xs md:table-cell">
                        {c.telefono && (
                          <div className="flex items-center gap-1 text-slate-600">
                            <Phone size={12} />
                            {c.telefono}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-slate-400">
                            <Mail size={12} />
                            {c.email}
                          </div>
                        )}
                        {!c.telefono && !c.email && <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          <Car size={13} />
                          {c.cantidad_vehiculos}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium text-slate-800">
                        {formatMoneySign(c.saldo_actual)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deuda > 0 ? (
                          <span className="inline-block rounded-md bg-red-50 px-2 py-0.5 font-mono text-xs font-semibold text-red-700">
                            {formatMoneySign(deuda)}
                          </span>
                        ) : (
                          <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Al día
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.estado === "activo"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/clientes/${c.id}`}
                            title="Ver detalle"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye size={16} />
                          </Link>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                title="Editar"
                                onClick={() => handleOpenEdit(c)}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                title="Baja lógica"
                                onClick={() => handleDelete(c.id, c.nombre)}
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
              Total: <strong>{pagination.total}</strong> clientes (Pág. {pagination.page} de {pagination.totalPages})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => fetchClientes(pagination.page - 1)}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchClientes(pagination.page + 1)}
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
              {editingCliente ? "Editar Cliente" : "Nuevo Cliente"}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Los campos con asterisco (*) son obligatorios
            </p>

            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Documento / DNI / CUIT
                  </label>
                  <input
                    type="text"
                    value={formData.documento}
                    onChange={(e) =>
                      setFormData({ ...formData, documento: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Saldo Prepagado ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.saldo_actual}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        saldo_actual: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                  />
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
                        estado: e.target.value as "activo" | "inactivo",
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
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
