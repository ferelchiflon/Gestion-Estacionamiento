"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Eye,
  Loader2,
  Receipt,
  User,
  Wallet,
  X,
} from "lucide-react";
import { formatMoneySign, formatFecha } from "@/lib/format";
import ReciboActions from "@/app/(app)/recibos/[id]/recibo-actions";

interface PagoPendiente {
  contrato_id: number;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  plaza_numero: string;
  plaza_sector: string;
  cuota_mensual: string;
  dia_vencimiento: number;
  periodo: string;
  dias_retraso: number;
}

interface PagoHistorial {
  id: number;
  contrato_id: number;
  periodo: string;
  monto: string;
  fecha_pago: string;
  recibo_id: number | null;
  estado: string;
  plaza_numero: string;
  plaza_sector: string;
  cliente_nombre: string;
  forma_pago: string | null;
  recibo_numero: number | null;
  recibo_enviado_email: boolean | null;
}

interface ResultadoPago {
  pago: {
    id: number;
    contrato_id: number;
    periodo: string;
    monto: string;
    fecha_pago: string;
    recibo_id: number | null;
    estado: string;
  };
  recibo: {
    id: number;
    numero: number;
    contrato_id: number | null;
    cliente_id: number | null;
    monto: string;
    forma_pago: string | null;
    fecha_emision: string;
    enviado_email: boolean;
  };
}

const FORMAS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "saldo_prepago", label: "Saldo prepago" },
] as const;

type FormaPago = (typeof FORMAS_PAGO)[number]["value"];

function formaPagoLabel(forma: string | null): string {
  return FORMAS_PAGO.find((f) => f.value === forma)?.label ?? forma ?? "—";
}

