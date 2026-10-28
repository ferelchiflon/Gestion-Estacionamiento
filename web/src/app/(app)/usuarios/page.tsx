import { requirePageUser } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import UsersManager, { type ManagedUser } from "./users-manager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const current = await requirePageUser(["admin"], "usuarios.manage");

  const rows = await query<ManagedUser>(
    `SELECT id, nombre, email, rol, activo, creado_en, actualizado_en
       FROM usuarios
      WHERE eliminado_en IS NULL
      ORDER BY nombre, id`,
  );

  return <UsersManager initialUsers={rows} currentUserId={current.id} />;
}
