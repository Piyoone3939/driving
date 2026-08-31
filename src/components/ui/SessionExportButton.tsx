import { useDrivingStore } from "@/lib/store";

export function SessionExportButton() {
  const language = useDrivingStore(state => state.language);
  const available = useDrivingStore(state => !!(state.testSession ?? state.lastTestSessionSummary));
  const exportTestSession = useDrivingStore(state => state.exportTestSession);
  if (!available) return null;
  const download = () => {
    const json = exportTestSession();
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "drivingsupport-session-summary.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <button onClick={download} className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
    {language === "en" ? "Export session summary" : "セッション概要をエクスポート"}
  </button>;
}
