"use client";

import dynamic from 'next/dynamic';

const ClientApp = dynamic(() => import('@/components/ClientApp'), { ssr: false });

export default function Home() {
  return (
    <main className="w-full h-screen relative bg-black">
      <ClientApp />
    </main>
  );
}
