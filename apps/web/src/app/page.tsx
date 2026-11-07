
"use client";

import { trpc } from "@/utils/trpc";

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery();

  if (isLoading) {
    return <p>Connecting to FormFlow API...</p>;
  }

  if (error) {
    return <p>API Error: {error.message}</p>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Welcome to FormFlow!</h1>
        <p className="mt-4 text-lg">
          {data?.message}
        </p>
      </div>
    </main>
  );
}
