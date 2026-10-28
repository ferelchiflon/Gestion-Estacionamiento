import { requirePageUser } from "@/lib/auth/guards";
import ClientesManager from "./clientes-manager";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const user = await requirePageUser(
    ["admin", "operador", "contador"],
    "clientes.read"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Clientes
          </h1>
          <p className="text-sm text-slate-500">
            Administración de clientes, saldos prepagos y estado de deudas
          </p>
        </div>
      </div>

      <ClientesManager userRole={user.rol} />
    </div>
  );
}
