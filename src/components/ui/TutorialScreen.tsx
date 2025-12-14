"use client";

import { useState, useEffect } from 'react';
import { useDrivingStore } from '@/lib/store';
import dynamic from 'next/dynamic';

// VisionControllerを動的にインポート（サーバーサイドレンダリング回避）
const VisionController = dynamic(() => import('@/components/vision/VisionController'), { ssr: false });

export function TutorialScreen() {
    const setScreen = useDrivingStore(state => state.setScreen);
    const startCalibration = useDrivingStore(state => state.startCalibration);
    const calibrationStage = useDrivingStore(state => state.calibrationStage);
    const pedalState = useDrivingStore(state => state.pedalState);
    const steeringAngle = useDrivingStore(state => state.steeringAngle);
    
    // チュートリアルのステップ管理
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

    // ステップ4に入ったらキャリブレーションを開始する
    useEffect(() => {
        if (step === 4 && calibrationStage === 'idle') {
            startCalibration();
        }
    }, [step, calibrationStage, startCalibration]);

    const nextStep = () => {
        if (step < 5) setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
    };

    const prevStep = () => {
        if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
    };

    return (
        <div className="relative w-full h-full bg-slate-900 text-white overflow-hidden flex flex-col items-center justify-center">
            
            {/* VisionControllerを常に背面に表示（カメラ映像を確認するため） */}
            <div className="absolute top-0 left-0 w-full h-full opacity-50 z-0 pointer-events-none">
                <VisionController isPaused={false} />
            </div>

            {/* Overlay Video Removed - now a dedicated step */}

            {/* コンテンツオーバーレイ */}
            <div className="relative z-10 bg-slate-800/90 p-8 rounded-xl max-w-2xl w-full shadow-2xl border border-slate-700 backdrop-blur-sm">
                
                {/* ステップインジケーター */}
                <div className="flex justify-between mb-8 px-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <div key={s} className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${
                                step >= s ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-400'
                            }`}>
                                {s}
                            </div>
                            <div className={`text-xs ${step >= s ? 'text-blue-400' : 'text-slate-500'}`}>
                                {s === 1 ? 'はじめに' : s === 2 ? 'お手本' : s === 3 ? 'ハンドル' : s === 4 ? 'ペダル' : '完了'}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ステップ1: はじめに */}
                {step === 1 && (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                        <h2 className="text-3xl font-bold text-blue-400 mb-6">バーチャル教習所へようこそ</h2>
                        <p className="text-lg text-slate-300 mb-4 leading-relaxed">
                            このアプリでは、カメラを使って<br/>
                            <span className="font-bold text-white">「顔の向き・視線」</span>、
                            <span className="font-bold text-white">「手の動き（ハンドル）」</span>、<br/>
                            <span className="font-bold text-white">「足の動き（アクセル・ブレーキ）」</span><br/>
                            を認識して操作します。
                        </p>
                        <p className="text-sm text-slate-400 mb-8">
                            ※カメラの使用許可が必要です。<br/>
                            全身（特に腰から下と両手）が映る位置に椅子を置いてください。
                        </p>
                    </div>
                )}

                {/* ステップ2: お手本動画 */}
                {step === 2 && (
                    <div className="text-center animate-in fade-in slide-in-from-right duration-300">
                        <h2 className="text-2xl font-bold text-purple-400 mb-4">操作イメージ</h2>
                        <p className="mb-6 text-slate-300">
                            まずは実際の操作の様子を見てみましょう。<br/>
                            ハンドルを回す手、アクセル・ブレーキを踏む足の動きに注目してください。
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

                {/* ステップ3: ハンドル操作 */}
                {step === 3 && (
                    <div className="text-center animate-in fade-in slide-in-from-right duration-300">
                        <h2 className="text-2xl font-bold text-green-400 mb-4">ハンドル操作の基本</h2>
                        <p className="mb-6 text-slate-300">
                            両手を前に出して、「見えないハンドル」を握ってください。<br/>
                            手を傾けると、下のバーが動きます。
                        </p>
                        
                        <div className="bg-slate-900/50 p-6 rounded-lg mb-6 border border-slate-700">
                            <div className="text-sm text-slate-400 mb-2">ステアリング反応</div>
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
                                <span>◀ 左 (-1.0)</span>
                                <span>中央 (0.0)</span>
                                <span>右 (+1.0) ▶</span>
                            </div>
                            <div className="mt-2 font-mono text-xl font-bold">
                                {steeringAngle.toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}

                {/* ステップ4: ペダル（足）操作 */}
                {step === 4 && (
                     <div className="text-center animate-in fade-in slide-in-from-right duration-300">
                        <h2 className="text-2xl font-bold text-orange-400 mb-4">足のキャリブレーション</h2>
                        <p className="text-slate-300 mb-4">
                            椅子に座り、膝から下がカメラに映るようにしてください。<br/>
                            まずは<span className="text-yellow-400 font-bold">5秒間、足を動かさずに</span>待ってください。
                        </p>

                        <div className="bg-slate-900/50 p-4 rounded-lg mb-6 border border-slate-700">
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-4 rounded border-2 transition-colors ${pedalState.isAccelPressed ? 'border-green-500 bg-green-500/20' : 'border-slate-600 bg-slate-800'}`}>
                                    <div className="text-lg font-bold mb-1">アクセル</div>
                                    <div className="text-3xl font-mono">{(pedalState.throttle * 100).toFixed(0)}%</div>
                                </div>
                                <div className={`p-4 rounded border-2 transition-colors ${pedalState.isBrakePressed ? 'border-red-500 bg-red-500/20' : 'border-slate-600 bg-slate-800'}`}>
                                    <div className="text-lg font-bold mb-1">ブレーキ</div>
                                    <div className="text-3xl font-mono">{(pedalState.brake * 100).toFixed(0)}%</div>
                                </div>
                            </div>
                            
                            <div className="mt-4 p-2 bg-black/40 rounded text-sm text-yellow-300 font-mono">
                                STATUS: {
                                    calibrationStage === 'idle' ? '待機中...' :
                                    calibrationStage === 'waiting_for_brake' ? '足の位置を計測中...' :
                                    'キャリブレーション完了'
                                }
                            </div>
                        </div>

                        {calibrationStage === 'calibrated' && (
                            <p className="text-green-400 font-bold animate-pulse">
                                設定完了！足を前へ出すとブレーキ、手前でアクセルです。
                            </p>
                        )}
                    </div>
                )}

                {/* ステップ5: 完了 */}
                {step === 5 && (
                    <div className="text-center animate-in fade-in slide-in-from-right duration-300">
                         <h2 className="text-3xl font-bold text-cyan-400 mb-6">準備完了！</h2>
                         <p className="text-lg text-slate-300 mb-8">
                             基本操作の確認は以上です。<br/>
                             ホームに戻って好きなコースを選択してください。
                         </p>
                         
                         <button 
                             onClick={() => setScreen('home')}
                             className="w-full max-w-xs py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105 mx-auto block"
                         >
                             ホームに戻る
                         </button>
                    </div>
                )}

                {/* ナビゲーションボタン */}
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
                        戻る
                    </button>

                    {step < 5 && (
                        <button
                            onClick={nextStep}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
                        >
                            次へ
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
