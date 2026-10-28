import Link from "next/link";
import { CarFront, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import LogoutButton from "@/components/logout-button";
import { requirePageUser } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <CarFront className="text-teal-700" />
            Gestión Estacionamiento
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
            {can(user.rol, "usuarios.manage") ? (
              <Link
                href="/usuarios"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Users size={16} />
                Usuarios
              </Link>
            ) : null}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-right text-sm sm:block">
              <span className="block font-semibold">{user.nombre}</span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <ShieldCheck size={14} />
                {user.rol}
              </span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
