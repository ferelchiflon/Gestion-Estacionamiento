"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, AlertTriangle, Mail, MoreHorizontal } from "lucide-react";

interface DeudaActionsProps {
  deudaId: number;
  tipo: "movimiento" | "alquiler";
  estado: string;
  clienteEmail: string | null;
  monto: string;
}

export default function DeudaActions({ deudaId, estado, clienteEmail, monto }: DeudaActionsProps) {
  const [accion, setAccion] = useState<"saldar" | "pago_parcial" | null>(null);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoForma, setPagoForma] = useState<"efectivo" | "tarjeta" | "transferencia" | "saldo_prepago">("efectivo");
  const [pagoObservacion, setPagoObservacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailEnviando, setEmailEnviando] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const handleSaldar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const response = await fetch("/api/deudas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "saldar", deuda_id: deudaId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error marcando como saldada");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error");
    } finally {
      setEnviando(false);
    }
  };

  const handlePagoParcial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagoMonto.trim()) { setError("El monto es obligatorio"); return; }
    if (parseFloat(pagoMonto) > parseFloat(monto)) { setError("El monto excede la deuda"); return; }
    setEnviando(true);
    setError(null);
    try {
      const response = await fetch("/api/deudas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "pago_parcial", deuda_id: deudaId, monto: pagoMonto, forma_pago: pagoForma, observacion: pagoObservacion || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error registrando pago");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error");
    } finally {
      setEnviando(false);
    }
  };

  const handleEnviarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) { setEmailError("El email es obligatorio"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) { setEmailError("Email inválido"); return; }
    setEmailEnviando(true);
    setEmailError(null);
    try {
      const response = await fetch("/api/deudas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "enviar_email", deuda_id: deudaId, email: emailInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error enviando email");
      setEmailEnviado(true);
      setShowEmailDialog(false);
      setTimeout(() => setEmailEnviado(false), 3000);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Error enviando email");
    } finally {
      setEmailEnviando(false);
    }
  };

  if (estado === "pagada") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        <CheckCircle2 size={12} /> Saldada
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setAccion("saldar")}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
        title="Marcar como saldada"
      >
        <CheckCircle2 size={12} /> Saldar
      </button>

      <button
        type="button"
        onClick={() => setAccion("pago_parcial")}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
        title="Registrar pago parcial"
      >
        <CreditCard size={12} /> Pago
      </button>

      {clienteEmail && (
        <button
          type="button"
          onClick={() => { setEmailInput(clienteEmail); setShowEmailDialog(true); }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
          title="Enviar por email"
        >
          <Mail size={12} /> Email
        </button>
      )}

      {accion === "saldar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Marcar deuda como saldada</h3>
            <p className="text-sm text-slate-600 mb-4">¿Confirmar que la deuda de {monto} queda saldada?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAccion(null)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">Cancelar</button>
              <button onClick={handleSaldar} disabled={enviando} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                {enviando && <Loader2 size={14} className="animate-spin" />}
                {enviando ? "Procesando..." : "Confirmar"}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {error}</p>}
          </div>
        </div>
      )}

      {accion === "pago_parcial" && (
        <form onSubmit={handlePagoParcial} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Registrar pago parcial</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto a pagar (máx. {monto})</label>
                <input type="number" step="0.01" min="0.01" max={parseFloat(monto)} value={pagoMonto} onChange={(e) => setPagoMonto(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" placeholder="0.00" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Forma de pago</label>
                <select value={pagoForma} onChange={(e) => setPagoForma(e.target.value as "efectivo" | "tarjeta" | "transferencia" | "saldo_prepago")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="saldo_prepago">Saldo prepago</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observación</label>
                <textarea value={pagoObservacion} onChange={(e) => setPagoObservacion(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" placeholder="Opcional" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setAccion(null)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">Cancelar</button>
              <button type="submit" disabled={enviando} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {enviando && <Loader2 size={14} className="animate-spin" />}
                {enviando ? "Procesando..." : "Registrar"}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {error}</p>}
          </div>
        </form>
      )}

      {showEmailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Enviar deuda por email</h3>
            <form onSubmit={handleEnviarEmail}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email destinatario</label>
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none" placeholder="cliente@ejemplo.com" autoFocus />
                {emailError && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {emailError}</p>}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowEmailDialog(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">Cancelar</button>
                <button type="submit" disabled={emailEnviando} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50">
                  {emailEnviando && <Loader2 size={14} className="animate-spin" />}
                  {emailEnviando ? "Enviando..." : "Enviar"}
                </button>
              </div>
              {emailError && <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {emailError}</p>}
            </form>
            {emailEnviado && <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800"><CheckCircle2 size={20} /> ¡Email enviado correctamente!</div>}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setAccion(null); setShowEmailDialog(false); }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
      >
        <MoreHorizontal size={12} />
      </button>
    </div>
  );
}
