import { requirePageUser } from "@/lib/auth/guards";
import VehiculosManager from "./vehiculos-manager";

export const dynamic = "force-dynamic";

export default async function VehiculosPage() {
  const user = await requirePageUser(
    ["admin", "operador", "contador"],
    "clientes.read"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Vehículos
          </h1>
          <p className="text-sm text-slate-500">
            Catálogo de vehículos registrados, asignación de clientes y tipos
          </p>
        </div>
      </div>

      <VehiculosManager userRole={user.rol} />
    </div>
  );
}
