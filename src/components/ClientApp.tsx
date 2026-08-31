"use client";

import { useDrivingStore } from '@/lib/store';
import KeyboardControls from '@/components/simulation/KeyboardControls';
import { Dashboard } from '@/components/ui/Dashboard';
import { HomeScreen } from '@/components/ui/HomeScreen';
import { FeedbackScreen } from '@/components/ui/FeedbackScreen';
import dynamic from 'next/dynamic';
import { Suspense, Component, ReactNode, ErrorInfo } from 'react';
import { useDrivingFeedback } from '@/hooks/useDrivingFeedback';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { HistoryScreen } from '@/components/ui/HistoryScreen';
import { auth } from '@/lib/firebase';
import { TutorialScreen } from '@/components/ui/TutorialScreen';
import { LanguageScreen } from '@/components/ui/LanguageScreen';
import { OrientationGate } from '@/components/ui/OrientationGate';
import { CameraConsent } from '@/components/ui/CameraConsent';

const VisionController = dynamic(() => import('@/components/vision/VisionController'), { ssr: false });
const Scene = dynamic(() => import('@/components/simulation/Scene').then(mod => mod.Scene), { ssr: false });

function UserProfileHeader() {
    const user = useDrivingStore(state => state.user);
    const setScreen = useDrivingStore(state => state.setScreen);
    const setUser = useDrivingStore(state => state.setUser);
    const setMissionHistory = useDrivingStore(state => state.setMissionHistory);
    const screen = useDrivingStore(state => state.screen);

    // This could get in the way during driving or on the feedback screen, so we could limit it
    // to HOME only. For now it stays visible at all times; we could also make it less prominent
    // while driving, but per the requirements it is placed in the top-right corner.
    if (screen === 'driving' || screen === 'feedback' || screen === 'auth' || screen === 'history' || screen === 'language') return null;

    const handleLogout = async () => {
        if (auth) await auth.signOut();
        setUser(null);
        setMissionHistory([]);
    }

    return (
        <div className="absolute top-8 right-8 z-50 flex flex-col items-end gap-2">
            <div className="px-6 py-2 bg-slate-800/90 border-l-4 border-blue-500 rounded-r text-sm font-mono tracking-widest">PLAYER: {user ? (user.email?.split('@')[0]?.toUpperCase() || 'DRIVER') : 'GUEST'}</div>
            <div className="flex gap-3 text-xs font-mono">
                {user ? (
                    <>
                    <button
                    onClick={() => setScreen('history')}
                    className='text-cyan-400 hover:text-cyan-300 transition-colors underline'
                    >Driving History</button>
                    <span className='test-slate-600'>|</span>
                    <button onClick={handleLogout}
                    className='text-slate-400 hover:text-red-400 transition-colors'
                    >
                        Logout
                    </button>
                    </>
                 ) : (
                    <button onClick={() => setScreen('auth')}
                    className='text-cyan-400 hover:text-cyan-300 transition-colors'
                    >
                        Login / Register
                    </button>
                 )}
                 </div>
                 </div>
    );
}


class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.toString() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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

// UI strings (JA / EN), selected by the store's `language`
const STRINGS = {
  ja: {
    pausedHint: '画面をクリックして再開',
    backToHome: 'ホームへ戻る',
    appTitle: 'バーチャル教習所',
    cameraHint: '画面クリックで一時停止 / 再開',
    cameraHint2: 'カメラを起動中... 手を上げてハンドル操作、W/Sキーでアクセル/ブレーキ',
    startMission: 'ミッション開始',
  },
  en: {
    pausedHint: 'Click the screen to resume',
    backToHome: 'Back to Home',
    appTitle: 'Virtual Driving School',
    cameraHint: 'Click the screen to pause / resume',
    cameraHint2: 'Starting camera... Raise your hands to steer, use the W/S keys for the accelerator/brake',
    startMission: 'Start Mission',
  },
} as const;

// Mission Definitions
const MISSION_INFO: Record<string, { title: { ja: string, en: string }, desc: { ja: string, en: string } }> = {
    'straight': { title: { ja: '直線走行', en: 'Straight Driving' }, desc: { ja: '基本の直線走行です。ハンドルを安定させ、一定の速度で走り抜けましょう。', en: 'Basic straight-line driving. Keep the wheel steady and drive through at a constant speed.' } },
    'left-turn': { title: { ja: '左折', en: 'Left Turn' }, desc: { ja: '交差点を左折します。速度を十分に落とし、巻き込みに注意して曲がりましょう。', en: 'Turn left at the intersection. Slow down enough and watch for cyclists and pedestrians on the inside as you turn.' } },
    'right-turn': { title: { ja: '右折', en: 'Right Turn' }, desc: { ja: '交差点を右折します。交差点の中心のすぐ内側を通るように意識しましょう。', en: 'Turn right at the intersection. Aim to pass just inside the center of the intersection.' } },
    's-curve': { title: { ja: 'S字カーブ', en: 'S-Curve' }, desc: { ja: 'S字型の狭路です。内輪差・外輪差を考慮し、脱輪しないように慎重に進みましょう。', en: 'A narrow S-shaped lane. Account for the difference in the path of the inner and outer wheels and proceed carefully to avoid going off the track.' } },
    'crank': { title: { ja: 'クランク', en: 'Crank' }, desc: { ja: '直角に曲がる狭路です。車両感覚を研ぎ澄まし、適切なタイミングでハンドルを切りましょう。', en: 'A narrow lane with right-angle turns. Sharpen your sense of the vehicle and turn the wheel at the right moment.' } },
    'traffic-light': { title: { ja: '信号機', en: 'Traffic Light' }, desc: { ja: '信号のある交差点です。赤信号で停止し、青になったら発進しましょう。', en: 'An intersection with a traffic light. Stop on red and set off once it turns green.' } },
    // Added: Level 7
    'crosswalk': { title: { ja: '横断歩道', en: 'Crosswalk' }, desc: { ja: '横断歩道があります。歩行者が渡ろうとしている時は、必ず停止線の手前で一時停止しましょう。', en: 'There is a crosswalk ahead. When a pedestrian is about to cross, always come to a stop before the stop line.' } },
    'railroad-crossing': { title: { ja: '踏切', en: 'Railroad Crossing' }, desc: { ja: '前方に踏切があります。必ず一時停止し、左右の安全を確認してから通過してください。警報機が鳴っている場合は進入してはいけません。', en: 'There is a railroad crossing ahead. Always come to a stop, check that it is safe on both sides, and then proceed. Do not enter while the warning bell is sounding.' } }
};

