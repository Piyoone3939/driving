import { useDrivingStore } from "@/lib/store";
import { Scene } from "../simulation/Scene"; // Re-use scene for replay
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";

export function FeedbackScreen() {
  const setScreen = useDrivingStore(state => state.setScreen);
  const setMissionState = useDrivingStore(state => state.setMissionState);
  const currentLesson = useDrivingStore(state => state.currentLesson);
  const setIsReplaying = useDrivingStore(state => state.setIsReplaying);
  const clearReplayData = useDrivingStore(state => state.clearReplayData);
  const replayViewMode = useDrivingStore(state => state.replayViewMode); // New
  const setReplayViewMode = useDrivingStore(state => state.setReplayViewMode); // New

  // Auto-start replay mode when entering this screen
  useEffect(() => {
    setIsReplaying(true);
    return () => {
      setIsReplaying(false);
    };
  }, [setIsReplaying]);

  const handleRetry = () => {
    setIsReplaying(false);
    clearReplayData();
    setMissionState('briefing');
    setScreen('driving');
  };

  const handleHome = () => {
    setIsReplaying(false);
    clearReplayData();
    setMissionState('idle');
    setScreen('home');
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-700 bg-slate-800">
        <h2 className="text-xl font-bold text-blue-400">Mission Feedback: {currentLesson}</h2>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: 3D Replay View (Third Person) */}
        <div className="w-1/2 relative border-r border-slate-700 bg-black">
             {/* We render the Scene component here, but the props/store state will tell it to be in Replay Mode */}
             <div className="absolute top-4 left-4 z-10 flex gap-2">
                 <div className="bg-black/50 px-3 py-1 rounded text-xs font-mono text-red-500 animate-pulse">
                    ● REPLAY view
                 </div>
                 {/* Camera Toggle */}
                 <div className="flex bg-slate-800 rounded p-1 border border-slate-600">
                     <button 
                        onClick={() => setReplayViewMode('chase')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${replayViewMode === 'chase' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                     >
                        CHASE
                     </button>
                     <button 
                        onClick={() => setReplayViewMode('driver')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${replayViewMode === 'driver' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                     >
                        DRIVER
                     </button>
                 </div>
             </div>
             
             {/* Replay View Area */}
             <div className="w-full h-full relative">
                 {replayViewMode === 'driver' ? (
                     <div className="flex flex-col h-full">
                         {/* TOP: Player View */}
                         <div className="flex-1 relative border-b border-slate-700">
                             <div className="absolute top-2 right-2 z-10 bg-blue-600/80 px-2 py-0.5 rounded text-xs font-bold text-white">
                                 YOU
                             </div>
                             <Suspense fallback={null}>
                                 <Scene cameraTarget="player" />
                             </Suspense>
                         </div>
                         
                         {/* BOTTOM: Ideal View */}
                         <div className="flex-1 relative">
                             <div className="absolute top-2 right-2 z-10 bg-green-600/80 px-2 py-0.5 rounded text-xs font-bold text-white">
                                 IDEAL
                             </div>
                             <Suspense fallback={null}>
                                 <Scene cameraTarget="ghost" />
                             </Suspense>
                         </div>
                     </div>
                 ) : (
                     // Chase View (Full Screen)
                     <Suspense fallback={<div className="flex justify-center items-center h-full">Loading Replay...</div>}>
                        <Scene cameraTarget="player" /> 
                     </Suspense>
                 )}
             </div>
        </div>

        {/* Right: AI Analysis & Stats */}
        <div className="w-1/2 p-8 overflow-y-auto">
            <div className="mb-8 p-6 bg-slate-800 rounded-xl border border-slate-700">
                <h3 className="text-lg font-bold mb-4 text-green-400 flex items-center gap-2">
                    <span>✨</span> AI Instructor Feedback
                </h3>
                <div className="space-y-4 text-slate-300 leading-relaxed">
                    <p>
                        全体的に安定した走行でした。直線のスピード維持は完璧です！
                    </p>
                    <p>
                        <span className="text-yellow-400 font-bold">改善ポイント:</span><br/>
                        カーブの進入速度が少し速めでした。あと5km/hほど落とすと、よりスムーズに曲がれます。
                        また、目線（Head Rotation）が少し下がり気味です。遠くを見るように意識しましょう。
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Score</div>
                    <div className="text-3xl font-bold text-blue-400">85<span className="text-sm text-slate-500">/100</span></div>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Clear Time</div>
                    <div className="text-3xl font-bold text-white">00:42</div>
                </div>
            </div>

            <div className="flex gap-4 mt-auto">
                <button 
                    onClick={handleRetry}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                >
                    もう一度挑戦
                </button>
                <button 
                    onClick={handleHome}
                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors border border-slate-600"
                >
                    ホームに戻る
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
