import { useDrivingStore } from "@/lib/store";
import { Scene } from "../simulation/Scene"; // Re-use scene for replay
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { getCoursePath } from "@/lib/course";
import {addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function FeedbackScreen() {
  const setScreen = useDrivingStore(state => state.setScreen);
  const setMissionState = useDrivingStore(state => state.setMissionState);
  const currentLesson = useDrivingStore(state => state.currentLesson);
  const setIsReplaying = useDrivingStore(state => state.setIsReplaying);
  const isReplaying = useDrivingStore(state => state.isReplaying); // Fixed: Added missing selector
  const clearReplayData = useDrivingStore(state => state.clearReplayData);
  const replayViewMode = useDrivingStore(state => state.replayViewMode); // New
  const setReplayViewMode = useDrivingStore(state => state.setReplayViewMode); // New
  const feedbackLogs = useDrivingStore(state => state.feedbackLogs); // New

  const calculateMissionResult = useDrivingStore(state => state.calculateMissionResult); // Action
  const analyzedRef = useRef(false);

  const user = useDrivingStore(state => state.user);
  const addHistoryItem = useDrivingStore(state => state.addHistoryItem);

  // Auto-start replay mode when entering this screen
  useEffect(() => {
    setIsReplaying(true);
    
    // Run Analysis once
    if (!analyzedRef.current) {
        analyzedRef.current = true;
        const path = getCoursePath(currentLesson);
        calculateMissionResult(path);

        const state = useDrivingStore.getState();
        if (state.user){
            saveResultToFirestore(state);
        }
    }

    return () => {
      setIsReplaying(false);
    };
  }, [setIsReplaying, currentLesson, calculateMissionResult]);

  const saveResultToFirestore = async ( state: any) => {
    try {
        const kaizenLogs = state.feedbackLogs.filter((l: any) => l.type === 'KAIZEN');
        const kaizenPenalty = kaizenLogs.length * 5;
        const totalPenalty = kaizenPenalty + Math.floor(state.deviationPenalty || 0);
        const score = Math.max(0, 100 - totalPenalty);
        
        // Clear Time Calculation
        const diff = state.missionEndTime - state.missionStartTime;
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        const clearTime = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

        const logData = {
            userId: state.user.uid,
            timestamp: Date.now(),
            lesson: state.currentLesson,
            score: score,
            clearTime: clearTime,
            feedbackSummary: kaizenLogs.length > 0 ? kaizenLogs[0].message + ' 他' : '素晴らしい走行でした',
        };

        // Firestoreへの保存
        const docRef = await addDoc(collection(db, "mission_logs"), logData);
        
        // StoreのHistoryも更新（再フェッチを防ぐため）
        addHistoryItem({ id: docRef.id, ...logData });
        
    } catch (e) {
        console.error("Failed to save record", e);
    }
    }

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

  // Filter Unique messages to avoid spamming same thing? 
  // For now show all unique logs or timestamped
  const kaizenLogs = feedbackLogs.filter(l => l.type === 'KAIZEN');

  // Video Sync Logic
  const videoRef = useRef<HTMLVideoElement>(null);
  const recordedVideo = useDrivingStore(state => state.recordedVideo);
  // We need current replay time to sync video.
  // Ideally Scene invokes a callback on frame update, or we poll. 
  // For this MVP, let's assume video.play() starts same time as replay.
  // TO DO: Better Sync.

  useEffect(() => {
      if(recordedVideo && videoRef.current) {
          if(isReplaying) videoRef.current.play();
          else videoRef.current.pause();
      }
  }, [isReplaying, recordedVideo]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-700 bg-slate-800">
        <h2 className="text-xl font-bold text-blue-400">Mission Feedback: {currentLesson}</h2>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: 3D Replay View (Third Person) */}
        <div className="w-1/2 relative border-r border-slate-700 bg-black flex flex-col">
             
             {/* Main 3D Area */}
             <div className="flex-1 relative">
                 {/* Replay Overlay Info */}
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
                 
                 {/* 3D Scene */}
                 <div className="w-full h-full relative">
                     {replayViewMode === 'driver' ? (
                         <div className="flex flex-col h-full">
                             <div className="flex-1 relative border-b border-slate-700">
                                 <div className="absolute top-2 right-2 z-10 bg-blue-600/80 px-2 py-0.5 rounded text-xs font-bold text-white">YOU</div>
                                 <Suspense fallback={null}><Scene cameraTarget="player" /></Suspense>
                             </div>
                             <div className="flex-1 relative">
                                 <div className="absolute top-2 right-2 z-10 bg-green-600/80 px-2 py-0.5 rounded text-xs font-bold text-white">IDEAL</div>
                                 <Suspense fallback={null}><Scene cameraTarget="ghost" /></Suspense>
                             </div>
                         </div>
                     ) : (
                         <Suspense fallback={<div className="flex justify-center items-center h-full">Loading Replay...</div>}>
                            <Scene cameraTarget="player" /> 
                         </Suspense>
                     )}
                 </div>
            </div>

            {/* Video Comparison Feed (Bottom Left Overlay) */}
            {recordedVideo && (
                <div className="absolute bottom-4 left-4 w-64 aspect-video bg-black border-2 border-slate-600 rounded-lg overflow-hidden shadow-2xl z-20">
                     <div className="absolute top-1 left-1 bg-black/60 px-2 py-0.5 text-[10px] text-white z-10 rounded">
                         DRIVER FACE
                     </div>
                     <video ref={videoRef} src={recordedVideo} className="w-full h-full object-cover scale-x-[-1]" loop muted playsInline />
                     
                     {/* Gaze Overlay (Visualizing comparison) */}
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         {/* CORRECT Gaze (Green) */}
                         <div className="absolute w-full h-full opacity-50">
                            {/* Static Center for now, meaning "Look Forward" */}
                            <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-green-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#00ff00]"></div>
                            <div className="absolute top-1/2 left-1/2 text-green-400 text-xs font-bold -translate-y-8 -translate-x-1/2">CORRECT</div>
                         </div>
                         
                         {/* ACTUAL Gaze (Blue or Red) - Animated via CSS or JS later? 
                             For MVP, let's put a "X" if kaizenLogs exist at nearly same time? 
                             Or just static for concept as requested.
                         */}
                     </div>
                     
                     {/* Comparison Result Badge */}
                     <div className="absolute top-0 right-0 h-full w-1/3 flex flex-col items-center justify-center bg-gradient-to-l from-black/80 to-transparent">
                          {kaizenLogs.length > 0 ? (
                              <div className="text-red-500 font-bold text-4xl animate-pulse">×</div>
                          ) : (
                              <div className="text-green-500 font-bold text-4xl">○</div>
                          )}
                     </div>
                </div>
            )}
        </div>

        {/* Right: AI Analysis & Stats */}
        <div className="w-1/2 p-8 overflow-y-auto">
            <div className="mb-8 p-6 bg-slate-800 rounded-xl border border-slate-700">
                <h3 className="text-lg font-bold mb-4 text-green-400 flex items-center gap-2">
                    <span>✨</span> AI Instructor Feedback
                </h3>
                <div className="space-y-4 text-slate-300 leading-relaxed">
                    {kaizenLogs.length === 0 ? (
                        <p>全体的に素晴らしい走行でした！速度・視線ともに安定しています。</p>
                    ) : (
                        <>
                            <p>全体的に安定した走行でしたが、いくつか気になる点がありました。</p>
                            <div className="mt-4">
                                <span className="text-yellow-400 font-bold">改善ポイント:</span>
                                <ul className="list-disc list-inside mt-2 space-y-2 text-sm">
                                    {kaizenLogs.map((log, i) => (
                                        <li key={i}>
                                            <span className="font-bold text-white">{log.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Score</div>
                    <div className="text-3xl font-bold text-blue-400">
                        {(() => {
                            const kaizenPenalty = kaizenLogs.length * 5;
                            const deviationPenalty = useDrivingStore.getState().deviationPenalty || 0;
                            const totalPenalty = kaizenPenalty + Math.floor(deviationPenalty);
                            return Math.max(0, 100 - totalPenalty);
                        })()}
                        <span className="text-sm text-slate-500">/100</span>
                    </div>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Clear Time</div>
                    <div className="text-3xl font-bold text-white">
                        {(() => {
                            const start = useDrivingStore.getState().missionStartTime;
                            const end = useDrivingStore.getState().missionEndTime;
                            if (start && end) {
                                const diff = end - start;
                                const min = Math.floor(diff / 60000);
                                const sec = Math.floor((diff % 60000) / 1000);
                                const ms = Math.floor((diff % 1000) / 10);
                                return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
                            }
                            return "--:--.--";
                        })()}
                    </div>
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
