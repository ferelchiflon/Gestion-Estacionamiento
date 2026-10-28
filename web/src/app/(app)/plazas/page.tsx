import { requirePageUser } from "@/lib/auth/guards";
import PlazasManager from "./plazas-manager";

export const dynamic = "force-dynamic";

export default async function PlazasPage() {
  const user = await requirePageUser(
    ["admin", "operador", "contador"],
    "plazas.read"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Plazas de Estacionamiento
          </h1>
          <p className="text-sm text-slate-500">
            Gestión de cocheras, estado en tiempo real (libres, ocupadas, mantenimiento) y sectores
          </p>
        </div>
      </div>

      <PlazasManager userRole={user.rol} />
    </div>
  );
}
