"use client";

import { useDrivingStore } from '@/lib/store';
import KeyboardControls from '@/components/simulation/KeyboardControls';
import { Dashboard } from '@/components/ui/Dashboard';
import dynamic from 'next/dynamic';
import { Suspense, Component, ReactNode } from 'react';

const VisionController = dynamic(() => import('@/components/vision/VisionController'), { ssr: false });
const Scene = dynamic(() => import('@/components/simulation/Scene').then(mod => mod.Scene), { ssr: false });

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error.toString() };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="z-50 p-10 text-red-500 bg-white absolute top-0 left-0 w-full h-full">
            <h1>Something went wrong.</h1>
            <pre>{this.state.error}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function LessonSelector() {
    const setLesson = useDrivingStore(state => state.setLesson);
    const currentLesson = useDrivingStore(state => state.currentLesson);
    
    return (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', gap: '10px' }}>
            {(['straight', 'left-turn', 'right-turn'] as const).map((lesson) => {
                const labels: Record<string, string> = {
                    'straight': '直線',
                    'left-turn': '左折',
                    'right-turn': '右折',
                    's-curve': 'S字',
                    'crank': 'クランク'
                };
                return (
                <button 
                    key={lesson}
                    onClick={() => setLesson(lesson as any)}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: currentLesson === lesson ? 'white' : 'rgba(0,0,0,0.5)',
                        color: currentLesson === lesson ? 'black' : 'white',
                        border: '1px solid white',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                    }}
                >
                    {labels[lesson] || lesson}
                </button>
                );
            })}
        </div>
    );
}

// ... (ErrorBoundary)

// Mission Definitions
const MISSION_INFO: Record<string, { title: string, desc: string }> = {
    'straight': { title: '直線走行', desc: '基本の直線走行です。ハンドルを安定させ、一定の速度で走り抜けましょう。' },
    'left-turn': { title: '左折', desc: '交差点を左折します。速度を十分に落とし、巻き込みに注意して曲がりましょう。' },
    'right-turn': { title: '右折', desc: '交差点を右折します。交差点の中心のすぐ内側を通るように意識しましょう。' },
    's-curve': { title: 'S字カーブ', desc: 'S字型の狭路です。内輪差・外輪差を考慮し、脱輪しないように慎重に進みましょう。' },
    'crank': { title: 'クランク', desc: '直角に曲がる狭路です。車両感覚を研ぎ澄まし、適切なタイミングでハンドルを切りましょう。' }
};

function MissionOverlay() {
    const currentLesson = useDrivingStore(state => state.currentLesson);
    const missionState = useDrivingStore(state => state.missionState);
    const setMissionState = useDrivingStore(state => state.setMissionState);

    if (missionState !== 'briefing') return null;

    const info = MISSION_INFO[currentLesson] || { title: currentLesson, desc: '' };

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 100, // Topmost
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            color: 'white'
        }}>
            <div style={{
                backgroundColor: '#1e293b',
                padding: '40px',
                borderRadius: '16px',
                textAlign: 'center',
                maxWidth: '600px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                border: '1px solid #334155'
            }}>
                <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px', color: '#60a5fa' }}>
                    MISSION: {info.title}
                </h2>
                <p style={{ fontSize: '18px', lineHeight: '1.6', marginBottom: '40px', color: '#cbd5e1' }}>
                    {info.desc}
                </p>
                
                <button 
                    onClick={() => setMissionState('active')}
                    style={{
                        padding: '12px 40px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: '#2563eb',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                >
                    ミッション開始
                </button>
            </div>
        </div>
    );
}

// ... (ErrorBoundary)

export default function ClientApp() {
  return (
    <ErrorBoundary>
        <div style={{ width: '100%', height: '100vh', position: 'relative', backgroundColor: 'black', overflow: 'hidden' }}>
          <MissionOverlay />
          <LessonSelector />
          <VisionController />
          <KeyboardControls />
          <Dashboard />
          
          <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 10,
              padding: '16px',
              color: 'white',
              pointerEvents: 'none',
              userSelect: 'none'
          }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>バーチャル教習所</h1>
            <p style={{ fontSize: '14px', opacity: 0.8, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>カメラを起動中... 手を上げてハンドル操作、W/Sキーでアクセル/ブレーキ</p>
          </div>

          <div style={{ width: '100%', height: '100%', zIndex: 0 }}>
             <Suspense fallback={<div style={{ color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Loading 3D Scene...</div>}>
                <Scene />
             </Suspense>
          </div>
        </div>
    </ErrorBoundary>
  );
}
