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
  const setSpeed = useDrivingStore((state) => state.setSpeed);
  const setGaze = useDrivingStore((state) => state.setGaze);
  const setIsPaused = useDrivingStore((state) => state.setIsPaused);
  const missionState = useDrivingStore(state => state.missionState);
  const setRecordedVideo = useDrivingStore(state => state.setRecordedVideo);

  // References for MediaPipe instances
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastFaceTimeRef = useRef<number>(Date.now());
  const requestRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;

    if(isPaused){
      setSteering(0);
      setSpeed(0);
      setDebugInfo("Paused");
    }
  }, [isPaused, setSteering, setSpeed, setDebugInfo]);

  // Recording Logic
  useEffect(() => {
    if (missionState === 'active' && videoRef.current && videoRef.current.srcObject) {
         // Start Recording
         chunksRef.current = [];
         try {
             const stream = videoRef.current.srcObject as MediaStream;
             const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
             
             recorder.ondataavailable = (e) => {
                 if (e.data.size > 0) chunksRef.current.push(e.data);
             };
             
             recorder.onstop = () => {
                 const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                 const url = URL.createObjectURL(blob);
                 setRecordedVideo(url);
                 console.log("Recording Saved", url);
             };

             recorder.start();
             mediaRecorderRef.current = recorder;
             console.log("Recording Started");
         } catch (e) {
             console.error("Failed to start recording", e);
         }
    } else if (missionState !== 'active' && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        // Stop Recording
        mediaRecorderRef.current.stop();
        console.log("Recording Stopped (State Change)");
    }

    // Cleanup on unmount
    return () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            console.log("Recording Stopped (Unmount)");
        }
    };
  }, [missionState, setRecordedVideo]);

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

    let startTimeMs = performance.now();
    if (faceLandmarkerRef.current && handLandmarkerRef.current && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        
        try {
            const drawingUtils = ctx ? new DrawingUtils(ctx) : null;

            // Run Face Detection
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
              lastFaceTimeRef.current = Date.now();
                if(drawingUtils) {
                    for (const landmarks of faceResult.faceLandmarks) {
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
                        
                        // Iris visualization (optional but good for debug)
                        // drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030" });
                        // drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30" });
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

                    // Gaze Calculation (Simplified Horizontal)
                    // Left Eye: 33 (inner), 133 (outer), 468 (iris)
                    // Right Eye: 362 (inner), 263 (outer), 473 (iris)
                    const leftInner = landmarks[33].x;
                    const leftOuter = landmarks[133].x;
                    const leftIris = landmarks[468].x;
                    const leftWidth = leftOuter - leftInner;
                    // 0 = inner, 1 = outer. Center ~ 0.5. 
                    // Normalize to -1 (Left) to 1 (Right). 
                    // Note: Camera is mirrored calculation might need flip if not handled by canvas scale(-1)
                    
                    const rightInner = landmarks[362].x;
                    const rightOuter = landmarks[263].x;
                    const rightIris = landmarks[473].x;
                    
                    // Simple Gaze Ratio
                    const leftRatio = (leftIris - leftInner) / (leftOuter - leftInner);
                    const rightRatio = (rightIris - rightInner) / (rightOuter - rightInner);
                    
                    // Average ratio: 0.5 is center. < 0.5 is Looking Right (in mirrored view? No wait).
                    // In camera view: Left is Left part of image. If user looks to THEIR Left, Iris moves to Image Right.
                    // Let's assume standardized 0 (left) to 1 (right) relative to eye box.
                    const avgRatio = (leftRatio + rightRatio) / 2;
                    
                    // Map 0.2-0.8 to -1 to 1 approximately
                    const gazeX = (avgRatio - 0.5) * 5; 
                    setGaze({ x: gazeX, y: 0 }); // Y not implemented yet
                }
            } else {
              // No face detected check
              if (Date.now() - lastFaceTimeRef.current > 3000 && !isPausedRef.current) {
                console.log("Auto-pausing due to no face detected");
                setIsPaused(true);
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
          
          info += ` | Ang: ${angle.toFixed(2)} | Str: ${steering}`;
      } else {
          setSteering(0);
          info += " | Need 2 hands";
      }
      
      setDebugInfo(info);
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
        <video ref={videoRef} style={{ position: 'absolute', opacity: 0, zIndex: -1 }} autoPlay playsInline muted></video>
        
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
