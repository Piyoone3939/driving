"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker, HandLandmarker, DrawingUtils, FaceLandmarkerResult, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { useDrivingStore } from "@/lib/store";

export default function VisionController({ isPaused }: { isPaused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Store actions
  const setHeadRotation = useDrivingStore((state) => state.setHeadRotation);
  const setSteering = useDrivingStore((state) => state.setSteering);
  const setVisionReady = useDrivingStore((state) => state.setVisionReady);
  const setDebugInfo = useDrivingStore((state) => state.setDebugInfo);
  const setPedals = useDrivingStore((state) => state.setPedals);
  const setSpeed = useDrivingStore((state) => state.setSpeed);
  const setGaze = useDrivingStore((state) => state.setGaze); // Gaze action

  // References
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null); // ストリーム管理用

  // ■ カメラを停止する関数（物理的に切断）
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop(); // これがカメラのライトを消すコマンドだ
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // ループを止める
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = 0;
    }
    
    // 画面を漆黒に塗りつぶす
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
    setDebugInfo("Camera Stopped (Paused)");
  }, [setDebugInfo]);

  // ■ カメラを開始する関数
  const startCamera = useCallback(async () => {
    try {
        // AIモデルがまだ準備できていなければ待つ（本来はロード済みのはず）
        if (!faceLandmarkerRef.current || !handLandmarkerRef.current) {
            console.log("Waiting for models...");
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        streamRef.current = stream;

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadeddata = () => {
                videoRef.current?.play();
                predictWebcam();
            };
        }
        setDebugInfo("Camera Started");
    } catch (e) {
        console.error("Camera Error:", e);
        setDebugInfo("Camera Error: " + String(e));
    }
  }, [setDebugInfo]); // predictWebcamは依存に入れない（ループするため）

  // ■ 初期化（MediaPipeのロード）
  useEffect(() => {
    let isMounted = true;
    async function setupMediaPipe() {
      try {
        setDebugInfo("Loading AI Models...");
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3
        });

        if (isMounted) {
            faceLandmarkerRef.current = faceLandmarker;
            handLandmarkerRef.current = handLandmarker;
            setVisionReady(true);
            setDebugInfo("Models Ready.");
            
            // 初回ロード完了時に、ポーズしていなければカメラ起動
            if (!isPaused) {
                startCamera();
            }
        }
      } catch (error) {
        console.error(error);
      }
    }
    setupMediaPipe();

    return () => {
        isMounted = false;
        stopCamera(); // アンマウント時は確実に停止
    };
  }, []); // 初回のみ実行

  // ■ isPaused の変化に合わせてカメラをON/OFFする
  useEffect(() => {
    // MediaPipeのロードが終わっていない場合は無視（ロード完了時の処理に任せる）
    if (!faceLandmarkerRef.current) return;

    if (isPaused) {
        stopCamera();
    } else {
        startCamera();
    }
  }, [isPaused, startCamera, stopCamera]);


  // ■ AI推論ループ
  const predictWebcam = () => {
    // 停止指示が出ていたらループ終了
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (video.videoWidth > 0 && ctx) {
         if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
             canvas.width = video.videoWidth;
             canvas.height = video.videoHeight;
         }
         // 映像を描画（フィルタなし、鮮明に）
         ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    }

    let startTimeMs = performance.now();
    if (faceLandmarkerRef.current && handLandmarkerRef.current && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        
        try {
            const drawingUtils = ctx ? new DrawingUtils(ctx) : null;

            // Face Detection
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
                 if(drawingUtils) {
                    for (const landmarks of faceResult.faceLandmarks) {
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
                    }
                 }
                 // ... ここにHeadRotationやGazeの計算ロジックを入れる（省略せず元のコードを使ってOK）
                 // 今回は短縮のために計算部分は省略しているが、君の元のロジックをここに維持してくれ
            }

            // Hand Detection
            const handResult = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (handResult.landmarks && drawingUtils) {
                for (const landmarks of handResult.landmarks) {
                    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {color: "#00FF00", lineWidth: 3});
                    drawingUtils.drawLandmarks(landmarks, {color: "#FF0000", lineWidth: 2});
                }
            }
            // ハンドジェスチャー処理もここに維持
            // processHandGestures(handResult, ...);
            
        } catch (e) {
            console.error(e);
        }
    }

    // 次のフレームを要求
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  // ※ processHandGestures 関数等は元のまま維持すること

  return (
    <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        opacity: 0.8,
    }}>
        {/* videoタグは非表示で裏で動かす */}
        <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted></video>
        
        <div style={{
          position: "relative",
          width: "240px",
          height: "180px",
          backgroundColor: "black", // キャンバスの裏地も黒にしておく
          borderRadius: '10px',
          overflow: 'hidden'
        }}>
            <canvas ref={canvasRef} style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'black', // 停止時はここが見える
                transform: 'scaleX(-1)'
            }} />
        </div>

        <div style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            fontSize: '12px',
            padding: '8px',
            marginTop: '4px',
            borderRadius: '4px',
            maxWidth: '200px',
            fontFamily: 'monospace'
        }}>
            {useDrivingStore(state => state.debugInfo)}
        </div>
    </div>
  );
}