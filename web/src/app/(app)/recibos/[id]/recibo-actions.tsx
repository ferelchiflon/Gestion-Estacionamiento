"use client";

import { useState } from "react";
import { Download, Mail, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface ReciboActionsProps {
  reciboId: number;
  clienteEmail: string | null;
}

export default function ReciboActions({ reciboId, clienteEmail }: ReciboActionsProps) {
  const [emailEnviando, setEmailEnviando] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState(clienteEmail || "");
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const descargarPdf = async () => {
    try {
      const response = await fetch(`/api/recibos/${reciboId}/pdf`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error generando PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recibo-${String(reciboId).padStart(6, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error descargando PDF:", error);
      alert(error instanceof Error ? error.message : "Error descargando PDF");
    }
  };

  const enviarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setEmailError("El email es obligatorio");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setEmailError("Email inválido");
      return;
    }

    setEmailEnviando(true);
    setEmailError(null);

    try {
      const response = await fetch(`/api/recibos/${reciboId}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error enviando email");
      }

      setEmailEnviado(true);
      setShowEmailDialog(false);
      setTimeout(() => setEmailEnviado(false), 3000);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Error enviando email");
    } finally {
      setEmailEnviando(false);
    }
  };

  const handleOpenEmailDialog = () => {
    setShowEmailDialog(true);
    setEmailError(null);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={descargarPdf}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
        title="Descargar PDF"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Descargar PDF</span>
      </button>

      <button
        type="button"
        onClick={handleOpenEmailDialog}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
        title="Enviar por email"
      >
        <Mail size={14} />
        <span className="hidden sm:inline">Enviar email</span>
      </button>

      {showEmailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Enviar recibo por email</h3>
              <button
                type="button"
                onClick={() => setShowEmailDialog(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={enviarEmail}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Email destinatario
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    placeholder="cliente@ejemplo.com"
                    disabled={emailEnviando}
                    autoFocus
                  />
                  {emailError && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle size={14} /> {emailError}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailDialog(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                    disabled={emailEnviando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={emailEnviando}
                  >
                    {emailEnviando && <Loader2 size={14} className="animate-spin" />}
                    {emailEnviando ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            </form>

            {emailEnviado && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800">
                <CheckCircle2 size={20} />
                <span>¡Recibo enviado correctamente!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}