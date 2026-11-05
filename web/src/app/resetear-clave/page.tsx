import { Suspense } from "react";
import ResetearClaveForm from "./resetear-clave-form";

export const dynamic = "force-dynamic";

export default async function ResetearClavePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const email = params.email ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Suspense fallback={<div className="w-full max-w-md" />}>
        <ResetearClaveForm token={token} email={email} />
      </Suspense>
    </main>
  );
}