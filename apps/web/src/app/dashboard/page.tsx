
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export default function DashboardPage() {
  const router = useRouter();

  const { data: session, isPending } = authClient.useSession();

  const {
    data: profile,
    isLoading,
    error,
  } = trpc.getProfile.useQuery(undefined, {
    enabled: !!session,
  });

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [session, isPending, router]);

 const handleLogout = async () => {
  try {
    await authClient.signOut();
    window.location.assign("/login");
  } catch (error) {
    console.error("Logout failed:", error);
  }
};

  if (isPending || !session) {
    return <p className="p-8">Checking authentication...</p>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">
        Welcome to FormFlow Dashboard!
      </h1>

      <p>Hello, {session.user.name}!</p>
      <p>{session.user.email}</p>

      <div className="mt-4 rounded-xl border p-6">
        <h2 className="mb-3 text-xl font-semibold">
          Backend Authentication Test
        </h2>

        {isLoading && <p>Loading profile...</p>}

        {error && (
          <p className="text-red-600">
            Profile error: {error.message}
          </p>
        )}

        {profile && (
          <>
            <p className="text-green-600">{profile.message}</p>
            <p>Name: {profile.user.name}</p>
            <p>Email: {profile.user.email}</p>
          </>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="rounded-lg bg-black px-6 py-3 text-white"
      >
        Logout
      </button>
    </main>
  );
}
