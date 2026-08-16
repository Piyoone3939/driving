"use client";

import { ReactNode, useEffect, useState } from "react";
import { useDrivingStore } from "@/lib/store";
import { shouldRequireLandscape } from "@/lib/onboardingRecovery";

const COPY = {
  ja: { title: "横向きでご利用ください", body: "スマートフォンまたはタブレットを横向きにして続けてください。", hint: "↻ 端末を回転" },
  en: { title: "Please rotate your device", body: "Turn your phone or tablet to landscape to continue.", hint: "↻ Rotate device" },
} as const;

export function OrientationGate({ children }: { children: ReactNode }) {
  const language = useDrivingStore((state) => state.language);
  // Keep server render and first client render identical. Viewport detection
  // happens only after hydration, before the training UI is revealed.
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setBlocked(shouldRequireLandscape(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (blocked === null) {
    return <div className="fixed inset-0 z-[5000] bg-slate-950" aria-busy="true" />;
  }

  if (!blocked) return <>{children}</>;

  const copy = COPY[language];
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-4 text-6xl" aria-hidden="true">↻</div>
        <h1 className="mb-3 text-2xl font-bold text-cyan-300">{copy.title}</h1>
        <p className="text-base leading-relaxed text-slate-300">{copy.body}</p>
        <p className="mt-6 font-semibold text-cyan-200">{copy.hint}</p>
      </div>
    </div>
  );
}
