"use client";

import { useDrivingStore } from "@/lib/store";

type Props = { language: "ja" | "en"; onChoose: (cameraProcessingAllowed: boolean) => void; onDecline: () => void };

export function CameraConsent({ language, onChoose, onDecline }: Props) {
  const en = language === "en";
  const failed = useDrivingStore(state => state.sessionStartFailed);
  return (
    <div className="relative z-20 max-h-[calc(100dvh-32px)] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-600 bg-slate-800 p-4 text-white shadow-2xl sm:p-6">
      <h2 className="mb-4 text-2xl font-bold text-blue-400">{en ? "Before practice" : "練習を始める前に"}</h2>
      <p className="mb-4 text-slate-200">
        {en ? "The camera can be used for driving-practice motion recognition." : "カメラは運転練習の動作認識に使用します。"}
      </p>
      <ul className="mb-6 list-disc space-y-2 pl-5 text-sm text-slate-300">
        <li>{en ? "Camera data is processed for practice; raw camera video is not stored by this MVP." : "カメラデータは練習のために処理します。MVPでは生の映像を保存しません。"}</li>
        <li>{en ? "With your agreement, derived, non-identifying session events are recorded in memory for usability testing, with or without a camera." : "同意いただくと、カメラの有無にかかわらず、ユーザビリティ検証のため個人を特定しない派生セッションイベントをメモリ内に記録します。"}</li>
        <li>{en ? "You can stop or leave at any time. This is supplementary practice, not a replacement for licensed instruction or real-road practice." : "いつでも停止・退出できます。これは補助練習であり、資格を持つ指導や実道練習の代替ではありません。"}</li>
      </ul>
      {failed && <p role="alert" className="mb-4 text-sm text-amber-300">
        {en ? "A secure session ID could not be created. The session and camera have not started. Try a supported browser or return Home." : "安全なセッションIDを作成できませんでした。セッションとカメラは開始していません。対応ブラウザで再試行するか、ホームに戻ってください。"}
      </p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button onClick={() => onChoose(true)} className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500">
          {en ? "Agree and continue with camera" : "同意してカメラで続ける"}
        </button>
        <button onClick={() => onChoose(false)} className="flex-1 rounded-lg border border-slate-500 bg-slate-700 px-4 py-3 font-bold hover:bg-slate-600">
          {en ? "Agree and continue without camera" : "同意してカメラなしで続ける"}
        </button>
      </div>
      <button onClick={onDecline} className="mt-3 w-full rounded-lg border border-slate-600 px-4 py-3 text-sm hover:bg-slate-700">
        {en ? "Do not consent — return Home" : "同意せずホームに戻る"}
      </button>
    </div>
  );
}
