"use client";

import { useState, useEffect } from 'react';
import { useDrivingStore } from '@/lib/store';
import dynamic from 'next/dynamic';
import { CameraConsent } from './CameraConsent';

// Dynamically import VisionController (avoid server-side rendering)
const VisionController = dynamic(() => import('@/components/vision/VisionController'), { ssr: false });

const STRINGS = {
    ja: {
        stepIntro: 'はじめに',
        stepExample: 'お手本',
        stepSteering: 'ハンドル',
        stepPedal: 'ペダル',
        stepDone: '完了',

        // Step 1
        welcomeTitle: 'バーチャル教習所へようこそ',
        welcomeLine1: 'このアプリでは、カメラを使って',
        welcomeFace: '「顔の向き・視線」',
        welcomeHands: '「手の動き（ハンドル）」',
        welcomeFeet: '「足の動き（アクセル・ブレーキ）」',
        welcomeLine2: 'を認識して操作します。',
        cameraNote1: '※カメラの使用許可が必要です。',
        cameraNote2: '全身（特に腰から下と両手）が映る位置に椅子を置いてください。',

        // Step 2
        exampleTitle: '操作イメージ',
        exampleLine1: 'まずは実際の操作の様子を見てみましょう。',
        exampleLine2: 'ハンドルを回す手、アクセル・ブレーキを踏む足の動きに注目してください。',

        // Step 3
        steeringTitle: 'ハンドル操作の基本',
        steeringLine1: '両手を前に出して、「見えないハンドル」を握ってください。',
        steeringLine2: '手を傾けると、下のバーが動きます。',
        steeringResponse: 'ステアリング反応',
        steeringLeft: '◀ 左 (-1.0)',
        steeringCenter: '中央 (0.0)',
        steeringRight: '右 (+1.0) ▶',

        // Step 4
        pedalTitle: '足のキャリブレーション',
        pedalLine1: '椅子に座り、膝から下がカメラに映るようにしてください。',
        pedalLine2Pre: 'まずは',
        pedalLine2Highlight: '5秒間、足を動かさずに',
        pedalLine2Post: '待ってください。',
        accel: 'アクセル',
        brake: 'ブレーキ',
        statusIdle: '待機中...',
        statusMeasuring: '足の位置を計測中...',
        statusDone: 'キャリブレーション完了',
        calibratedMessage: '設定完了！足を前へ出すとブレーキ、手前でアクセルです。',
        cameraPedalMode: 'カメラペダル',
        keyboardPedalMode: 'キーボードペダル（W: アクセル / S: ブレーキ）',
        retryCalibration: 'キャリブレーションをやり直す',
        continueWithKeyboard: 'キーボード操作で続ける',
        keyboardModeActive: 'キーボードモードで操作します（W: アクセル / S: ブレーキ）',
        backToCamera: 'カメラで足を認識する操作に戻す',
        switchToKeyboard: '足の検出がうまくいかない場合は、キーボードで操作する（W / S）',

        // Step 5
        readyTitle: '準備完了！',
        readyLine1: '基本操作の確認は以上です。',
        readyLine2: 'ホームに戻って好きなコースを選択してください。',
        backToHome: 'ホームに戻る',

        // Navigation
        back: '戻る',
        next: '次へ',
    },
    en: {
        stepIntro: 'Intro',
        stepExample: 'Example',
        stepSteering: 'Steering',
        stepPedal: 'Pedals',
        stepDone: 'Done',

        // Step 1
        welcomeTitle: 'Welcome to the Virtual Driving School',
        welcomeLine1: 'In this app, the camera recognizes your',
        welcomeFace: '"head direction and gaze"',
        welcomeHands: '"hand movements (steering)"',
        welcomeFeet: '"foot movements (accelerator and brake)"',
        welcomeLine2: 'to control the car.',
        cameraNote1: '* Camera permission is required.',
        cameraNote2: 'Place your chair so that your whole body (especially from the waist down and both hands) is visible.',

        // Step 2
        exampleTitle: 'How It Works',
        exampleLine1: "First, let's take a look at how the controls work in action.",
        exampleLine2: 'Pay attention to the hands turning the wheel and the feet pressing the accelerator and brake.',

        // Step 3
        steeringTitle: 'Steering Basics',
        steeringLine1: 'Hold both hands out in front of you and grip an "invisible steering wheel."',
        steeringLine2: 'Tilt your hands and the bar below will move.',
        steeringResponse: 'Steering Response',
        steeringLeft: '◀ Left (-1.0)',
        steeringCenter: 'Center (0.0)',
        steeringRight: 'Right (+1.0) ▶',

        // Step 4
        pedalTitle: 'Foot Calibration',
        pedalLine1: 'Sit in your chair so that everything below your knees is visible to the camera.',
        pedalLine2Pre: 'First, ',
        pedalLine2Highlight: 'keep your feet still for 5 seconds',
        pedalLine2Post: ' and wait.',
        accel: 'Accelerator',
        brake: 'Brake',
        statusIdle: 'Standing by...',
        statusMeasuring: 'Measuring foot position...',
        statusDone: 'Calibration complete',
        calibratedMessage: 'All set! Move your foot forward to brake and back to accelerate.',
        cameraPedalMode: 'Camera pedal',
        keyboardPedalMode: 'Keyboard pedal (W: accelerator / S: brake)',
        retryCalibration: 'Retry calibration',
        continueWithKeyboard: 'Continue with keyboard pedals',
        keyboardModeActive: 'Using keyboard controls (W: accelerator / S: brake)',
        backToCamera: 'Switch back to camera-based foot control',
        switchToKeyboard: "If foot detection isn't working well, control with the keyboard (W / S)",

        // Step 5
        readyTitle: "You're ready!",
        readyLine1: "That's all for the basic controls.",
        readyLine2: 'Return home and choose any course you like.',
        backToHome: 'Return Home',

        // Navigation
        back: 'Back',
        next: 'Next',
    },
} as const;

