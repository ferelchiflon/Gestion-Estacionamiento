import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Gestión Estacionamiento
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Acceso restringido según rol. La sesión expira a las 8 horas.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
