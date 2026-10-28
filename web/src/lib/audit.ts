import type { PoolClient } from "pg";

export type AuditInput = {
  usuarioId: number | null;
  accion: "INSERT" | "UPDATE" | "DELETE";
  tabla: string;
  registroId: number | bigint;
  antes?: Record<string, unknown> | null;
  despues?: Record<string, unknown> | null;
  ip?: string | null;
};

export async function auditar(
  client: PoolClient,
  input: AuditInput,
): Promise<void> {
  await client.query(
    `INSERT INTO auditoria_cambios
       (usuario_id, accion, tabla, registro_id, antes, despues, ip)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::inet)`,
    [
      input.usuarioId,
      input.accion,
      input.tabla,
      input.registroId,
      input.antes ? JSON.stringify(input.antes) : null,
      input.despues ? JSON.stringify(input.despues) : null,
      input.ip ?? null,
    ],
  );
}
