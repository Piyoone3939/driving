"use client";

type Props = { language: "ja" | "en"; onChoose: (cameraProcessingAllowed: boolean) => void };

export function CameraConsent({ language, onChoose }: Props) {
  const en = language === "en";
  return (
    <div className="relative z-20 w-full max-w-xl rounded-xl border border-slate-600 bg-slate-800 p-6 text-white shadow-2xl">
      <h2 className="mb-4 text-2xl font-bold text-blue-400">{en ? "Before practice" : "練習を始める前に"}</h2>
      <p className="mb-4 text-slate-200">
        {en ? "The camera can be used for driving-practice motion recognition." : "カメラは運転練習の動作認識に使用します。"}
      </p>
      <ul className="mb-6 list-disc space-y-2 pl-5 text-sm text-slate-300">
        <li>{en ? "Camera data is processed for practice; raw camera video is not stored by this MVP." : "カメラデータは練習のために処理します。MVPでは生の映像を保存しません。"}</li>
        <li>{en ? "Derived, non-identifying session events may be recorded for usability testing." : "ユーザビリティ検証のため、個人を特定しない派生セッションイベントを記録する場合があります。"}</li>
        <li>{en ? "You can stop or leave at any time. This is supplementary practice, not a replacement for licensed instruction or real-road practice." : "いつでも停止・退出できます。これは補助練習であり、資格を持つ指導や実道練習の代替ではありません。"}</li>
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button onClick={() => onChoose(true)} className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500">
          {en ? "Agree and continue" : "同意して続ける"}
        </button>
        <button onClick={() => onChoose(false)} className="flex-1 rounded-lg border border-slate-500 bg-slate-700 px-4 py-3 font-bold hover:bg-slate-600">
          {en ? "Continue without camera" : "カメラなしで続ける"}
        </button>
      </div>
    </div>
  );
}
