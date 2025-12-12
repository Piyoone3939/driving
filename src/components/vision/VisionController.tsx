"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker, HandLandmarker, DrawingUtils, FaceLandmarkerResult, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { useDrivingStore } from "@/lib/store";

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

  // References for MediaPipe instances
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number>(0);

  // ▼▼▼ 最新の停止状態を常に監視するためのRef ▼▼▼
  // (ループ処理は高速なので、StateではなくRefで最新の値を見に行くのが定石です)
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
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
        );

        // Initialize Face Landmarker
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        // Initialize Hand Landmarker
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.3, // Lower confidence to help detection
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3
        });

        setDebugInfo("Models loaded. Starting Camera...");
        setVisionReady(true);
        startCamera();

      } catch (error) {
        console.error(error);
        setDebugInfo("Error MP: " + String(error));
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
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      videoRef.current.srcObject = stream;
      try {
          await videoRef.current.play(); // Explicit play
      } catch (e) {
          console.warn("Video play interrupted or failed:", e);
      }
      videoRef.current.addEventListener("loadeddata", predictWebcam);
      setWebcamRunning(true);
    } catch (err) {
      console.error(err);
      setDebugInfo("Camera Error: " + String(err));
    }
  };

  const predictWebcam = () => {
    if (!videoRef.current || !canvasRef.current) return; // Check canvasRef too

    // ここで検問！ 停止中なら何もしない
    if (isPausedRef.current) {
        // 次のフレームの予約だけして、計算せずに帰る（待機状態）
        requestRef.current = requestAnimationFrame(predictWebcam);
        return; 
    }

    const video = videoRef.current;
    
    // Always draw video frame if available
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (ctx && video.readyState >= 2) { // HAVE_CURRENT_DATA
        ctx.save();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    if (faceLandmarkerRef.current && handLandmarkerRef.current && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        
        try {
            const startTime = performance.now();

            // Run Face Detection
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTime);
            processFace(faceResult);

            // Run Hand Detection
            const handResult = handLandmarkerRef.current.detectForVideo(video, startTime);
            processHands(handResult);
            
            // Draw overlays on top of the already drawn video
            if (ctx) {
                drawOverlays(ctx, faceResult, handResult);
            }
        } catch (e) {
            console.error("Prediction error:", e);
        }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processFace = (result: FaceLandmarkerResult) => {
      if (result.faceBlendshapes && result.faceBlendshapes.length > 0 && result.faceBlendshapes[0].categories) {
          const landmarks = result.faceLandmarks[0];
          if(landmarks) {
              // 1: Nose, 234: Left Ear, 454: Right Ear
              const nose = landmarks[1];
              const leftEar = landmarks[234];
              const rightEar = landmarks[454];

              // Generic Yaw calculation: Relative position of nose between ears
              // If nose is closer to left ear, looking left
              const midEarX = (leftEar.x + rightEar.x) / 2;
              const yawEstimate = (nose.x - midEarX) * 20; // Multiplier for sensitivity
              
              setHeadRotation({ pitch: 0, yaw: -yawEstimate, roll: 0 }); 
          }
      }
  };

  const processHands = (result: HandLandmarkerResult) => {
      const hands = result.landmarks.length;
      let info = `Hands: ${hands}`;

      if (hands === 2 && result.handedness.length === 2) {
          // Identify Left and Right hands using Handedness
          // Note: In Selfie mode (mirrored), MediaPipe 'Left' hand is usually the user's Left hand (appearing on left).
          // But sometimes it's inverted depending on model config.
          // Let's rely on label.
          
          let leftHandLandmarks = result.landmarks[0];
          let rightHandLandmarks = result.landmarks[1];
          
          const label0 = result.handedness[0]?.[0]?.categoryName ?? 'Left';
          const label1 = result.handedness[1]?.[0]?.categoryName ?? 'Right';

          if (label0 !== label1) {
              // We have distinct hands
              if (label0 === 'Left') {
                  leftHandLandmarks = result.landmarks[0];
                  rightHandLandmarks = result.landmarks[1];
              } else {
                  leftHandLandmarks = result.landmarks[1];
                  rightHandLandmarks = result.landmarks[0];
              }
          } else {
              // Fallback to X-sorting if labels are same or unsure
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

          const left = leftHandLandmarks[9]; // Middle Knuckle
          const right = rightHandLandmarks[9];
          
          const dy = right.y - left.y;
          const dx = right.x - left.x;
          
          const angle = Math.atan2(dy, dx);
          // Angle 0 is Horizontal (Right hand exactly right of Left hand)
          // Positive Angle (dy>0) -> Right hand is Lower -> Right Turn
          // Negative Angle (dy<0) -> Right hand is Higher -> Left Turn
          
          const sensitivity = 2.5; 
          // We want Left Turn (Neg Angle) to give Negative Steering (to match Rotation logic in Car '+=')
          // Wait, Car uses '-=' steering.
          // So Negative Steering -> Positive Rotation (Left). Correct.
          // So we pass 'angle' directly?
          // If angle is -0.5 (Left Turn), steering is -0.5.
          // Car: rotation.y -= (-0.5) => rotation.y += 0.5 (Turn Left). Correct.
          
          const steering = Math.max(-1, Math.min(1, angle * sensitivity));
          
          setSteering(steering);
          
          info += ` | Ang: ${angle.toFixed(2)} | Str: ${steering.toFixed(2)}`;
      } else {
          setSteering(0);
          info += " | Need 2 hands";
      }
      
      setDebugInfo(info);
  };

  const drawOverlays = (ctx: CanvasRenderingContext2D, face: FaceLandmarkerResult, hand: HandLandmarkerResult) => {
      const drawingUtils = new DrawingUtils(ctx);
      
      // Video is already drawn in predictWebcam
      
      if(face.faceLandmarks) {
          for (const landmarks of face.faceLandmarks) {
             drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
          }
      }
      if(hand.landmarks) {
          for (const landmarks of hand.landmarks) {
             drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {color: "#00FF00", lineWidth: 3});
             drawingUtils.drawLandmarks(landmarks, {color: "#FF0000", lineWidth: 2});
          }
      }
  };

  return (
    <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        opacity: 0.8,
    }}>
        <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted></video>
        <div style={{
          position: "relative",
          width: "240px",
          height: "180px"
        }}>
        <canvas ref={canvasRef} style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'black',
            borderRadius: '10px',
            border: '1px solid #333',
            transform: 'scaleX(-1)'
        }} />
        {isPaused && (
          <div style={{
            position: "absolute",
            top:0,
            left:0,
            width: "100%",
            height:"100%",
            backgroundColor: "rgba(0,0,0,0.7)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}>
            <span style={{
              color: "white",
              fontFamily: "monospace",
              fontSize: "16px",
              fontWeight: "bold",
            }}>PAUSED</span>
            </div>
        )}
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
