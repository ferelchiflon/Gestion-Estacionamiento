import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { ApiError } from "@/lib/http";
import { can, type Permiso, type Rol } from "@/lib/permissions";

export async function requirePageUser(
  roles?: readonly Rol[],
  permission?: Permiso,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (roles && !roles.includes(user.rol)) redirect("/dashboard");
  if (permission && !can(user.rol, permission)) redirect("/dashboard");

  return user;
}

export async function requireApiUser(
  roles?: readonly Rol[],
  permission?: Permiso,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Sesión requerida");
  }
  if (roles && !roles.includes(user.rol)) {
    throw new ApiError(403, "FORBIDDEN", "No tenés permiso para esta acción");
  }
  if (permission && !can(user.rol, permission)) {
    throw new ApiError(403, "FORBIDDEN", "No tenés permiso para esta acción");
  }
  return user;
}

