"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker, HandLandmarker, PoseLandmarker, DrawingUtils, HandLandmarkerResult, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { useDrivingStore } from "@/lib/store";
import { calibrateFootPosition, processPedalRecognition, checkFootStability } from "@/lib/footPedalRecognition";
import { PoseLandmarkFilterManager } from "@/lib/oneEuroFilter";

export default function VisionController({ isPaused }: { isPaused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  
  // Store actions
  const setHeadRotation = useDrivingStore((state) => state.setHeadRotation);
  const setSteering = useDrivingStore((state) => state.setSteering);
  const setVisionReady = useDrivingStore((state) => state.setVisionReady);
  const setDebugInfo = useDrivingStore((state) => state.setDebugInfo);
  const setPedals = useDrivingStore((state) => state.setPedals);
  const setSpeed = useDrivingStore((state => state.setSpeed));
  const setFootCalibration = useDrivingStore((state) => state.setFootCalibration);
  const updatePedalState = useDrivingStore((state) => state.updatePedalState);
  const setCalibrationStage = useDrivingStore((state) => state.setCalibrationStage);
  const setScreen = useDrivingStore((state) => state.setScreen);

  // References for MediaPipe instances
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // 1ユーロフィルタマネージャー
  const poseFilterManagerRef = useRef<PoseLandmarkFilterManager>(
    new PoseLandmarkFilterManager(1.0, 0.007, 1.0)
  );

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;

    if(isPaused){
      setSteering(0);
      setSpeed(0);
      setDebugInfo("Paused");
    }
  }, [isPaused, setSteering, setSpeed, setDebugInfo]);

  useEffect(() => {
    async function setupMediaPipe() {
      try {
        setDebugInfo("Loading MediaPipe models...");
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(filesetResolver, {
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

        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        setDebugInfo("Models loaded. Starting Camera...");
        setVisionReady(true);
        setWebcamRunning(true); 

      } catch (error) {
        console.error("Error setting up MediaPipe:", error);
        setDebugInfo("Error loading vision models");
      }
    }

    setupMediaPipe();

    return () => {
      cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
         try {
             const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
             tracks.forEach(t => t.stop());
         } catch(e) { /* ignore */ }
      }
    }
  }, [setVisionReady, setDebugInfo]);

  // Re-enable webcam effect
  useEffect(() => {
    if (webcamRunning) {
      const enableCam = async () => {
         try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try {
                    await videoRef.current.play(); 
                } catch (e) {
                    console.warn("Video play interrupted or failed:", e);
                }
                videoRef.current.addEventListener("loadeddata", predictWebcam);
                if (videoRef.current.readyState >= 2) {
                    predictWebcam();
                }
            }
         } catch(e) {
             console.error("Camera Error: ", e);
             setDebugInfo("Camera Error: " + String(e));
         }
      };
      
      enableCam();
    }
    
    return () => {
        if(requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [webcamRunning]);


  const predictWebcam = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Always draw video frame if available
    if(video.videoWidth > 0 && ctx) {
         if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
             canvas.width = video.videoWidth;
             canvas.height = video.videoHeight;
         }
         ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    }

    // Pause Check
    if (isPausedRef.current) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return; 
    }

    if (faceLandmarkerRef.current && handLandmarkerRef.current && poseLandmarkerRef.current && video.currentTime !== lastVideoTimeRef.current) {
        // eslint-disable-next-line react-hooks/purity
        const startTimeMs = performance.now();
        // eslint-disable-next-line react-hooks/purity
        const currentTime = performance.now();
        const deltaTime = lastFrameTimeRef.current === 0 ? 16 : currentTime - lastFrameTimeRef.current;
        lastFrameTimeRef.current = currentTime;
        lastVideoTimeRef.current = video.currentTime;

        try {
            const drawingUtils = ctx ? new DrawingUtils(ctx) : null;

            // Run Face Detection
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
                if(drawingUtils) {
                    for (const landmarks of faceResult.faceLandmarks) {
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
                    }
                }
                const landmarks = faceResult.faceLandmarks[0];
                if(landmarks) {
                    const nose = landmarks[1];
                    const leftEar = landmarks[234];
                    const rightEar = landmarks[454];
                    const midEarX = (leftEar.x + rightEar.x) / 2;
                    const yawEstimate = (nose.x - midEarX) * 20;
                    setHeadRotation({ pitch: 0, yaw: -yawEstimate, roll: 0 });
                }
            }

            // Run Hand Detection
            const handResult = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (handResult.landmarks && drawingUtils) {
                for (const landmarks of handResult.landmarks) {
                    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {color: "#00FF00", lineWidth: 3});
                    drawingUtils.drawLandmarks(landmarks, {color: "#FF0000", lineWidth: 2});
                }
            }
            const handInfo = processHandGestures(handResult, setSteering);

            // Run Pose Detection for Foot Pedal Recognition
            const poseResult = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);
            processPoseForPedals(poseResult, deltaTime, drawingUtils, handInfo);

        } catch (e) {
            console.error("Prediction error:", e);
        }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processHandGestures = (result: HandLandmarkerResult, setSteering: (val: number) => void): string => {
      const hands = result.landmarks.length;
      let info = `Hands: ${hands}`;

      if (hands === 2 && result.handedness.length === 2) {
          let leftHandLandmarks = result.landmarks[0];
          let rightHandLandmarks = result.landmarks[1];

          const label0 = result.handedness[0]?.[0]?.categoryName ?? 'Left';
          const label1 = result.handedness[1]?.[0]?.categoryName ?? 'Right';

          if (label0 !== label1) {
              if (label0 === 'Left') {
                  leftHandLandmarks = result.landmarks[0];
                  rightHandLandmarks = result.landmarks[1];
              } else {
                  leftHandLandmarks = result.landmarks[1];
                  rightHandLandmarks = result.landmarks[0];
              }
          } else {
              const h1 = result.landmarks[0][9];
              const h2 = result.landmarks[1][9];
              if (h1.x < h2.x) {
                  leftHandLandmarks = result.landmarks[0];
                  rightHandLandmarks = result.landmarks[1];
              } else {
                  leftHandLandmarks = result.landmarks[1];
                  rightHandLandmarks = result.landmarks[0];
              }
          }

          const left = leftHandLandmarks[9];
          const right = rightHandLandmarks[9];

          const dy = right.y - left.y;
          const dx = right.x - left.x;

          const angle = Math.atan2(dy, dx);

          // Digital Steering Logic: Snap to 1 or -1
          const threshold = 0.1;
          let steering = 0;
          if (Math.abs(angle) > threshold) {
              // Invert sign as requested
              steering = -Math.sign(angle);
          }

          setSteering(steering);

          info += ` | Str: ${steering}`;
      } else {
          setSteering(0);
          info += " | Need 2 hands";
      }

      return info;
  };

  const processPoseForPedals = (result: PoseLandmarkerResult, deltaTime: number, drawingUtils: DrawingUtils | null, handInfo: string) => {
    // ポーズランドマークを描画
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    // ランドマークを1ユーロフィルタでフィルタリング
    let filteredLandmarks = result.landmarks && result.landmarks.length > 0 ? result.landmarks[0] : null;
    if (filteredLandmarks) {
      const timestamp = performance.now();
      const filtered = filteredLandmarks.map((landmark, index) => {
        const filteredPoint = poseFilterManagerRef.current.filterLandmark(
          index,
          { x: landmark.x, y: landmark.y, z: landmark.z },
          timestamp
        );
        return {
          x: filteredPoint.x,
          y: filteredPoint.y,
          z: filteredPoint.z,
          visibility: landmark.visibility,
        };
      });
      // フィルタリング後のランドマークを使用
      filteredLandmarks = filtered;
    }

    // storeから最新の状態を直接取得
    const currentCalibrationStage: 'idle' | 'waiting_for_brake' | 'calibrated' = useDrivingStore.getState().calibrationStage;
    const currentPedalState = useDrivingStore.getState().pedalState;
    const currentFootCalibration = useDrivingStore.getState().footCalibration;

    // 状態に応じた色を決定
    let footColor = "#0000FF"; // デフォルト: 青色（通常時）
    let landmarkColor = "#8080FF"; // デフォルト: 薄い青色

    if (currentCalibrationStage === 'waiting_for_brake') {
      // キャリブレーション中 - 進捗に応じて色の明るさを変える
      if (currentFootCalibration && currentFootCalibration.stabilityCheckStartTime) {
        const currentTime = performance.now();
        const elapsed = currentTime - currentFootCalibration.stabilityCheckStartTime;
        const progress = Math.min(elapsed / 5000, 1.0);

        // 進捗に応じて緑色に近づく（0%: 黄色、100%: 緑色）
        const r = Math.floor(255 * (1 - progress));
        const g = 255;
        const b = 0;
        footColor = `rgb(${r}, ${g}, ${b})`;
        landmarkColor = `rgb(${Math.min(r + 80, 255)}, ${g}, ${Math.min(b + 80, 255)})`;
      } else {
        footColor = "#FFFF00"; // 黄色（キャリブレーション開始前）
        landmarkColor = "#FFFF80";
      }
    } else if (currentCalibrationStage === 'calibrated' && currentPedalState && currentFootCalibration?.isCalibrated) {
      if (currentPedalState.isBrakePressed) {
        footColor = "#FF0000"; // 赤色（ブレーキON）
        landmarkColor = "#FF8080";
      } else if (currentPedalState.isAccelPressed) {
        footColor = "#00FF00"; // 緑色（アクセルON）
        landmarkColor = "#80FF80";
      } else {
        footColor = "#0000FF"; // 青色（待機中）
        landmarkColor = "#8080FF";
      }
    } else {
      // その他の状態（キャリブレーション前など）
      footColor = "#888888"; // 灰色
      landmarkColor = "#AAAAAA";
    }

    if (filteredLandmarks && ctx && canvas) {
      const landmarks = filteredLandmarks;

      // 右足のみを描画（腰、膝から下）
      // 23(左腰), 24(右腰), 26(右膝), 28(右足首), 30(右踵), 32(右足先)
      const rightFootConnections = [
        [24, 26], // 右腰 → 右膝
        [26, 28], // 右膝 → 右足首
        [28, 30], // 右足首 → 右踵
        [30, 32], // 右踵 → 右足先
      ];

      // 右足のランドマークを線で結ぶ（状態に応じた色）
      ctx.save();
      ctx.strokeStyle = footColor;
      ctx.lineWidth = 4;
      for (const [start, end] of rightFootConnections) {
        if (landmarks[start] && landmarks[end]) {
          const startPoint = landmarks[start];
          const endPoint = landmarks[end];
          const width = canvas.width;
          const height = canvas.height;
          ctx.beginPath();
          ctx.moveTo(startPoint.x * width, startPoint.y * height);
          ctx.lineTo(endPoint.x * width, endPoint.y * height);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 右足と腰のランドマークを描画（状態に応じた色）
      const rightFootLandmarkIndices = [23, 24, 26, 28, 30, 32]; // 左腰、右腰、右膝、右足首、右踵、右足先
      if (drawingUtils) {
        const footLandmarks = rightFootLandmarkIndices.map(i => landmarks[i]).filter(Boolean);
        if (footLandmarks.length > 0) {
          drawingUtils.drawLandmarks(footLandmarks, {color: landmarkColor, lineWidth: 3, radius: 4});
        }
      }
    }

    // キャリブレーション完了後、ブレーキの基準位置を描画
    if (currentCalibrationStage === 'calibrated' && currentFootCalibration?.isCalibrated && ctx && canvas) {
      const brakePosition = currentFootCalibration;
      const width = canvas.width;
      const height = canvas.height;

      // ブレーキ位置を半透明の円で描画
      ctx.save();
      ctx.globalAlpha = 0.5;

      // 右足首の基準位置
      const rightAnkleX = brakePosition.rightAnkle.x * width;
      const rightAnkleY = brakePosition.rightAnkle.y * height;

      // 右踵の基準位置
      const rightHeelX = brakePosition.rightHeel.x * width;
      const rightHeelY = brakePosition.rightHeel.y * height;

      // 右足先の基準位置
      const rightFootIndexX = brakePosition.rightFootIndex.x * width;
      const rightFootIndexY = brakePosition.rightFootIndex.y * height;

      // ブレーキゾーンを示す円を描画
      ctx.fillStyle = '#FFA500'; // オレンジ色
      ctx.strokeStyle = '#FF4500'; // 濃いオレンジ色
      ctx.lineWidth = 2;

      // 足首を中心に円を描画
      ctx.beginPath();
      ctx.arc(rightAnkleX, rightAnkleY, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // 踵を中心に円を描画
      ctx.beginPath();
      ctx.arc(rightHeelX, rightHeelY, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // 足先を中心に円を描画
      ctx.beginPath();
      ctx.arc(rightFootIndexX, rightFootIndexY, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // ブレーキゾーンを示す線を描画
      ctx.strokeStyle = '#FFA500';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rightAnkleX, rightAnkleY);
      ctx.lineTo(rightHeelX, rightHeelY);
      ctx.lineTo(rightFootIndexX, rightFootIndexY);
      ctx.stroke();

      // "BRAKE" テキストを描画
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.font = 'bold 14px Arial';
      ctx.lineWidth = 3;
      ctx.strokeText('BRAKE', rightAnkleX + 15, rightAnkleY - 10);
      ctx.fillText('BRAKE', rightAnkleX + 15, rightAnkleY - 10);

      ctx.restore();
    }

    // キャリブレーション段階に応じた処理
    if (['idle', 'waiting_for_brake'].includes(currentCalibrationStage)) {
      // キャリブレーション中 - 5秒間の足位置安定性をチェック
      if (filteredLandmarks) {
        const currentTime = performance.now();
        const stabilityCheck = checkFootStability(
          filteredLandmarks,
          currentFootCalibration,
          currentTime
        );

        if (stabilityCheck.calibration) {
          setFootCalibration(stabilityCheck.calibration);

          if (stabilityCheck.isStable) {
            // 5秒間安定していた場合、キャリブレーション完了
            setCalibrationStage('calibrated');
            setDebugInfo(`${handInfo} | 足元のキャリブレーション完了！`);
            console.log('Foot calibration completed after 5 seconds:', stabilityCheck.calibration);

            // 画面が'driving'でない場合は自動的に遷移
            const screen = useDrivingStore.getState().screen;
            if (screen !== 'driving') {
              setScreen('driving');
              console.log('Auto-starting driving mode');
            }
          } else {
            // 安定化中 - 進捗を表示
            const progressPercent = (stabilityCheck.progress * 100).toFixed(0);
            setDebugInfo(`${handInfo} | 足を固定してください... ${progressPercent}%`);

            // 初回の場合、キャリブレーション段階を'waiting_for_brake'に設定
            if (currentCalibrationStage === 'idle') {
              setCalibrationStage('waiting_for_brake');
            }
          }
        } else {
          setDebugInfo(`${handInfo} | 足が検出できません。椅子に座ってください`);
        }
      } else {
        setDebugInfo(`${handInfo} | 足が検出できません`);
      }
    } else if (currentCalibrationStage === 'calibrated' && currentFootCalibration && currentFootCalibration.isCalibrated) {
      // キャリブレーション完了 - ペダル認識を実行
      if (filteredLandmarks) {
        // 画面が'driving'の場合のみペダル認識を実行
        const screen = useDrivingStore.getState().screen;
        if (screen === 'driving') {
          const recognitionResult = processPedalRecognition(
            filteredLandmarks,
            currentFootCalibration,
            currentPedalState,
            deltaTime
          );

          // キャリブレーションを更新（アクセル踏み込み位置の記録）
          setFootCalibration(recognitionResult.updatedCalibration);

          // ペダル状態を更新
          updatePedalState(recognitionResult.pedalState);

          // デバッグ情報を更新
          const { throttle, brake, isAccelPressed, isBrakePressed } = recognitionResult.pedalState;
          setDebugInfo(
            `${handInfo} | Accel: ${isAccelPressed ? 'ON' : 'OFF'} (${(throttle * 100).toFixed(0)}%) | ` +
            `Brake: ${isBrakePressed ? 'ON' : 'OFF'} (${(brake * 100).toFixed(0)}%)`
          );
        } else {
          // 運転画面以外ではペダル状態をリセット
          updatePedalState({
            throttle: 0,
            brake: 0,
            isAccelPressed: false,
            isBrakePressed: false,
            brakePressDuration: 0,
            brakePressCount: 0,
          });
          setDebugInfo(`${handInfo} | キャリブレーション完了`);
        }
      } else {
        setDebugInfo(`${handInfo} | 足が検出できません`);
      }
    } else {
      setDebugInfo(handInfo);
    }
  };

  // 状態説明テキストの生成（storeから直接取得して最新の状態を使用）
  const debugInfo = useDrivingStore(state => state.debugInfo);
  const calibrationStage = useDrivingStore(state => state.calibrationStage);
  const pedalState = useDrivingStore(state => state.pedalState);
  const footCalibration = useDrivingStore(state => state.footCalibration);

  // 進捗パーセンテージを抽出
  const getProgressFromDebugInfo = () => {
    const match = debugInfo.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  };

  const getStatusDisplay = () => {
    if (calibrationStage === 'waiting_for_brake') {
      const progress = getProgressFromDebugInfo();
      return {
        title: '⚠️ 足を固定中...',
        message: `5秒間足を動かさないでください (${progress}%)`,
        color: '#FFFF00',
        bgColor: 'rgba(255, 255, 0, 0.2)'
      };
    } else if (calibrationStage === 'calibrated' && footCalibration?.isCalibrated) {
      if (pedalState.isBrakePressed) {
        return {
          title: '🔴 ブレーキ',
          message: `制動力: ${(pedalState.brake * 100).toFixed(0)}%`,
          color: '#FF0000',
          bgColor: 'rgba(255, 0, 0, 0.2)'
        };
      } else if (pedalState.isAccelPressed) {
        return {
          title: '🟢 アクセル',
          message: `スロットル: ${(pedalState.throttle * 100).toFixed(0)}%`,
          color: '#00FF00',
          bgColor: 'rgba(0, 255, 0, 0.2)'
        };
      } else {
        return {
          title: '⚪ 待機中',
          message: 'ペダル操作なし',
          color: '#FFFFFF',
          bgColor: 'rgba(255, 255, 255, 0.1)'
        };
      }
    } else {
      return {
        title: '📷 カメラ起動中',
        message: debugInfo,
        color: '#FFFFFF',
        bgColor: 'rgba(0, 0, 0, 0.8)'
      };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        opacity: 0.9,
    }}>
        <video ref={videoRef} style={{ position: 'absolute', opacity: 0, zIndex: -1 }} autoPlay playsInline muted></video>

        <div style={{
          position: "relative",
          width: "280px",
          height: "210px",
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
            <canvas ref={canvasRef} style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'black',
                transform: 'scaleX(-1)'
            }} />
        </div>

        {/* 状態表示パネル */}
        <div style={{
            backgroundColor: statusDisplay.bgColor,
            backdropFilter: 'blur(10px)',
            border: `2px solid ${statusDisplay.color}`,
            color: statusDisplay.color,
            fontSize: '14px',
            fontWeight: 'bold',
            padding: '12px 16px',
            marginTop: '8px',
            borderRadius: '8px',
            width: '280px',
            boxSizing: 'border-box',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
            <div style={{
                fontSize: '16px',
                marginBottom: '4px',
                textAlign: 'center'
            }}>
                {statusDisplay.title}
            </div>
            <div style={{
                fontSize: '12px',
                textAlign: 'center',
                opacity: 0.9
            }}>
                {statusDisplay.message}
            </div>
        </div>

        {/* 操作説明（デバッグ情報） */}
        <div style={{
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            fontSize: '10px',
            padding: '6px 8px',
            marginTop: '4px',
            borderRadius: '4px',
            width: '280px',
            boxSizing: 'border-box',
            fontFamily: 'monospace',
            textAlign: 'center'
        }}>
            {debugInfo}
        </div>
    </div>
  );
}
