"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { FilesetResolver, FaceLandmarker, HandLandmarker, DrawingUtils, HandLandmarkerResult, PoseLandmarker, PoseLandmarkerResult, ObjectDetector, ObjectDetectorResult } from "@mediapipe/tasks-vision";
import { useDrivingStore } from "@/lib/store";
import { processPedalRecognition, checkFootStability } from "@/lib/footPedalRecognition";
import { PoseLandmarkFilterManager } from "@/lib/oneEuroFilter";
import { classifyCameraFailure, getRecoveryCopy, getRecoveryRetryAction, RecoveryKind } from "@/lib/onboardingRecovery";

// How often (ms) the per-frame status string is allowed to be written to the
// store. The detection loop runs at display rate; the human-readable panel only
// needs to refresh a few times per second.
const DEBUG_THROTTLE_MS = 150;

export default function VisionController({
  isPaused,
  onKeyboardFallback,
}: {
  isPaused: boolean;
  onKeyboardFallback?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // User-facing camera error (denied / unavailable / unsupported). When set, an
  // overlay explains the problem and offers a retry + keyboard-control fallback.
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recoveryKind, setRecoveryKind] = useState<RecoveryKind>("camera-error");
  const [isSettingUpVision, setIsSettingUpVision] = useState(false);

  // Store actions
  const setHeadRotation = useDrivingStore((state) => state.setHeadRotation);
  const setSteering = useDrivingStore((state) => state.setSteering);
  const setVisionReady = useDrivingStore((state) => state.setVisionReady);
  const setDebugInfo = useDrivingStore((state) => state.setDebugInfo);
  const setSpeed = useDrivingStore((state => state.setSpeed));
  const setFootCalibration = useDrivingStore((state) => state.setFootCalibration);
  const updatePedalState = useDrivingStore((state) => state.updatePedalState);
  const setCalibrationStage = useDrivingStore((state) => state.setCalibrationStage);
  const setGaze = useDrivingStore((state) => state.setGaze); // Gaze action
  const setGear = useDrivingStore((state) => state.setGear);
  const activateKeyboardPedalFallback = useDrivingStore((state) => state.activateKeyboardPedalFallback);
  const language = useDrivingStore((state) => state.language);


  // References
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const objectDetectorRef = useRef<ObjectDetector | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Reused DrawingUtils instance (created once) instead of allocating a new one
  // every frame. Tied to the canvas 2D context, which is stable.
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  // Throttle for per-frame status (debug) string writes to the store.
  const lastDebugTimeRef = useRef<number>(0);

  // Using lastProcessingTimeRef to skip MediaPipe coordinate retrieval and
  // drawing while the elapsed time is under THROTTLE_MS resulted in too few
  // data points per second, making the motion choppy, so it is temporarily
  // disabled.

  // const lastProcessingTimeRef = useRef<number>(0);
  // const THROTTLE_MS = 100;

  // One Euro filter manager
  const poseFilterManagerRef = useRef<PoseLandmarkFilterManager>(
    new PoseLandmarkFilterManager(1.0, 0.004, 1.5)
  );
  const streamRef = useRef<MediaStream | null>(null); // Stream management
  const isMountedRef = useRef(true);
  // Ref-indirection so startCamera's useCallback can invoke the loop without
  // capturing predictWebcam as a dependency (the function is declared below).
  const predictWebcamRef = useRef<() => void>(() => {});

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;

    if(isPaused){
      setSteering(0);
      setSpeed(0);
      setDebugInfo("Paused");
    }
  }, [isPaused, setSteering, setSpeed, setDebugInfo]);

  // Per-frame status updates go through this so the React panel re-renders a few
  // times per second instead of on every detection frame.
  const setDebugInfoThrottled = useCallback((info: string) => {
    const now = performance.now();
    if (now - lastDebugTimeRef.current < DEBUG_THROTTLE_MS) return;
    lastDebugTimeRef.current = now;
    setDebugInfo(info);
  }, [setDebugInfo]);

  // Function to stop the camera (physically disconnect)
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop(); // This is the command that turns off the camera light
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // Stop the loop
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = 0;
    }

    // Fill the screen with solid black
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
    setDebugInfo("Camera Stopped (Paused)");
  }, [setDebugInfo]);

  const activateKeyboardFallback = useCallback(() => {
    activateKeyboardPedalFallback();
    onKeyboardFallback?.();
    setCameraError(null);
  }, [activateKeyboardPedalFallback, onKeyboardFallback, setCameraError]);

  // Function to start the camera
  const startCamera = useCallback(async () => {
    try {
        // Wait if the AI models are not ready yet (they should normally be loaded)
        if (!faceLandmarkerRef.current || !handLandmarkerRef.current) {
            console.log("Waiting for models...");
            return;
        }

        // Browser without camera API support (e.g. insecure context / old browser).
        if (!navigator.mediaDevices?.getUserMedia) {
            setRecoveryKind("camera-error");
            setCameraError("This browser does not support the camera. You can drive with the keyboard (use the arrow keys to steer).");
            setDebugInfo("Camera not supported");
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        streamRef.current = stream;
        setCameraError(null);

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Use a single onloadeddata handler. (Previously the loop was also
            // registered via addEventListener, which started a second
            // requestAnimationFrame loop and doubled the per-frame work.)
            videoRef.current.onloadeddata = () => {
                videoRef.current?.play();
                // Cancel any in-flight loop before starting a fresh one so loops
                // never stack across start/stop cycles.
                if (requestRef.current) cancelAnimationFrame(requestRef.current);
                predictWebcamRef.current();
            };
        }
        setDebugInfo("Camera Started");
    } catch (e) {
        console.error("Camera Error:", e);
        const denied = classifyCameraFailure(e) === "denied";
        setRecoveryKind(denied ? "camera-denied" : "camera-error");
        setCameraError(
            denied
                ? "Camera access was denied. Allow it in your browser settings, or drive with the keyboard (use the arrow keys to steer)."
                : "The camera could not be started. You can also drive with the keyboard (use the arrow keys to steer)."
        );
        setDebugInfo("Camera Error: " + String(e));
    }
  }, [setDebugInfo, setCameraError]); // Do not add predictWebcam to the dependencies (it loops)

  // Initialization (loading MediaPipe)
  const setupMediaPipe = useCallback(async () => {
      setIsSettingUpVision(true);
      setCameraError(null);
      setDebugInfo("Loading AI Models...");

      // Release partially-created resources before a manual retry.
      faceLandmarkerRef.current?.close();
      handLandmarkerRef.current?.close();
      poseLandmarkerRef.current?.close();
      objectDetectorRef.current?.close();
      faceLandmarkerRef.current = null;
      handLandmarkerRef.current = null;
      poseLandmarkerRef.current = null;
      objectDetectorRef.current = null;

      let faceLandmarker: FaceLandmarker | null = null;
      let handLandmarker: HandLandmarker | null = null;
      let poseLandmarker: PoseLandmarker | null = null;
      let objectDetector: ObjectDetector | null = null;
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
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

        poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            // 'full' over 'lite': markedly better on distant / low-contrast
            // bodies (e.g. dark clothing) at a moderate GPU cost. Swap to
            // 'heavy' for more accuracy, or back to 'lite' if framerate drops.
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          // Lowered 0.5 -> 0.3 so legs/feet keep tracking in poor conditions
          // (distance, dark clothing). Smoothing downstream absorbs the jitter.
          minPoseDetectionConfidence: 0.3,
          minPosePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3
        });

        objectDetector = await ObjectDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
            delegate: "GPU"
          },
          scoreThreshold: 0.3,
          runningMode: "VIDEO"
        });

        if (!isMountedRef.current) {
          faceLandmarker.close();
          handLandmarker.close();
          poseLandmarker.close();
          objectDetector.close();
          return;
        }

        faceLandmarkerRef.current = faceLandmarker;
        handLandmarkerRef.current = handLandmarker;
        poseLandmarkerRef.current = poseLandmarker;
        objectDetectorRef.current = objectDetector;
        setVisionReady(true);
        setDebugInfo("Models Ready.");

        // On first load or manual retry, start the camera if not paused.
        if (!isPausedRef.current) {
            await startCamera();
        }
      } catch (error) {
        console.error(error);
        faceLandmarker?.close();
        handLandmarker?.close();
        poseLandmarker?.close();
        objectDetector?.close();
        faceLandmarkerRef.current = null;
        handLandmarkerRef.current = null;
        poseLandmarkerRef.current = null;
        objectDetectorRef.current = null;
        setVisionReady(false);
        setRecoveryKind("vision-error");
        setCameraError("Vision setup failed. Retry vision setup or use keyboard pedals to continue.");
        setDebugInfo("Vision setup error: " + String(error));
      } finally {
        setIsSettingUpVision(false);
      }
  }, [setCameraError, setDebugInfo, setVisionReady, startCamera]);

  const retryRecovery = useCallback(() => {
    setCameraError(null);
    if (getRecoveryRetryAction(recoveryKind) === "vision-retry") {
      void setupMediaPipe();
    } else {
      void startCamera();
    }
  }, [recoveryKind, setCameraError, setupMediaPipe, startCamera]);

  useEffect(() => {
    isMountedRef.current = true;
    void setupMediaPipe();

    return () => {
        isMountedRef.current = false;
        stopCamera(); // Make sure to stop on unmount
        // Release MediaPipe model resources to avoid leaking GPU/WASM contexts.
        faceLandmarkerRef.current?.close();
        handLandmarkerRef.current?.close();
        poseLandmarkerRef.current?.close();
        objectDetectorRef.current?.close();
        faceLandmarkerRef.current = null;
        handLandmarkerRef.current = null;
        poseLandmarkerRef.current = null;
        objectDetectorRef.current = null;
        drawingUtilsRef.current = null;
    };
  }, [setupMediaPipe, stopCamera]);

  // Turn the camera on/off in response to changes in isPaused
  useEffect(() => {

    // Ignore if MediaPipe has not finished loading (leave it to the load-completion handler)
    if (!faceLandmarkerRef.current) return;

    if (isPaused) {
        stopCamera();
    } else {
        startCamera();
    }
  }, [isPaused, startCamera, stopCamera]);
  


  // AI inference loop
  const predictWebcam = () => {
    // End the loop if a stop has been requested
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (video.videoWidth > 0 && ctx) {
         if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
             canvas.width = video.videoWidth;
             canvas.height = video.videoHeight;
         }
         // Draw the video (no filter, sharp)
         ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    }

    if (isPausedRef.current) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return; 
    }
    // const now = performance.now();
    // if (now - lastProcessingTimeRef.current < THROTTLE_MS){
    //   requestRef.current = requestAnimationFrame(predictWebcam);
    //   return;
    // }
    // lastProcessingTimeRef.current = now;

    if (faceLandmarkerRef.current && handLandmarkerRef.current && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime !== lastVideoTimeRef.current) {
        const startTimeMs = performance.now();
         
        const deltaTime = lastFrameTimeRef.current === 0 ? 16 : startTimeMs - lastFrameTimeRef.current;
        lastFrameTimeRef.current = startTimeMs;
        lastVideoTimeRef.current = video.currentTime;

        try {
            // Reuse a single DrawingUtils instead of allocating one every frame.
            if (ctx && !drawingUtilsRef.current) {
                drawingUtilsRef.current = new DrawingUtils(ctx);
            }
            const drawingUtils = drawingUtilsRef.current;

            // Face Detection
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

            // Object Detection
            const objectResult = objectDetectorRef.current
                ? objectDetectorRef.current.detectForVideo(video, startTimeMs)
                : null;

            // Hand Detection
            const handResult = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (handResult.landmarks && drawingUtils) {
                for (const landmarks of handResult.landmarks) {
                    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {color: "#00FF00", lineWidth: 3});
                    drawingUtils.drawLandmarks(landmarks, {color: "#FF0000", lineWidth: 2});
                }
            }
            const handInfo = processSteeringAndGear(handResult, objectResult);

            // Run Pose Detection for Foot Pedal Recognition
            const poseResult = poseLandmarkerRef.current 
                ? poseLandmarkerRef.current.detectForVideo(video, startTimeMs) 
                : null;
            if (poseResult) {
                processPoseForPedals(poseResult, deltaTime, drawingUtils, handInfo);
            }
        } catch (e) {
            console.error(e);
        }
    }

    // Request the next frame
    requestRef.current = requestAnimationFrame(predictWebcam);
  };
  // Keep the ref current so startCamera (declared above) can call this without
  // capturing it as a dependency. Assigning during render is safe for refs.
  predictWebcamRef.current = predictWebcam;


  const processSteeringAndGear = (handResult: HandLandmarkerResult, objectResult: ObjectDetectorResult | null) => {
      const hands = handResult.landmarks.length;
      let info = `Hands: ${hands}`;
      
      // --- Gear Logic ---
      // Define Gear Zone: Right side of the screen, lower half.
      // x: 0.8 ~ 1.0, y: 0.5 ~ 1.0
      // If a hand is in this zone, we shift to REVERSE.
      // Otherwise, we shift to DRIVE (default).
      
      let newGear: "D" | "R" = "D";
      let gearHandIndex = -1;
      
      for (let i = 0; i < hands; i++) {
          const landmarks = handResult.landmarks[i];
          const wrist = landmarks[0];
          
          if (wrist.x > 0.8 && wrist.y > 0.5) {
              newGear = "R";
              gearHandIndex = i;
              break; // Found a gear hand
          }
      }
      
      // Update Gear Store (avoid frequent updates if same)
      const currentGear = useDrivingStore.getState().gear;
      if (currentGear !== newGear) {
          setGear(newGear);
      }
      info += ` | Gear: ${newGear}`;
      
      // --- Steering Logic ---
      // Use hands that are NOT the gear hand.
      const steeringHands = [];
      for (let i = 0; i < hands; i++) {
          if (i !== gearHandIndex) {
              steeringHands.push(handResult.landmarks[i]);
          }
      }
      
      let steering = 0;
      let angle = 0;
      
      if (steeringHands.length >= 2) {
          // Two-Hand Steering (Standard)
          // Sort by x coordinate to distinguish left/right
          const h1 = steeringHands[0][9]; // Middle finger MCP
          const h2 = steeringHands[1][9];
          
          let left, right;
          if (h1.x < h2.x) { left = steeringHands[0][9]; right = steeringHands[1][9]; }
          else { left = steeringHands[1][9]; right = steeringHands[0][9]; }
          
          const dy = right.y - left.y;
          const dx = right.x - left.x;
          angle = Math.atan2(dy, dx);
          
          // Sensitivity adjustments
          const sensitivity = 0.8;
          steering = -angle * sensitivity;
          
      } else if (steeringHands.length === 1) {
          // Single-Hand Steering (One Hand Detected or One Hand Shifting)
          // Calculate tilt of the single hand.
          // Using Wrist (0) and Middle Finger MCP (9)
          const wrist = steeringHands[0][0];
          const middle = steeringHands[0][9];
          
          const dy = middle.y - wrist.y;
          const dx = middle.x - wrist.x;
          
          // Upright (Straight) is -90 degrees (-PI/2).
          // We want deviation from -PI/2.
          const handAngle = Math.atan2(dy, dx);
          const neutralAngle = -Math.PI / 2;
          
          let diff = handAngle - neutralAngle;
          
          // Normalize to -PI to PI
          if (diff > Math.PI) diff -= 2 * Math.PI;
          if (diff < -Math.PI) diff += 2 * Math.PI;
          
          // Sensitivity for single hand
          const oneHandSensitivity = 1.5;
          steering = diff * oneHandSensitivity;
          angle = diff; 
          
      } else {
          // No hands for steering
          steering = 0;
      }
      
      // Clamp
      const deadzone = 0.05;
      if (Math.abs(steering) < deadzone) steering = 0;
      steering = Math.max(-1, Math.min(1, steering));
      
      // Update Steering Store
      setSteering(steering);
      
      info += ` | Str: ${steering.toFixed(2)}`;
      
      // Object Detection Info (Optional Display)
      if (objectResult && objectResult.detections.length > 0) {
          const det = objectResult.detections[0];
          const cat = det.categories[0];
          if (cat) info += ` | Obj: ${cat.categoryName}`;
      }
      
      return info;
  };

  const processPoseForPedals = (result: PoseLandmarkerResult, deltaTime: number, drawingUtils: DrawingUtils | null, handInfo: string) => {
    // Keyboard pedal mode: do not let the camera touch the pedals, so the
    // keyboard's setPedals() stays authoritative. Fallback for users whose
    // legs/feet can't be tracked (distance, dark clothing). Steering still uses
    // the camera. See docs/superpowers/plans/0004-keyboard-pedal-fallback.md.
    if (useDrivingStore.getState().pedalInputMode === 'keyboard') return;

    // Draw the pose landmarks
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    // Filter the landmarks with the One Euro filter
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
      // Use the filtered landmarks
      filteredLandmarks = filtered;
    }

    // Read the latest state directly from the store
    const currentCalibrationStage: 'idle' | 'waiting_for_brake' | 'calibrated' = useDrivingStore.getState().calibrationStage;
    const currentPedalState = useDrivingStore.getState().pedalState;
    const currentFootCalibration = useDrivingStore.getState().footCalibration;

    // Decide the color based on the state
    let footColor = "#0000FF"; // Default: blue (normal)
    let landmarkColor = "#8080FF"; // Default: light blue

    if (currentCalibrationStage === 'waiting_for_brake') {
      // During calibration - vary the brightness of the color with the progress
      if (currentFootCalibration && currentFootCalibration.stabilityCheckStartTime) {
        const currentTime = performance.now();
        const elapsed = currentTime - currentFootCalibration.stabilityCheckStartTime;
        const progress = Math.min(elapsed / 5000, 1.0);

        // Approach green as the progress increases (0%: yellow, 100%: green)
        const r = Math.floor(255 * (1 - progress));
        const g = 255;
        const b = 0;
        footColor = `rgb(${r}, ${g}, ${b})`;
        landmarkColor = `rgb(${Math.min(r + 80, 255)}, ${g}, ${Math.min(b + 80, 255)})`;
      } else {
        footColor = "#FFFF00"; // Yellow (before calibration starts)
        landmarkColor = "#FFFF80";
      }
    } else if (currentCalibrationStage === 'calibrated' && currentPedalState && currentFootCalibration?.isCalibrated) {
      if (currentPedalState.isBrakePressed) {
        footColor = "#FF0000"; // Red (brake ON)
        landmarkColor = "#FF8080";
      } else if (currentPedalState.isAccelPressed) {
        footColor = "#00FF00"; // Green (accelerator ON)
        landmarkColor = "#80FF80";
      } else {
        footColor = "#0000FF"; // Blue (idle)
        landmarkColor = "#8080FF";
      }
    } else {
      // Other states (e.g. before calibration)
      footColor = "#888888"; // Gray
      landmarkColor = "#AAAAAA";
    }

    if (filteredLandmarks && ctx && canvas) {
      const landmarks = filteredLandmarks;

      // Draw only the right leg (hip and below the knee)
      // 23 (left hip), 24 (right hip), 26 (right knee), 28 (right ankle), 30 (right heel), 32 (right foot index)
      const rightFootConnections = [
        [24, 26], // Right hip -> right knee
        [26, 28], // Right knee -> right ankle
        [28, 30], // Right ankle -> right heel
        [30, 32], // Right heel -> right foot index
      ];

      // Connect the right-leg landmarks with lines (color based on the state)
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

      // Draw the right-leg and hip landmarks (color based on the state)
      const rightFootLandmarkIndices = [23, 24, 26, 28, 30, 32]; // Left hip, right hip, right knee, right ankle, right heel, right foot index
      if (drawingUtils) {
        const footLandmarks = rightFootLandmarkIndices.map(i => landmarks[i]).filter(Boolean);
        if (footLandmarks.length > 0) {
          drawingUtils.drawLandmarks(footLandmarks, {color: landmarkColor, lineWidth: 3, radius: 4});
        }
      }
    }


    // Handling based on the calibration stage
    if (['idle', 'waiting_for_brake'].includes(currentCalibrationStage)) {
      // During calibration - check foot-position stability over 5 seconds
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
            // Calibration is complete if the foot stayed stable for 5 seconds
            setCalibrationStage('calibrated');
            setDebugInfoThrottled(`${handInfo} | Foot calibration complete!`);
            // NOTE: do NOT auto-navigate to the driving screen here. This callback
            // also runs during the tutorial (which mounts VisionController), and
            // forcing setScreen('driving') yanked the user out of the tutorial
            // mid-step. Screen transitions are owned by the UI, not this loop.
          } else {
            // Stabilizing - show the progress
            const progressPercent = (stabilityCheck.progress * 100).toFixed(0);
            setDebugInfoThrottled(`${handInfo} | Please keep your foot still... ${progressPercent}%`);

            // On the first pass, set the calibration stage to 'waiting_for_brake'
            if (currentCalibrationStage === 'idle') {
              setCalibrationStage('waiting_for_brake');
            }
          }
        } else {
          setDebugInfoThrottled(`${handInfo} | Foot not detected. Please sit in the chair`);
        }
      } else {
        setDebugInfoThrottled(`${handInfo} | Foot not detected`);
      }
    } else if (currentCalibrationStage === 'calibrated' && currentFootCalibration && currentFootCalibration.isCalibrated) {
      // Calibration complete - run pedal recognition
      if (filteredLandmarks) {
        // Run pedal recognition only when the screen is 'driving'
        const screen = useDrivingStore.getState().screen;
        if (screen === 'driving') {
          const recognitionResult = processPedalRecognition(
            filteredLandmarks,
            currentFootCalibration,
            currentPedalState,
            deltaTime
          );

          // Update the calibration (record the accelerator press position)
          setFootCalibration(recognitionResult.updatedCalibration);

          // Update the pedal state
          updatePedalState(recognitionResult.pedalState);

          // Update the debug info
          const { throttle, brake, isAccelPressed, isBrakePressed } = recognitionResult.pedalState;
          setDebugInfoThrottled(
            `${handInfo} | Accel: ${isAccelPressed ? 'ON' : 'OFF'} (${(throttle * 100).toFixed(0)}%) | ` +
            `Brake: ${isBrakePressed ? 'ON' : 'OFF'} (${(brake * 100).toFixed(0)}%)`
          );
        } else {
          // Reset the pedal state outside the driving screen
          updatePedalState({
            throttle: 0,
            brake: 0,
            isAccelPressed: false,
            isBrakePressed: false,
            brakePressDuration: 0,
            brakePressCount: 0,
          });
          setDebugInfoThrottled(`${handInfo} | Calibration complete`);
        }
      } else {
        setDebugInfoThrottled(`${handInfo} | Foot not detected`);
      }
    } else {
      setDebugInfoThrottled(handInfo);
    }
  };

  // Build the status description text (read directly from the store for the latest state)
  const debugInfo = useDrivingStore(state => state.debugInfo);
  const calibrationStage = useDrivingStore(state => state.calibrationStage);
  const pedalState = useDrivingStore(state => state.pedalState);
  const footCalibration = useDrivingStore(state => state.footCalibration);

  // Extract the progress percentage
  const getProgressFromDebugInfo = () => {
    const match = debugInfo.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  };

  const getStatusDisplay = () => {
    if (calibrationStage === 'waiting_for_brake') {
      const progress = getProgressFromDebugInfo();
      return {
        title: '⚠️ Holding foot still...',
        message: `Please keep your foot still for 5 seconds (${progress}%)`,
        color: '#FFFF00',
        bgColor: 'rgba(255, 255, 0, 0.2)'
      };
    } else if (calibrationStage === 'calibrated' && footCalibration?.isCalibrated) {
      if (pedalState.isBrakePressed) {
        return {
          title: '🔴 Brake',
          message: `Braking force: ${(pedalState.brake * 100).toFixed(0)}%`,
          color: '#FF0000',
          bgColor: 'rgba(255, 0, 0, 0.2)'
        };
      } else if (pedalState.isAccelPressed) {
        return {
          title: '🟢 Accelerator',
          message: `Throttle: ${(pedalState.throttle * 100).toFixed(0)}%`,
          color: '#00FF00',
          bgColor: 'rgba(0, 255, 0, 0.2)'
        };
      } else {
        return {
          title: '⚪ Idle',
          message: 'No pedal input',
          color: '#FFFFFF',
          bgColor: 'rgba(255, 255, 255, 0.1)'
        };
      }
    } else {
      return {
        title: '📷 Starting camera',
        message: debugInfo,
        color: '#FFFFFF',
        bgColor: 'rgba(0, 0, 0, 0.8)'
      };
    }
  };

  const statusDisplay = getStatusDisplay();
  const recoveryCopy = getRecoveryCopy(recoveryKind, language);

  return (
    <div className="vision-overlay" style={{
        position: 'fixed',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        opacity: 0.9,
        pointerEvents: 'none',
    }}>
        {/* The video tag is hidden and runs in the background */}
        <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted></video>

        {/* User guidance shown when the camera fails to start (retry + keyboard control fallback) */}
        {cameraError && (
          <div className="recovery-card" style={{
            backgroundColor: 'rgba(127, 29, 29, 0.95)',
            border: '2px solid #f87171',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            pointerEvents: 'auto',
          }}>
            <div className="recovery-title">{recoveryCopy.title}</div>
            <div className="recovery-message">{recoveryCopy.message}</div>
            {recoveryCopy.settingsHint && (
              <div className="recovery-settings-hint">{recoveryCopy.settingsHint}</div>
            )}
            <div className="recovery-actions">
              <button
                onClick={retryRecovery}
                disabled={isSettingUpVision}
                className="recovery-button recovery-button-primary"
                style={{
                  color: '#7f1d1d',
                  backgroundColor: '#fff',
                }}
              >{isSettingUpVision ? (language === 'ja' ? '再試行中...' : 'Retrying...') : recoveryCopy.retryLabel}</button>
              <button
                onClick={activateKeyboardFallback}
                className="recovery-button recovery-button-secondary"
                style={{
                  color: '#164e63',
                  backgroundColor: '#a5f3fc',
                }}
              >{recoveryCopy.fallbackLabel}</button>
            </div>
          </div>
        )}

        {!cameraError && <div style={{
          position: "relative",
          width: "240px",
          height: "180px",
          backgroundColor: "black", // Keep the canvas backing black too
          borderRadius: '10px',
          overflow: 'hidden'
        }}>
            <canvas ref={canvasRef} style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'black', // This is visible when stopped
                transform: 'scaleX(-1)'
            }} />
        </div>}

        {/* Status display panel */}
        {!cameraError && <div style={{
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
        </div>}
    </div>
  );
}
