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

export default function ClientApp() {
  return (
    <ErrorBoundary>
        <div style={{ width: '100%', height: '100vh', position: 'relative', backgroundColor: 'black', overflow: 'hidden' }}>
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
