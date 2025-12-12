
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
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        // Initialize Face Landmarker
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        // Initialize Hand Landmarker
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(filesetResolver, {
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
        setWebcamRunning(true); // Start webcam immediately

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
                        await videoRef.current.play(); // Explicit play
                    } catch (e) {
                        console.warn("Video play interrupted or failed:", e);
                    }
                    videoRef.current.addEventListener("loadeddata", predictWebcam);
                    // If already loaded
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
    
      const predictWebcam = () => {
        if (!videoRef.current || !canvasRef.current) return;
    
        const video = videoRef.current;
        
        // Always draw video frame if available
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if(video.videoWidth > 0 && ctx) {
             // Only resize if different to avoid flickering/clearing
             if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                 canvas.width = video.videoWidth;
                 canvas.height = video.videoHeight;
             }
             ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        }
    
        // ここで検問！ 停止中なら何もしない
        if (isPausedRef.current) {
            // 次のフレームの予約だけして、計算せずに帰る（待機状態）
            requestRef.current = requestAnimationFrame(predictWebcam);
            return; 
        }

    let startTimeMs = performance.now();
    if (faceLandmarkerRef.current && handLandmarkerRef.current && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        
        try {
            const drawingUtils = ctx ? new DrawingUtils(ctx) : null;

            // Run Face Detection
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
                if(drawingUtils) {
                    for (const landmarks of faceResult.faceLandmarks) {
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
                        drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
                            { color: "#FF3030" }
                        );
                        drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
                            { color: "#30FF30" }
                        );
                    }
                }
                const landmarks = faceResult.faceLandmarks[0];
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

            // Run Hand Detection
            const handResult = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (handResult.landmarks && drawingUtils) {
                for (const landmarks of handResult.landmarks) {
                    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {color: "#00FF00", lineWidth: 3});
                    drawingUtils.drawLandmarks(landmarks, {color: "#FF0000", lineWidth: 2});
                }
            }
            processHandGestures(handResult, setSteering, setPedals, setDebugInfo);
            
        } catch (e) {
            console.error("Prediction error:", e);
        }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processHandGestures = (result: HandLandmarkerResult, setSteering: any, setPedals: any, setDebugInfo: any) => {
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
          
          // Reverse logic: previously it was reversed.
          // Also user requested digital input "1 or -1".
          const threshold = 0.1;
          let steering = 0;
          if (Math.abs(angle) > threshold) {
              // Invert sign here to fix "reversed" issue
              // Original was angle * sensitivity.
              // We need opposite.
              steering = -Math.sign(angle); 
          }
          
          setSteering(steering);
          
          info += ` | Ang: ${angle.toFixed(2)} | Str: ${steering}`;
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
        zIndex: 2000,
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
