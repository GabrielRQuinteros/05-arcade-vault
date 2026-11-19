import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { auth } from "@/lib/auth/auth";

// Con cacheComponents, leer headers() exige un <Suspense>.
export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfSignedIn>
        <AuthForm />
      </RedirectIfSignedIn>
    </Suspense>
  );
}

async function RedirectIfSignedIn({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
  return children;
}
