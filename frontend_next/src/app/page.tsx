"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { isLogged } = useAuth();
  const router = useRouter();

  useEffect(() => {
    router.replace(isLogged ? "/dashboard" : "/login");
  }, [isLogged, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-text-3 text-sm">
      Chargement…
    </div>
  );
}
