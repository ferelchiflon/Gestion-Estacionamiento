import { Suspense } from "react";
import CambiarClaveForm from "./cambiar-clave-form";

export const dynamic = "force-dynamic";

export default async function CambiarClavePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Suspense fallback={<div className="w-full max-w-md" />}>
        <CambiarClaveForm email={email} />
      </Suspense>
    </main>
  );
}