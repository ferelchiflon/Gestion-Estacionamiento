export const ROLES = ["admin", "operador", "contador"] as const;

export type Rol = (typeof ROLES)[number];

export const PERMISSIONS = {
  "dashboard.view": ["admin", "operador", "contador"],
  "operaciones.read": ["admin", "operador", "contador"],
  "operaciones.write": ["admin", "operador"],
  "clientes.read": ["admin", "operador", "contador"],
  "clientes.write": ["admin", "operador"],
  "plazas.read": ["admin", "operador", "contador"],
  "plazas.write": ["admin"],
  "tarifas.read": ["admin", "operador", "contador"],
  "tarifas.write": ["admin"],
  "fiscal.read": ["admin", "contador"],
  "fiscal.write": ["admin", "contador"],
  "reportes.read": ["admin", "operador", "contador"],
  "usuarios.manage": ["admin"],
  "auditoria.read": ["admin"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISSIONS;

export function can(rol: Rol, permiso: Permiso): boolean {
  return (PERMISSIONS[permiso] as readonly Rol[]).includes(rol);
}

export function permissionsFor(rol: Rol): Permiso[] {
  return (Object.keys(PERMISSIONS) as Permiso[]).filter((permiso) =>
    can(rol, permiso),
  );
}
