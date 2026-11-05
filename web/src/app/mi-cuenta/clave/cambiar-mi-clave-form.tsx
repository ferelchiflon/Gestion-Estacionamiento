"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";

export default function CambiarMiClaveForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validateNewPassword(password: string): string | null {
    if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres";
    if (!/[A-Za-z]/.test(password)) return "La contraseña debe tener letras";
    if (!/[0-9]/.test(password)) return "La contraseña debe tener números";
    const common = [
      "123456", "password", "123456789", "12345678", "12345", "1234567", "1234567890",
      "qwerty", "abc123", "password1", "admin", "letmein", "welcome", "monkey",
    ];
    if (common.includes(password.toLowerCase())) return "La contraseña es demasiado común, elija otra";
    return null;
  }
async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const validationError = validateNewPassword(newPassword);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "No se pudo cambiar la contraseña");
        return;
      }

      setMessage("Contraseña cambiada correctamente. Redirigiendo...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-teal-700 mb-2">
          <User size={20} />
          <p className="text-sm font-semibold uppercase tracking-wide">Gestión Estacionamiento</p>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Cambiar mi contraseña</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ingresá tu contraseña actual y definí una nueva.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700">
            Contraseña actual
          </label>
          <div className="relative mt-1">
            <input
              id="currentPassword"
              name="currentPassword"
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((value) => !value)}
              aria-label={showCurrent ? "Ocultar clave" : "Mostrar clave"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-700"
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
            Nueva contraseña (mín. 12 caracteres, letras y números)
          </label>
          <div className="relative mt-1">
            <input
              id="newPassword"
              name="newPassword"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowNew((value) => !value)}
              aria-label={showNew ? "Ocultar clave" : "Mostrar clave"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-700"
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
            Confirmar nueva contraseña
          </label>
          <div className="relative mt-1">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((value) => !value)}
              aria-label={showConfirm ? "Ocultar clave" : "Mostrar clave"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-700"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {message ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
          Cambiar contraseña
        </button>
      </form>
    </section>
  );
}