export default function PagosAlquilerPage() {
  const [pendientes, setPendientes] = useState<PagoPendiente[]>([]);
  const [historial, setHistorial] = useState<PagoHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seleccionado, setSeleccionado] = useState<PagoPendiente | null>(null);
  const [formData, setFormData] = useState({
    periodo: "",
    monto: "",
    forma_pago: "efectivo" as FormaPago,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoPago | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/alquileres/pagos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error cargando pagos");
      setPendientes(json.data || []);
      setHistorial(json.historial || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching pagos:", err);
      setError(err instanceof Error ? err.message : "Error cargando pagos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const abrirModal = (pendiente: PagoPendiente) => {
    setSeleccionado(pendiente);
    setFormData({
      periodo: pendiente.periodo,
      monto: pendiente.cuota_mensual,
      forma_pago: "efectivo",
    });
    setFormError(null);
    setResultado(null);
  };

  const cerrarModal = () => {
    setSeleccionado(null);
    setResultado(null);
    setFormError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seleccionado) return;
    setSubmitting(true);
    setFormError(null);

    const periodo = formData.periodo.trim();
    const monto = formData.monto.trim();

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      setFormError("El período debe tener formato YYYY-MM (ej: 2026-10)");
      setSubmitting(false);
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(monto) || parseFloat(monto) <= 0) {
      setFormError("El monto debe ser un número mayor a 0 (máximo 2 decimales)");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/alquileres/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contrato_id: seleccionado.contrato_id,
          periodo,
          monto,
          forma_pago: formData.forma_pago,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error registrando el pago");
      }

      setResultado(data);
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error registrando el pago");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPendiente = pendientes.reduce(
    (acc, p) => acc + (parseFloat(p.cuota_mensual) || 0),
    0
  );
  const conRetraso = pendientes.filter((p) => p.dias_retraso > 0).length;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-4 text-slate-500">Cargando pagos...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pagos de Alquiler</h1>
          <p className="text-sm text-slate-500">
            Cuotas pendientes de contratos mensuales y anuales, y historial de pagos registrados
          </p>
        </div>
        <Link
          href="/alquileres/contratos"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
        >
          <Receipt size={16} />
          Ver contratos
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Receipt className="text-slate-500" size={20} />
            <span className="text-sm font-medium text-slate-700">Pagos pendientes</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">{pendientes.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={20} />
            <span className="text-sm font-medium text-slate-700">Total pendiente</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{formatMoneySign(totalPendiente)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={20} />
            <span className="text-sm font-medium text-slate-700">Con retraso</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">{conRetraso}</p>
        </div>
      </div>

      {/* Pagos pendientes */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Pagos pendientes del período actual</h2>
        </div>
        {pendientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="text-emerald-400" size={48} />
            <p className="mt-4 text-slate-500">No hay pagos pendientes para el período actual</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Plaza</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3 text-right">Cuota</th>
                  <th className="px-4 py-3 text-center">Vencimiento</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>

                {pendientes.map((p) => (
                  <tr key={p.contrato_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                        <User className="text-slate-400" size={14} />
                        {p.cliente_nombre}
                      </div>
                      {p.cliente_email && (
                        <p className="mt-0.5 pl-6 text-xs text-slate-500">{p.cliente_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">
                      N° {p.plaza_numero} ({p.plaza_sector})
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">{p.periodo}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono font-semibold text-slate-900">
                      {formatMoneySign(p.cuota_mensual)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-slate-700">
                      día {p.dia_vencimiento}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.dias_retraso > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          {p.dias_retraso} días de retraso
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Al día
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => abrirModal(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                      >
                        <Wallet size={14} />
                        Registrar pago
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Historial de pagos */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Historial de pagos registrados</h2>
        </div>
        {historial.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="text-slate-300" size={40} />
            <p className="mt-3 text-sm text-slate-500">Todavía no hay pagos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Plaza</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3">Fecha de pago</th>
                  <th className="px-4 py-3">Forma de pago</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Recibo</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((pago) => (
                  <tr key={pago.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">{pago.periodo}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{pago.cliente_nombre}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">
                      N° {pago.plaza_numero} ({pago.plaza_sector})
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono font-semibold text-slate-900">
                      {formatMoneySign(pago.monto)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">
                      {formatFecha(pago.fecha_pago)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {formaPagoLabel(pago.forma_pago)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pago.estado === "pagado" ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          {pago.estado}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pago.recibo_id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/recibos/${pago.recibo_id}`}
                            className="inline-flex items-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title={`Ver recibo N° ${String(pago.recibo_numero ?? pago.recibo_id).padStart(6, "0")}`}
                          >
                            <Eye size={16} />
                          </Link>
                          <ReciboActions
                            reciboId={pago.recibo_id}
                            clienteEmail={null}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Modal registrar pago */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Registrar pago</h3>
              <button
                type="button"
                onClick={cerrarModal}
                className="text-slate-400 hover:text-slate-600"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {!resultado ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
                  <p className="font-medium text-slate-900 flex items-center gap-1.5">
                    <User size={14} className="text-slate-400" /> {seleccionado.cliente_nombre}
                  </p>
                  <p className="text-slate-600 font-mono text-xs">
                    Plaza N° {seleccionado.plaza_numero} (Sector {seleccionado.plaza_sector})
                  </p>
                  <p className="text-slate-600 text-xs">
                    Vence el día {seleccionado.dia_vencimiento} de cada mes
                  </p>
                </div>

                <div>
                  <label htmlFor="periodo" className="block text-sm font-medium text-slate-700 mb-1">
                    <Calendar className="inline mr-1 text-slate-400" size={14} />
                    Período <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="periodo"
                    name="periodo"
                    value={formData.periodo}
                    onChange={handleChange}
                    required
                    placeholder="YYYY-MM"
                    pattern="\d{4}-(0[1-9]|1[0-2])"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="monto" className="block text-sm font-medium text-slate-700 mb-1">
                    <DollarSign className="inline mr-1 text-slate-400" size={14} />
                    Monto <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      id="monto"
                      name="monto"
                      value={formData.monto}
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
                  <label htmlFor="forma_pago" className="block text-sm font-medium text-slate-700 mb-1">
                    <CreditCard className="inline mr-1 text-slate-400" size={14} />
                    Forma de pago <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="forma_pago"
                    name="forma_pago"
                    value={formData.forma_pago}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {FORMAS_PAGO.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formError && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle size={14} /> {formError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? "Registrando..." : "Registrar pago"}
                  </button>
                </div>
              </form>
            ) : (

              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 size={20} />
                  <span className="text-sm font-semibold">¡Pago registrado correctamente!</span>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
                  <p className="font-medium text-slate-900">
                    Recibo N° {String(resultado.recibo.numero).padStart(6, "0")}
                  </p>
                  <p className="text-slate-600">
                    Período {resultado.pago.periodo} — {formatMoneySign(resultado.pago.monto)} (
                    {formaPagoLabel(resultado.recibo.forma_pago)})
                  </p>
                  <p className="text-slate-600 text-xs">
                    Cliente: {seleccionado.cliente_nombre} · Plaza N° {seleccionado.plaza_numero}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/recibos/${resultado.recibo.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    <Eye size={14} />
                    Ver recibo
                  </Link>
                  <ReciboActions
                    reciboId={resultado.recibo.id}
                    clienteEmail={seleccionado.cliente_email}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-emerald-600 hover:bg-emerald-700"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

