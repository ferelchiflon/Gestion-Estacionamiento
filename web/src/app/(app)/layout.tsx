import Link from "next/link";
import {
  CarFront,
  LayoutDashboard,
  ShieldCheck,
  Users,
  UserCheck,
  Car,
  SquareParking,
  DollarSign,
} from "lucide-react";
import LogoutButton from "@/components/logout-button";
import { requirePageUser } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageUser();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-800">
            <CarFront className="text-teal-700" size={24} />
            <span className="hidden sm:inline">Gestión Estacionamiento</span>
            <span className="sm:hidden">GE</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <LayoutDashboard size={16} />
              <span className="hidden md:inline">Dashboard</span>
            </Link>

            <Link
              href="/clientes"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <UserCheck size={16} />
              <span>Clientes</span>
            </Link>

            <Link
              href="/vehiculos"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Car size={16} />
              <span>Vehículos</span>
            </Link>

            <Link
              href="/plazas"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <SquareParking size={16} />
              <span>Plazas</span>
            </Link>

            <Link
              href="/tarifas"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <DollarSign size={16} />
              <span>Tarifas</span>
            </Link>

            {can(user.rol, "usuarios.manage") ? (
              <Link
                href="/usuarios"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Users size={16} />
                <span className="hidden md:inline">Usuarios</span>
              </Link>
            ) : null}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs sm:block">
              <span className="block font-semibold text-slate-800">{user.nombre}</span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <ShieldCheck size={13} />
                {user.rol}
              </span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