function MissionOverlay() {
    const currentLesson = useDrivingStore(state => state.currentLesson);
    const missionState = useDrivingStore(state => state.missionState);
    const setMissionState = useDrivingStore(state => state.setMissionState);
    const language = useDrivingStore(state => state.language);
    const t = STRINGS[language];

    if (missionState !== 'briefing') return null;

    const mission = MISSION_INFO[currentLesson];
    const info = mission
        ? { title: mission.title[language], desc: mission.desc[language] }
        : { title: currentLesson, desc: '' };

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
                    {t.startMission}
                </button>
            </div>
        </div>
    );
}

export default function ClientApp() {
  const screen = useDrivingStore(state => state.screen);
  const isPaused = useDrivingStore(state => state.isPaused);
  const setIsPaused = useDrivingStore(state => state.setIsPaused);
  const setScreen = useDrivingStore(state => state.setScreen);
  const setMisssionState = useDrivingStore(state => state.setMissionState);
  const language = useDrivingStore(state => state.language);
  const t = STRINGS[language];
  const testSession = useDrivingStore(state => state.testSession);
  const cameraProcessingAllowed = useDrivingStore(state => state.cameraProcessingAllowed);
  const startTestSession = useDrivingStore(state => state.startTestSession);

  useDrivingFeedback(); // Activate Feedback Logic

  const handleGoHome = () => {
    setIsPaused(false);
    setMisssionState('idle');
    setScreen('home');
  }

  // Click behavior (with a guard so clicks on buttons do not trigger it)
  const handleGlobalClick = (e: React.MouseEvent) => {
    // If the click landed on a button, do not trigger the pause feature (so we don't interfere with the button)
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (screen === 'driving' && testSession){
      setIsPaused(!isPaused);
    }
  };

  return (
    <ErrorBoundary>
        <div
            style={{ width: '100%', height: '100vh', position: 'relative', backgroundColor: 'black', overflow: 'hidden', cursor: screen === 'driving' ? 'pointer' : 'default' }}
            onClick={handleGlobalClick}
        >
          <UserProfileHeader />

          {/* Pause Overlay */}
          {screen === 'driving' && testSession && isPaused && (
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 999,
              display: 'flex', flexDirection:'column', justifyContent: 'center', alignItems: 'center', gap:'20px',
              // pointerEvents: 'none',
            }}>
              <h1 style={{
                color: 'white', fontSize: '80px', fontWeight: 'bold', letterSpacing: '10px',
                textShadow: '0 0 20px rgba(255,255,255,0.5)'
              }}>
                PAUSED ⏸
              </h1>
              <p style={{color: '#94a3b8', fontSize: '18px'}}>{t.pausedHint}</p>
              <div style={{display: 'flex', gap:'20px', marginTop:'20px'}}>
                 <button
                  onClick={handleGoHome}
                  style={{
                    padding: '16px 32px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                >{t.backToHome}</button>
              </div>
            </div>
          )}

          {screen === 'language' && <LanguageScreen />}
          {screen === 'home' && <HomeScreen />}
          {screen === 'auth' && <AuthScreen />}
          {screen === 'history' && <HistoryScreen />}

          {screen === 'tutorial' && <OrientationGate><TutorialScreen /></OrientationGate>}
          {screen === 'driving' && (
              <OrientationGate>
              {!testSession ? <div className="flex h-full items-center justify-center bg-slate-900 p-4">
                <CameraConsent language={language} onChoose={startTestSession} onDecline={handleGoHome} />
              </div> : <>
                {cameraProcessingAllowed && <VisionController isPaused={isPaused} />}
                <MissionOverlay />
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
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{t.appTitle}</h1>
                    <p style={{ fontSize: '14px', opacity: 0.8, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{t.cameraHint}<br/>
                       {t.cameraHint2}</p>
                </div>

                <div style={{ width: '100%', height: '100%', zIndex: 0 }}>
                    <Suspense fallback={<div style={{ color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Loading 3D Scene...</div>}>
                        <Scene />
                    </Suspense>
                </div>
              </>}
              </OrientationGate>
          )}

          {screen === 'feedback' && <FeedbackScreen />}
        </div>
    </ErrorBoundary>
  );
}
