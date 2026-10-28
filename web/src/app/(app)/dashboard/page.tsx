import { requirePageUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola, {user.nombre}
        </h1>
        <p className="text-slate-600">
          Sesión verificada con JWT, cookie httpOnly y permisos por rol.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Tu rol</h2>
          <p className="mt-2 text-3xl font-bold capitalize text-teal-700">
            {user.rol}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Estado</h2>
          <p className="mt-2 text-sm text-slate-600">
            Usuario activo y sesión válida contra la base.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Módulo actual</h2>
          <p className="mt-2 text-sm text-slate-600">
            Módulo 1: autenticación, usuarios y roles.
          </p>
        </article>
      </div>
    </section>
  );
}
