import { z } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new ApiError(403, "ORIGIN_REQUERIDO", "Origin ausente");
  }

  const hostHeader =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host");
  const protoHeader =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    new URL(origin).protocol.replace(":", "");

  if (!hostHeader) {
    throw new ApiError(403, "ORIGIN_INVALIDO", "Origin no coincide");
  }

  const originUrl = new URL(origin);
  const sameHost = originUrl.host === hostHeader;
  const sameProtocol = originUrl.protocol === `${protoHeader}:`;

  if (!sameHost || !sameProtocol) {
    throw new ApiError(403, "ORIGIN_INVALIDO", "Origin no coincide");
  }
}

export function validationErrorResponse(error: z.ZodError) {
  return Response.json(
    {
      error: "Datos inválidos",
      code: "VALIDATION_ERROR",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return validationErrorResponse(error);
  }

  if (error instanceof ApiError) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.status },
    );
  }

  // El detalle técnico queda en logs del servidor, nunca en la respuesta.
  console.error("[api] error inesperado:", error);
  return Response.json(
    { error: "Error interno", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}
