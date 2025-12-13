"use client";

import dynamic from 'next/dynamic';

const ClientApp = dynamic(
  () => import('@/components/ClientApp').then((mod) => ({ default: mod.default })),
  { ssr: false }
);

export default function Home() {
  return <ClientApp />;
}