"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  User,
  Building2,
  DollarSign,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Cliente {
  id: number;
  nombre: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
}

interface Plaza {
  id: number;
  numero: string;
  sector: string;
  tipo_vehiculo: string;
  estado: string;
}

interface TipoAlquiler {
  id: number;
  nombre: string;
}

export default function NuevoContratoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlazaId = searchParams.get("plaza_id");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [tiposAlquiler, setTiposAlquiler] = useState<TipoAlquiler[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    plaza_id: preselectedPlazaId || "",
    cliente_id: "",
    tipo_alquiler_id: "",
    monto_total: "",
    dia_vencimiento: "",
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [clientesRes, plazasRes, tiposRes] = await Promise.all([
          fetch("/api/clientes?q=&limit=100"),
          fetch("/api/plazas?estado=libre"),
          fetch("/api/tipos-alquiler"),
        ]);

        const [clientesData, plazasData, tiposData] = await Promise.all([
          clientesRes.json(),
          plazasRes.json(),
          tiposRes.json(),
        ]);

        setClientes(clientesData.data || []);
        setPlazas(plazasData.data || []);
        setTiposAlquiler(tiposData.data || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Error cargando datos iniciales");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleCancel = () => {
    router.push("/alquileres/contratos");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!formData.plaza_id || !formData.cliente_id || !formData.tipo_alquiler_id || !formData.monto_total) {
      setError("Todos los campos son obligatorios");
      setSubmitting(false);
      return;
    }

    const montoTexto = formData.monto_total.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(montoTexto) || parseFloat(montoTexto) <= 0) {
      setError("El monto debe ser un número mayor a 0 (máximo 2 decimales)");
      setSubmitting(false);
      return;
    }

    const esMensualOAnual = formData.tipo_alquiler_id === "2" || formData.tipo_alquiler_id === "3";
    const diaVencimiento =
      formData.dia_vencimiento === "" ? null : parseInt(formData.dia_vencimiento, 10);

    if (
      esMensualOAnual &&
      (diaVencimiento === null || Number.isNaN(diaVencimiento) || diaVencimiento < 1 || diaVencimiento > 28)
    ) {
      setError("El día de vencimiento es obligatorio (1-28) para contratos mensuales y anuales");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/alquileres/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plaza_id: Number(formData.plaza_id),
          cliente_id: Number(formData.cliente_id),
          tipo_alquiler_id: Number(formData.tipo_alquiler_id),
          monto_total: montoTexto,
          dia_vencimiento: diaVencimiento,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error creando el contrato");
      }

      router.push("/alquileres/contratos");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando el contrato");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-4 text-slate-500">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nuevo Contrato de Alquiler</h1>
          <p className="text-sm text-slate-500">Complete los datos para crear un nuevo contrato</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <User className="text-emerald-600" size={20} />
            Datos del Contrato
          </h2>

          <div>
            <label htmlFor="plaza_id" className="block text-sm font-medium text-slate-700 mb-1">
              <Building2 className="inline mr-1 text-slate-400" size={14} />
              Plaza <span className="text-red-500">*</span>
            </label>
            <select
              id="plaza_id"
              name="plaza_id"
              value={formData.plaza_id}
              onChange={handleChange}
              required
              disabled={!!preselectedPlazaId}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50"
            >
              <option value="">Seleccionar plaza</option>
              {plazas.map((plaza) => (
                <option key={plaza.id} value={plaza.id}>
                  N° {plaza.numero} - Sector {plaza.sector} ({plaza.tipo_vehiculo})
                </option>
              ))}
            </select>
            {preselectedPlazaId && (
              <p className="mt-1 text-xs text-slate-500">
                Plaza preseleccionada desde disponibilidad.{" "}
                <a href="/alquileres/contratos/nuevo" className="text-emerald-600 hover:underline">
                  Cambiar
                </a>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="cliente_id" className="block text-sm font-medium text-slate-700 mb-1">
              <User className="inline mr-1 text-slate-400" size={14} />
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              id="cliente_id"
              name="cliente_id"
              value={formData.cliente_id}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">Seleccionar cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre} {cliente.documento ? `(${cliente.documento})` : ""}
                </option>
              ))}
            </select>
          </div>


          <div>
            <label htmlFor="tipo_alquiler_id" className="block text-sm font-medium text-slate-700 mb-1">
              Tipo de alquiler <span className="text-red-500">*</span>
            </label>
            <select
              id="tipo_alquiler_id"
              name="tipo_alquiler_id"
              value={formData.tipo_alquiler_id}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">Seleccionar tipo</option>
              {tiposAlquiler.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="monto_total" className="block text-sm font-medium text-slate-700 mb-1">
              <DollarSign className="inline mr-1 text-slate-400" size={14} />
              Monto total <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                id="monto_total"
                name="monto_total"
                value={formData.monto_total}
                onChange={handleChange}
                required
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="w-full pl-7 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="dia_vencimiento" className="block text-sm font-medium text-slate-700 mb-1">
              <Calendar className="inline mr-1 text-slate-400" size={14} />
              Día de vencimiento (mensual/anual)
            </label>
            <input
              type="number"
              id="dia_vencimiento"
              name="dia_vencimiento"
              value={formData.dia_vencimiento}
              onChange={handleChange}
              min="1"
              max="28"
              placeholder="1-28"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">Obligatorio para contratos mensuales y anuales (1-28)</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Creando..." : "Crear contrato"}
          </button>
        </div>
      </form>
    </div>
  );
}

