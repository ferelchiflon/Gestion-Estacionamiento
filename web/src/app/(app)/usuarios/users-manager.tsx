"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { ROLES, type Rol } from "@/lib/permissions";

export type ManagedUser = {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creado_en: string | Date;
  actualizado_en: string | Date;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const buttonClass =
  "inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-60";

function fecha(value: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

export default function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: ManagedUser[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("operador");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function request(url: string, method: string, body?: unknown) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "No se pudo completar la operación");
        return null;
      }
      return data;
    } catch {
      setError("No se pudo conectar con el servidor");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await request("/api/usuarios", "POST", {
      nombre,
      email,
      password,
      rol,
    });
    if (!result) return;

    setUsers((current) => [...current, result.usuario]);
    setNombre("");
    setEmail("");
    setPassword("");
    setRol("operador");
    setMessage("Usuario creado");
    router.refresh();
  }

  async function updateUser(id: number, body: Record<string, unknown>) {
    const result = await request(`/api/usuarios/${id}`, "PATCH", body);
    if (!result) return;
    setUsers((current) =>
      current.map((user) => (user.id === id ? result.usuario : user)),
    );
    setMessage("Usuario actualizado");
    router.refresh();
  }

  async function deleteUser(user: ManagedUser) {
    if (!window.confirm(`¿Eliminar lógicamente a ${user.nombre}?`)) return;
    const result = await request(`/api/usuarios/${user.id}`, "DELETE");
    if (!result) return;
    setUsers((current) => current.filter((item) => item.id !== user.id));
    setMessage("Usuario eliminado lógicamente");
    router.refresh();
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios y roles</h1>
        <p className="text-slate-600">
          Administración restringida al rol admin. Las operaciones se auditan.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <form
        onSubmit={createUser}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-5"
      >
        <div>
          <label htmlFor="nombre" className="text-sm font-medium">
            Nombre
          </label>
          <input
            id="nombre"
            required
            minLength={3}
            maxLength={100}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="nuevo-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="nuevo-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="clave" className="text-sm font-medium">
            Clave
          </label>
          <input
            id="clave"
            type="password"
            required
            minLength={10}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="rol" className="text-sm font-medium">
            Rol
          </label>
          <select
            id="rol"
            value={rol}
            onChange={(event) => setRol(event.target.value as Rol)}
            className={inputClass}
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={saving} className={`${buttonClass} w-full`}>
            {saving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <UserPlus size={18} />
            )}
            Crear
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Usuario
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Rol
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Actualizado
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <span className="block font-semibold">{user.nombre}</span>
                  <span className="text-sm text-slate-500">{user.email}</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Rol de ${user.nombre}`}
                    value={user.rol}
                    disabled={saving || user.id === currentUserId}
                    onChange={(event) =>
                      updateUser(user.id, { rol: event.target.value })
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1"
                  >
                    {ROLES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      user.activo
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {user.activo ? "activo" : "inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {fecha(user.actualizado_en)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={saving || user.id === currentUserId}
                      onClick={() =>
                        updateUser(user.id, { activo: !user.activo })
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      {user.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      disabled={saving || user.id === currentUserId}
                      onClick={() => deleteUser(user)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
