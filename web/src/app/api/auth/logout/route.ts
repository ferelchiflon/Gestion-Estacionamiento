import { NextResponse } from "next/server";
import { auditar } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { withTransaction } from "@/lib/db";
import {
  assertSameOrigin,
  clientIp,
  errorResponse,
} from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const usuario = await getCurrentUser();
    if (usuario) {
      const ip = clientIp(request);
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE usuarios
              SET token_version = token_version + 1,
                  actualizado_en = now()
            WHERE id = $1`,
          [usuario.id],
        );
        await auditar(client, {
          usuarioId: usuario.id,
          accion: "UPDATE",
          tabla: "usuarios",
          registroId: usuario.id,
          antes: { sesion_activa: true },
          despues: { sesion_cerrada: true },
          ip,
        });
      });
    }

    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(SESSION_COOKIE, "", {
      ...sessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
