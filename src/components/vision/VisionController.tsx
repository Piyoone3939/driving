"use client";

import { useEffect, useRef, useCallback } from "react";
import { FilesetResolver, FaceLandmarker, HandLandmarker, DrawingUtils, HandLandmarkerResult, PoseLandmarker, PoseLandmarkerResult, ObjectDetector, ObjectDetectorResult } from "@mediapipe/tasks-vision";
import { useDrivingStore } from "@/lib/store";
import { processPedalRecognition, checkFootStability } from "@/lib/footPedalRecognition";
import { PoseLandmarkFilterManager } from "@/lib/oneEuroFilter";

export default function VisionController({ isPaused }: { isPaused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Store actions
  const setHeadRotation = useDrivingStore((state) => state.setHeadRotation);
  const setSteering = useDrivingStore((state) => state.setSteering);
  const setVisionReady = useDrivingStore((state) => state.setVisionReady);
  const setDebugInfo = useDrivingStore((state) => state.setDebugInfo);
  const setSpeed = useDrivingStore((state => state.setSpeed));
  const setFootCalibration = useDrivingStore((state) => state.setFootCalibration);
  const updatePedalState = useDrivingStore((state) => state.updatePedalState);
  const setCalibrationStage = useDrivingStore((state) => state.setCalibrationStage);
  const setScreen = useDrivingStore((state) => state.setScreen);
  const setGaze = useDrivingStore((state) => state.setGaze); // Gaze action
  const gear = useDrivingStore((state) => state.gear);
  const setGear = useDrivingStore((state) => state.setGear);


  // References
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const objectDetectorRef = useRef<ObjectDetector | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // 最後の描画時間lastProcessingTimeRefを使用して、経過時間がTHROTTLE_MSいないなら、
  // MediaPipeに寄る座標の取得や描画を行わない実装であると、秒数当たりに取得できるデータ点が少なく、動きがスムーズにならないため一時的に廃止

  // const lastProcessingTimeRef = useRef<number>(0);
  // const THROTTLE_MS = 100;

  // 1ユーロフィルタマネージャー
  const poseFilterManagerRef = useRef<PoseLandmarkFilterManager>(
    new PoseLandmarkFilterManager(1.0, 0.004, 1.5)
  );
  const streamRef = useRef<MediaStream | null>(null); // ストリーム管理用

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;

    if(isPaused){
      setSteering(0);
      setSpeed(0);
      setDebugInfo("Paused");
    }
  }, [isPaused, setSteering, setSpeed, setDebugInfo]);

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

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        streamRef.current = stream;

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
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

        objectDetectorRef.current = await ObjectDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
            delegate: "GPU"
          },
          scoreThreshold: 0.3,
          runningMode: "VIDEO"
        });

        setDebugInfo("Models loaded. Starting Camera...");
        setVisionReady(true);

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
  


  // Gear Logic State
  const gearHoverStartTimeRef = useRef<number | null>(null);
  const gearLockRef = useRef<boolean>(false); // Prevent multiple toggles while holding

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

    if (isPausedRef.current) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return; 
    }

    if (faceLandmarkerRef.current && handLandmarkerRef.current && poseLandmarkerRef.current && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime !== lastVideoTimeRef.current) {
      // eslint-disable-next-line react-hooks/purity
        const startTimeMs = performance.now();
         
        const deltaTime = lastFrameTimeRef.current === 0 ? 16 : startTimeMs - lastFrameTimeRef.current;
        lastFrameTimeRef.current = startTimeMs;
        lastVideoTimeRef.current = video.currentTime;

        try {
            const drawingUtils = ctx ? new DrawingUtils(ctx) : null;

            // 1. Pose Detection (Used for Gear & Foot)
            const poseResult = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);

            // 2. Face Detection
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
                 if(drawingUtils) {
                    for (const landmarks of faceResult.faceLandmarks) {
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
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

                    // Gaze Calculation
                    const leftInner = landmarks[33].x;
                    const leftOuter = landmarks[133].x;
                    const leftIris = landmarks[468].x;
                    
                    const rightInner = landmarks[362].x;
                    const rightOuter = landmarks[263].x;
                    const rightIris = landmarks[473].x;
                    
                    const leftRatio = (leftIris - leftInner) / (leftOuter - leftInner);
                    const rightRatio = (rightIris - rightInner) / (rightOuter - rightInner);
                    
                    const avgRatio = (leftRatio + rightRatio) / 2;
                    const gazeX = (avgRatio - 0.5) * 5; 
                    setGaze({ x: gazeX, y: 0 });
                }
            }

            // 3. Object Detection
            const objectResult = objectDetectorRef.current
                ? objectDetectorRef.current.detectForVideo(video, startTimeMs)
                : null;

            // 4. Hand Detection
            const handResult = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (handResult.landmarks && drawingUtils) {
                for (const landmarks of handResult.landmarks) {
                    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {color: "#00FF00", lineWidth: 3});
                    drawingUtils.drawLandmarks(landmarks, {color: "#FF0000", lineWidth: 2});
                }
            }
            
            // 5. Process Steering & Gear (Now using Pose)
            const handInfo = processSteeringAndGear(handResult, objectResult, poseResult);

            // 6. Process Foot Pedals
            if (poseResult) {
                processPoseForPedals(poseResult, deltaTime, drawingUtils, handInfo);
            }
        } catch (e) {
            console.error(e);
        }
    }

    // 次のフレームを要求
    requestRef.current = requestAnimationFrame(predictWebcam);
  };


  const processSteeringAndGear = (handResult: HandLandmarkerResult, objectResult: ObjectDetectorResult | null, poseResult: PoseLandmarkerResult | null) => {
      const hands = handResult.landmarks.length;
      let info = `Hands: ${hands}`;
      
      // --- Gear Logic (Pose Based & Timer Latch) ---
      let isHoveringGear = false;
      let poseLeftHip = null;
      let shoulderWidth = 0;

      // Determine Zone from Pose
      if (poseResult && poseResult.landmarks.length > 0) {
          const pose = poseResult.landmarks[0];
          const leftHip = pose[23]; // LEFT_HIP
          const leftShoulder = pose[11];
          const rightShoulder = pose[12];
          
          if (leftHip && leftShoulder && rightShoulder) {
              poseLeftHip = leftHip;
              // Calculate shoulder width in screen coords
              shoulderWidth = Math.sqrt(Math.pow(leftShoulder.x - rightShoulder.x, 2) + Math.pow(leftShoulder.y - rightShoulder.y, 2));
          }
      }

      let gearHandIndex = -1;
      
      // Check if any hand is in the "Gear Zone"
      if (poseLeftHip) {
          for (let i = 0; i < hands; i++) {
            const h = handResult.landmarks[i];
            const wrist = h[0];

            // Condition: 
            // 1. Same height as hip (tolerance 0.15)
            // 2. Distance from hip approx Shoulder Width (tolerance range)
            const distY = Math.abs(wrist.y - poseLeftHip.y);
            const distX = Math.abs(wrist.x - poseLeftHip.x); // Check abs distance horizontally

            // Zone Def: Height matches (+/- 0.15), Distance is roughly Shoulder Width (0.5x ~ 1.5x)
            // If user mimics holding a gear stick to the side.
            if (distY < 0.2 && distX > shoulderWidth * 0.5 && distX < shoulderWidth * 2.0) {
                isHoveringGear = true;
                // Visualize Gear Hand
                gearHandIndex = i;
                info += ` [GearHand Detected]`;
                break;
            } else {
                // Debug near misses
                 // if (distY < 0.3) info += ` | dX:${distX.toFixed(2)} dY:${distY.toFixed(2)} W:${shoulderWidth.toFixed(2)}`;
            }
          }
      } else {
          // Fallback if no pose: Use screen coordinates (Legacy)
          // Only if strictly needed, but user wants relative stability.
          // For now, if no pose, we skip gear logic to avoid instability.
          info += " (No Pose: Sit back?)";
      }

      // Debug: Show why it might be failing
      if (poseLeftHip) {
           // info += ` | HipY:${poseLeftHip.y.toFixed(2)}`;
      }

      // Timer Logic
      const GEAR_HOLD_TIME = 4000; // 4 seconds to confirm
      const currentTime = performance.now();

      if (isHoveringGear) {
          if (gearHoverStartTimeRef.current === null) {
              gearHoverStartTimeRef.current = currentTime;
              gearLockRef.current = false;
          }

          const elapsed = currentTime - gearHoverStartTimeRef.current;
          const progress = Math.min(elapsed / GEAR_HOLD_TIME, 1.0);
          
          info += ` | GearHold: ${(progress * 100).toFixed(0)}%`;

          if (elapsed >= GEAR_HOLD_TIME && !gearLockRef.current) {
              // Trigger Toggle
              const currentGear = useDrivingStore.getState().gear;
              const newGear = currentGear === "D" ? "R" : "D";
              setGear(newGear);
              gearLockRef.current = true; // Lock until exit
              
              // Feedback sound/effect could go here
              console.log("GEAR SHIFTED:", newGear);
          }
           if (gearLockRef.current) {
              info += ` -> LOCKED`;
          }

      } else {
          gearHoverStartTimeRef.current = null;
          gearLockRef.current = false;
      }
      
      const currentGear = useDrivingStore.getState().gear;
      info += ` | Gear: ${currentGear}`;
      
      // --- Steering Logic ---
      // Use hands that are NOT the gear hand.
      let steeringHands = [];
      for (let i = 0; i < hands; i++) {
          if (i !== gearHandIndex) {
              steeringHands.push(handResult.landmarks[i]);
          }
      }
      
      let steering = 0;
      let angle = 0;
      
      if (steeringHands.length >= 2) {
          // Two-Hand Steering
          const h1 = steeringHands[0][9];
          const h2 = steeringHands[1][9];
          
          let left, right;
          if (h1.x < h2.x) { left = steeringHands[0][9]; right = steeringHands[1][9]; }
          else { left = steeringHands[1][9]; right = steeringHands[0][9]; }
          
          const dy = right.y - left.y;
          const dx = right.x - left.x;
          angle = Math.atan2(dy, dx);
          
          const sensitivity = 0.8;
          steering = -angle * sensitivity;
          
      } else if (steeringHands.length === 1) {
          // Single-Hand Steering
          const wrist = steeringHands[0][0];
          const middle = steeringHands[0][9];
          
          const dy = middle.y - wrist.y;
          const dx = middle.x - wrist.x;
          
          const handAngle = Math.atan2(dy, dx);
          const neutralAngle = -Math.PI / 2;
          
          let diff = handAngle - neutralAngle;
          if (diff > Math.PI) diff -= 2 * Math.PI;
          if (diff < -Math.PI) diff += 2 * Math.PI;
          
          const oneHandSensitivity = 1.5;
          steering = diff * oneHandSensitivity;
          angle = diff; 
          
      } else {
          steering = 0;
      }
      
      const deadzone = 0.05;
      if (Math.abs(steering) < deadzone) steering = 0;
      steering = Math.max(-1, Math.min(1, steering));
      
      setSteering(steering);
      
      info += ` | Str: ${steering.toFixed(2)}`;
      
      if (objectResult && objectResult.detections.length > 0) {
          const det = objectResult.detections[0];
          const cat = det.categories[0];
          if (cat) info += ` | Obj: ${cat.categoryName}`;
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
      // GearHoldの進捗があれば表示
      const gearHoldMatch = debugInfo.match(/GearHold: \d+%/);
      const gearHoldText = gearHoldMatch ? `\n${gearHoldMatch[0]}` : '';

      // ギアによるスタイル分岐
      const isReverse = gear === 'R';
      const gearLabel = isReverse ? '【 R: バック 】' : '【 D: ドライブ 】';
      const gearColor = isReverse ? '#d946ef' : '#FFFFFF'; // Reverse = Purple, Drive = White (default status)
      
      // ベースの色（ペダル操作があればそれを優先、なければギア色）
      let baseTitle = isReverse ? '⚠️ バック中' : '⚪ 待機中';
      let baseColor = isReverse ? '#d946ef' : '#FFFFFF'; 
      let baseBg = isReverse ? 'rgba(217, 70, 239, 0.2)' : 'rgba(255, 255, 255, 0.1)';

      if (pedalState.isBrakePressed) {
          baseTitle = '🔴 ブレーキ';
          baseColor = '#FF0000';
          baseBg = 'rgba(255, 0, 0, 0.2)';
      } else if (pedalState.isAccelPressed) {
          baseTitle = '🟢 アクセル';
          baseColor = '#00FF00';
          baseBg = 'rgba(0, 255, 0, 0.2)';
      }

      // Reverseの場合は枠線を強調
      const borderColor = isReverse ? '#d946ef' : baseColor;
      
      return {
          title: `${baseTitle} ${gearLabel}`,
          message: `スロットル: ${(pedalState.throttle * 100).toFixed(0)}% | ブレーキ: ${(pedalState.brake * 100).toFixed(0)}%${gearHoldText}`,
          color: baseColor,
          bgColor: baseBg,
          borderColor: borderColor // Custom prop to handle border separately
      };

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

        {/* 状態表示パネル */}
        <div style={{
            backgroundColor: statusDisplay.bgColor,
            backdropFilter: 'blur(10px)',
            border: `4px solid ${statusDisplay.borderColor || statusDisplay.color}`, // 太くする
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
                opacity: 0.9,
                whiteSpace: 'pre-wrap' 
            }}>
                {statusDisplay.message}
            </div>
        </div>
    </div>
  );
}