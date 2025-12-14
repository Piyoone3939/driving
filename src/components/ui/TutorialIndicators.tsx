"use client";

import { useDrivingStore } from "@/lib/store";

export function SteeringIndicator() {
  const steeringAngle = useDrivingStore((state) => state.steeringAngle);

  return (
    <div className="bg-slate-900/50 p-6 rounded-lg mb-6 border border-slate-700">
      <div className="text-sm text-slate-400 mb-2">ステアリング反応</div>
      <div className="relative w-full h-8 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute top-0 bottom-0 bg-blue-500 transition-all duration-100"
          style={{
            left: "50%",
            width: `${Math.abs(steeringAngle) * 50}%`,
            transform: steeringAngle > 0 ? "translateX(0)" : "translateX(-100%)",
          }}
        ></div>
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/50 transform -translate-x-1/2"></div>
      </div>
      <div className="mt-2 font-mono text-xl font-bold">
        {steeringAngle.toFixed(2)}
      </div>
    </div>
  );
}

export function PedalIndicator() {
  const pedalState = useDrivingStore((state) => state.pedalState);
  const calibrationStage = useDrivingStore((state) => state.calibrationStage);

  return (
    <div className="bg-slate-900/50 p-4 rounded-lg mb-6 border border-slate-700">
      <div className="grid grid-cols-2 gap-4">
        <div
          className={`p-4 rounded border-2 transition-colors ${
            pedalState.isAccelPressed
              ? "border-green-500 bg-green-500/20"
              : "border-slate-600 bg-slate-800"
          }`}
        >
          <div className="text-lg font-bold mb-1">アクセル</div>
          <div className="text-3xl font-mono">
            {(pedalState.throttle * 100).toFixed(0)}%
          </div>
        </div>
        <div
          className={`p-4 rounded border-2 transition-colors ${
            pedalState.isBrakePressed
              ? "border-red-500 bg-red-500/20"
              : "border-slate-600 bg-slate-800"
          }`}
        >
          <div className="text-lg font-bold mb-1">ブレーキ</div>
          <div className="text-3xl font-mono">
            {(pedalState.brake * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="mt-4 p-2 bg-black/40 rounded text-sm text-yellow-300 font-mono">
        STATUS:{" "}
        {calibrationStage === "idle"
          ? "待機中..."
          : calibrationStage === "waiting_for_brake"
          ? "足の位置を計測中..."
          : "キャリブレーション完了"}
      </div>
    </div>
  );
}