export function TutorialScreen() {
    const setScreen = useDrivingStore(state => state.setScreen);
    const startCalibration = useDrivingStore(state => state.startCalibration);
    const calibrationStage = useDrivingStore(state => state.calibrationStage);
    const pedalState = useDrivingStore(state => state.pedalState);
    const steeringAngle = useDrivingStore(state => state.steeringAngle);
    const pedalInputMode = useDrivingStore(state => state.pedalInputMode);
    const setPedalInputMode = useDrivingStore(state => state.setPedalInputMode);
    const activateKeyboardPedalFallback = useDrivingStore(state => state.activateKeyboardPedalFallback);
    const testSession = useDrivingStore(state => state.testSession);
    const cameraProcessingAllowed = useDrivingStore(state => state.cameraProcessingAllowed);
    const startTestSession = useDrivingStore(state => state.startTestSession);
    const language = useDrivingStore((state) => state.language);
    const t = STRINGS[language];

    // Tutorial step management
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

    // Start calibration once step 4 is reached
    useEffect(() => {
        if (step === 4 && calibrationStage === 'idle' && pedalInputMode === 'camera') {
            startCalibration();
        }
    }, [step, calibrationStage, pedalInputMode, startCalibration]);

    const nextStep = () => {
        if (step < 5) setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
    };

    const prevStep = () => {
        if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
    };

    if (!testSession) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-slate-900 p-4 text-white">
                <CameraConsent language={language} onChoose={startTestSession} onDecline={() => setScreen('home')} />
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-slate-900 text-white overflow-hidden flex flex-col items-center justify-center">

            {cameraProcessingAllowed && <div className="absolute top-0 left-0 w-full h-full">
                <VisionController isPaused={false} onKeyboardFallback={nextStep} />
            </div>}

            {/* Overlay Video Removed - now a dedicated step */}

            {/* Content overlay */}
            <div className="relative z-10 bg-slate-800/90 p-8 rounded-xl max-w-2xl w-full shadow-2xl border border-slate-700 backdrop-blur-sm">

                {/* Step indicator */}
                <div className="flex justify-between mb-8 px-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <div key={s} className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${
                                step >= s ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-400'
                            }`}>
                                {s}
                            </div>
                            <div className={`text-xs ${step >= s ? 'text-blue-400' : 'text-slate-500'}`}>
                                {s === 1 ? t.stepIntro : s === 2 ? t.stepExample : s === 3 ? t.stepSteering : s === 4 ? t.stepPedal : t.stepDone}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Step 1: Intro */}
                {step === 1 && (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                        <h2 className="text-3xl font-bold text-blue-400 mb-6">{t.welcomeTitle}</h2>
                        <p className="text-lg text-slate-300 mb-4 leading-relaxed">
                            {t.welcomeLine1}<br/>
                            <span className="font-bold text-white">{t.welcomeFace}</span>、
                            <span className="font-bold text-white">{t.welcomeHands}</span>、<br/>
                            <span className="font-bold text-white">{t.welcomeFeet}</span><br/>
                            {t.welcomeLine2}
                        </p>
                        <p className="text-sm text-slate-400 mb-8">
                            {t.cameraNote1}<br/>
                            {t.cameraNote2}
                        </p>
                    </div>
                )}

                {/* Step 2: Example video */}
                {step === 2 && (
                    <div className="text-center animate-in fade-in slide-in-from-right duration-300">
                        <h2 className="text-2xl font-bold text-purple-400 mb-4">{t.exampleTitle}</h2>
                        <p className="mb-6 text-slate-300">
                            {t.exampleLine1}<br/>
                            {t.exampleLine2}
                        </p>

                        <div className="w-full aspect-video rounded-lg overflow-hidden shadow-lg border border-slate-600 bg-black mb-6">
                            <video
                                src="/videos/tutorial.mp4"
                                className="w-full h-full object-contain"
                                autoPlay
                                loop
                                playsInline
                                controls
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Steering controls */}
                {step === 3 && (
                    <div className="text-center animate-in fade-in slide-in-from-right duration-300">
                        <h2 className="text-2xl font-bold text-green-400 mb-4">{t.steeringTitle}</h2>
                        <p className="mb-6 text-slate-300">
                            {t.steeringLine1}<br/>
                            {t.steeringLine2}
                        </p>

                        <div className="bg-slate-900/50 p-6 rounded-lg mb-6 border border-slate-700">
                            <div className="text-sm text-slate-400 mb-2">{t.steeringResponse}</div>
                            <div className="relative w-full h-8 bg-slate-700 rounded-full overflow-hidden">
                                <div className="absolute top-0 bottom-0 bg-blue-500 transition-all duration-100"
                                     style={{
                                         left: '50%',
                                         width: `${Math.abs(steeringAngle) * 50}%`,
                                         transform: steeringAngle > 0
                                            ? 'translateX(0)'
                                            : 'translateX(-100%)'
                                     }}
                                ></div>
                                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/50 transform -translate-x-1/2"></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
                                <span>{t.steeringLeft}</span>
                                <span>{t.steeringCenter}</span>
                                <span>{t.steeringRight}</span>
                            </div>
                            <div className="mt-2 font-mono text-xl font-bold">
                                {steeringAngle.toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Pedal (foot) controls */}
                {step === 4 && (
                     <div className="text-center animate-in fade-in slide-in-from-right duration-300">
                        <h2 className="text-2xl font-bold text-orange-400 mb-4">{t.pedalTitle}</h2>
                        <p className="text-slate-300 mb-4">
                            {t.pedalLine1}<br/>
                            {t.pedalLine2Pre}<span className="text-yellow-400 font-bold">{t.pedalLine2Highlight}</span>{t.pedalLine2Post}
                        </p>

                        <div className="bg-slate-900/50 p-4 rounded-lg mb-6 border border-slate-700">
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-4 rounded border-2 transition-colors ${pedalState.isAccelPressed ? 'border-green-500 bg-green-500/20' : 'border-slate-600 bg-slate-800'}`}>
                                    <div className="text-lg font-bold mb-1">{t.accel}</div>
                                    <div className="text-3xl font-mono">{(pedalState.throttle * 100).toFixed(0)}%</div>
                                </div>
                                <div className={`p-4 rounded border-2 transition-colors ${pedalState.isBrakePressed ? 'border-red-500 bg-red-500/20' : 'border-slate-600 bg-slate-800'}`}>
                                    <div className="text-lg font-bold mb-1">{t.brake}</div>
                                    <div className="text-3xl font-mono">{(pedalState.brake * 100).toFixed(0)}%</div>
                                </div>
                            </div>

                            <div className="mt-4 p-2 bg-black/40 rounded text-sm text-yellow-300 font-mono">
                                STATUS: {
                                    calibrationStage === 'idle' ? t.statusIdle :
                                    calibrationStage === 'waiting_for_brake' ? t.statusMeasuring :
                                    t.statusDone
                                }
                            </div>
                        </div>

                        {calibrationStage === 'calibrated' && (
                            <p className="text-green-400 font-bold animate-pulse">
                                {t.calibratedMessage}
                            </p>
                        )}

                        {/* Fallback: drive with keyboard pedals when feet can't be tracked */}
                        {pedalInputMode === 'keyboard' ? (
                            <div className="mt-4 p-3 bg-cyan-900/30 border border-cyan-700 rounded">
                                <p className="text-cyan-300 text-sm font-bold mb-2">
                                    {t.keyboardModeActive}
                                </p>
                                <button
                                    onClick={() => setPedalInputMode('camera')}
                                    disabled={!cameraProcessingAllowed}
                                    className="text-xs text-slate-400 underline hover:text-white transition-colors"
                                >
                                    {t.backToCamera}
                                </button>
                                <button
                                    onClick={nextStep}
                                    className="ml-4 text-xs text-cyan-200 underline hover:text-white transition-colors"
                                >
                                    {t.continueWithKeyboard}
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => { activateKeyboardPedalFallback(); nextStep(); }}
                                    className="mt-4 text-sm text-slate-400 underline hover:text-white transition-colors"
                                >
                                    {t.switchToKeyboard}
                                </button>
                                {calibrationStage === 'waiting_for_brake' && (
                                    <button
                                        onClick={startCalibration}
                                        className="ml-4 mt-4 text-sm text-yellow-300 underline hover:text-white transition-colors"
                                    >
                                        {t.retryCalibration}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Step 5: Done */}
                {step === 5 && (
                    <div className="text-center animate-in fade-in slide-in-from-right duration-300">
                         <h2 className="text-3xl font-bold text-cyan-400 mb-6">{t.readyTitle}</h2>
                         <p className="text-lg text-slate-300 mb-8">
                             {t.readyLine1}<br/>
                             {t.readyLine2}
                         </p>
                         <p className="text-cyan-300 font-semibold mb-8">
                             {pedalInputMode === 'keyboard' ? t.keyboardPedalMode : t.cameraPedalMode}
                         </p>

                         <button
                             onClick={() => setScreen('home')}
                             className="w-full max-w-xs py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105 mx-auto block"
                         >
                             {t.backToHome}
                         </button>
                    </div>
                )}

                {/* Navigation buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
                    <button
                        onClick={prevStep}
                        disabled={step === 1}
                        className={`px-6 py-2 rounded font-bold transition-colors ${
                            step === 1
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-600 hover:bg-slate-500 text-white'
                        }`}
                    >
                        {t.back}
                    </button>

                    {step < 5 && (
                        <button
                            onClick={nextStep}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
                        >
                            {t.next}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
