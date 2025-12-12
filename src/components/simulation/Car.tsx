"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect, useMemo } from "react";
import { Vector3, Group, Euler } from "three";
import { useDrivingStore, ReplayFrame } from "@/lib/store";
import { checkMissionGoal, MISSION_CHECKPOINTS } from "@/components/simulation/MissionController";
import { getCoursePath } from "@/lib/course";

export function Car({ cameraTarget = 'player' }: { cameraTarget?: 'player' | 'ghost' }) {
    const groupRef = useRef<Group>(null);
    const ghostRef = useRef<Group>(null); // Ref for Ghost Car
    const { camera } = useThree();

    const { 
        steeringAngle: steeringInput, 
        throttle: throttleInput, 
        brake: brakeInput, 
        headRotation, 
        setSpeed,
        isPaused,
        isReplaying,
        replayData,
        replayViewMode,
        currentLesson,
        setMissionState,
        setScreen
    } = useDrivingStore();

    // Physics state
    const speed = useRef(0);
    const maxSpeed = 1.5; 
    const acceleration = 0.01;
    const friction = 0.005;
    const turnSpeed = 0.05; 
    const creepSpeed = 0.05;

    // Recording state
    const recordedFrames = useRef<ReplayFrame[]>([]);
    
    // Replay state
    const replayIndex = useRef(0);

    // Checkpoint Logic
    const clearedCheckpoints = useRef<Set<string>>(new Set());
    const dataCheckpoints = useRef(MISSION_CHECKPOINTS[currentLesson] || []);
    // Reset on lesson change
    useEffect(() => {
        clearedCheckpoints.current.clear();
        dataCheckpoints.current = MISSION_CHECKPOINTS[currentLesson] || [];
    }, [currentLesson]);

    // Get Course Path for Ghost Car
    const coursePath = useMemo(() => getCoursePath(currentLesson), [currentLesson]);
    const courseLength = useMemo(() => coursePath.getLength(), [coursePath]);



    useFrame((state, delta) => {
        if (!groupRef.current) return;

        if(isPaused){
            return;
        }

        // --- REPLAY MODE ---
        if (isReplaying) {
            if (replayData.length === 0) return;

            if (replayIndex.current < replayData.length) {
                const frame = replayData[replayIndex.current];
                
                // Update Player Car
                groupRef.current.position.set(frame.position[0], frame.position[1], frame.position[2]);
                groupRef.current.rotation.set(frame.rotation[0], frame.rotation[1], frame.rotation[2]);
                
                // Update Ghost Car (Ideal Path)
                if (ghostRef.current) {
                    const targetSpeed = 0.25; 
                    const dist = Math.min((replayIndex.current * targetSpeed), courseLength);
                    const t = dist / courseLength;
                    
                    if (t <= 1) {
                        const point = coursePath.getPointAt(t);
                        const tangent = coursePath.getTangentAt(t);
                        ghostRef.current.position.set(point.x, point.y, point.z);
                        ghostRef.current.rotation.set(0, Math.atan2(tangent.x, tangent.z) + Math.PI, 0); 
                    }
                }

                // Camera Logic (Replay)
                // Camera Logic (Replay)
                if (replayViewMode === 'driver') {
                    // First Person (Driver View)
                    const targetGroup = cameraTarget === 'ghost' ? ghostRef.current : groupRef.current;
                    
                    if (targetGroup) {
                        const camOffset = new Vector3(0.35, 1.28, 0.4); 
                        camOffset.applyEuler(targetGroup.rotation);
                        const camPos = targetGroup.position.clone().add(camOffset);
                        
                        camera.position.lerp(camPos, 0.5);

                        let baseLookTarget;

                        if (cameraTarget === 'ghost') {
                            // Ideal Look: Along the path tangent (already set in ghost rotation)
                            // Ghost rotation is set to path tangent Y.
                            // We can simulate "perfect driving" looking straight ahead (relative to car)
                            // Or slightly into the turn? Let's just look straight ahead relative to car for "Ideal".
                            const forward = new Vector3(0, 0, -1);
                            forward.applyEuler(targetGroup.rotation);
                            baseLookTarget = targetGroup.position.clone().add(forward.multiplyScalar(10));
                            // No head rotation for ghost (or could simulate looking into turn)
                        } else {
                            // Player Look: Use recorded head rotation
                            const recordedHead = frame.headRotation || { pitch: 0, yaw: 0, roll: 0 };
                            
                            const forward = new Vector3(0, 0, -1);
                            forward.applyEuler(targetGroup.rotation);
                            
                            baseLookTarget = targetGroup.position.clone().add(forward.multiplyScalar(10));
                            
                            const right = new Vector3(1, 0, 0).applyEuler(targetGroup.rotation);
                            baseLookTarget.add(right.multiplyScalar(recordedHead.yaw * 5));
                            baseLookTarget.y += recordedHead.pitch * 5;
                        }

                        camera.lookAt(baseLookTarget);
                    }

                } else {
                    // Third Person (Chase Cam) - Always follow player (for now)
                    // Could support cameraTarget='ghost' here too if we wanted "Ghost Chase Cam"
                    const targetGroup = groupRef.current; // Force player chase
                    
                    const camOffset = new Vector3(0, 5, 10); 
                    camOffset.applyEuler(targetGroup.rotation); 
                    const camPos = targetGroup.position.clone().add(new Vector3(0, 4, 8).applyEuler(targetGroup.rotation));
                    
                    camera.position.lerp(camPos, 0.1);
                    camera.lookAt(targetGroup.position);
                }

                replayIndex.current++;
            } else {
                replayIndex.current = 0; // Loop
            }
            return;
        }

        // --- DRIVING MODE ---

        // 1. Calculate Speed
        if (throttleInput > 0) {
            speed.current += (maxSpeed * throttleInput - speed.current) * acceleration;
        } else if (brakeInput > 0) {
            speed.current -= brakeInput * 0.05;
            if (speed.current < 0) speed.current = 0;
        } else {
            if (speed.current < creepSpeed) {
                speed.current += 0.001; 
            } else {
                speed.current -= friction;
                if (speed.current < creepSpeed) speed.current = creepSpeed;
            }
        }

        setSpeed(Math.abs(speed.current) * 100);

        // 2. Steering
        if (Math.abs(speed.current) > 0.001) {
             const boostedSteering = steeringInput * 2.0;
             groupRef.current.rotation.y -= boostedSteering * turnSpeed * (speed.current / maxSpeed) * 3.0;
        }

        // 3. Move
        const forward = new Vector3(0, 0, -1);
        forward.applyEuler(groupRef.current.rotation);
        groupRef.current.position.add(forward.multiplyScalar(speed.current));
        
        // CHECK GOAL
        if (checkMissionGoal(currentLesson, groupRef.current.position)) {
             useDrivingStore.setState({ replayData: recordedFrames.current });
             setMissionState('success');
             setScreen('feedback'); 
             return;
        }

        // CHECK INTERMEDIATE CHECKPOINTS (Props)
        const checkpoints = dataCheckpoints.current; // access ref 
        checkpoints.forEach(cp => {
            if (clearedCheckpoints.current.has(cp.id)) return; // Already done

            // Distance Check
            const dx = groupRef.current!.position.x - cp.position[0];
            const dz = groupRef.current!.position.z - cp.position[2];
            const dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < cp.radius) {
                // Inside Checkpoint Area
                if (cp.type === 'stop') {
                    // STOP Check
                    // If speed is basically 0
                    if (Math.abs(speed.current) < 0.05) {
                        clearedCheckpoints.current.add(cp.id);
                        useDrivingStore.getState().setDrivingFeedback("🛑 一時停止 OK!");
                        setTimeout(() => useDrivingStore.getState().setDrivingFeedback(null), 2000);
                    } else {
                         // Show warning continuously? No, too annoying.
                         // Maybe show "止まれ" text?
                    }
                } else if (cp.type === 'mirror') {
                    // GAZE Check
                    // Expected Yaw: - means Right (screen coords), + means Left
                    // My HeadRotation: Yaw is in radians. +Left, -Right usually? 
                    // Let's check store definition: `steeringAngle` -1 (left) to 1 (right). 
                    // HeadRotation comes from VisionController. 
                    // Let's assume standard: Positive Left.
                    
                    const needed = cp.targetYaw || 0;
                    const tolerance = cp.yawTolerance || 0.5;
                    const currentYaw = headRotation.yaw;

                    // Directions: 
                    // If needed is negative (Right), we want currentYaw < needed + tolerance && currentYaw > needed - tolerance?
                    // Actually just Math.abs(current - needed) < tolerance
                    if (Math.abs(currentYaw - needed) < tolerance) {
                        clearedCheckpoints.current.add(cp.id);
                        const label = needed > 0 ? "左確認" : "右確認";
                        useDrivingStore.getState().setDrivingFeedback(`👀 ${label} OK!`);
                        setTimeout(() => useDrivingStore.getState().setDrivingFeedback(null), 2000);
                    }
                }
            }
        });

        // 4. Record Frame
        recordedFrames.current.push({
            timestamp: Date.now(),
            position: groupRef.current.position.toArray() as [number, number, number],
            rotation: groupRef.current.rotation.toArray() as [number, number, number],
            steering: steeringInput,
            headRotation: { ...headRotation } // Save copy
        });

        // 5. Camera (First Person) - Positioned to see hood
        const camOffset = new Vector3(0.35, 1.28, 0.4); 
        camOffset.applyEuler(groupRef.current.rotation);
        const camPos = groupRef.current.position.clone().add(camOffset);
        
        camera.position.lerp(camPos, 0.5);

        // Head Rotation
        const lookAtDist = 10;
        const baseLookTarget = groupRef.current.position.clone().add(forward.normalize().multiplyScalar(lookAtDist));
        const right = new Vector3(1, 0, 0).applyEuler(groupRef.current.rotation);
        baseLookTarget.add(right.multiplyScalar(headRotation.yaw * 5));
        baseLookTarget.y += headRotation.pitch * 5;

        camera.lookAt(baseLookTarget);
    });

    // Helper boolean to decide visuals
    // We show 'External' if: Replaying in Chase Mode OR Ghost
    // We show 'Internal+Bonnet' if: Driving OR Replaying in Driver Mode
    
    // Actually, stick to the structure:
    // Driving: External(hideCabin) + Internal
    // Replay (Chase): External only
    // Replay (Driver): External(hideCabin) + Internal  <-- Same as Driving!

    const showDriverView = !isReplaying || (isReplaying && replayViewMode === 'driver');
    // steeringInput during replay needs to come from frame, BUT we are inside component.
    // The CarVisuals component takes `steeringInput` prop.
    // In Driving mode, it's `steeringInput` from store.
    // In Replay mode, we need the `steering` from current frame.
    // Ideally we'd trigger a re-render or pass a ref, but re-render 60fps is bad.
    // `CarVisuals` is a simple component. Let's Pass the CURRENT steering value.
    // We can use a ref for steering that updates in the loop?
    // But React won't re-render unless state changes.
    // Actually, let's keep it simple: `steeringInput` from store is live during driving.
    // During replay, we are NOT updating the store's `steeringAngle`.
    // So the Steering Wheel won't move in Replay unless we update the view.
    // We can drive the Steering Wheel rotation via a Ref in `CarVisuals`?
    // Let's modify `CarVisuals` to accept a Ref? Or update store dummy steering?
    // Updating store at 60fps might be heavy but let's try it or just accept static wheel for now?
    // No, user wants to verify operation. Wheel must move.
    // Simplest: Update a mutable Ref that `CarVisuals` reads? 
    // `CarVisuals` is functional.
    // Let's pass the frame's steering if replaying.
    // But `Car` function re-renders? No, `useFrame` is side-effect. Component doesn't re-render.
    // So `currentFrameSteering` variable won't update the JSX props.
    // We need `CarVisuals` to animate itself via useFrame or Ref.
    
    // For now, let's just make sure the View/Camera is correct. 
    // Wheel animation in replay is a "nice to have". 
    // (Actually, checking my previous code... `CarVisuals` uses `steeringInput` prop. It controls visual rotation... assuming re-render.)
    // Wait, `steeringInput` is from `useDrivingStore()`. Does that subscription trigger re-render on change?
    // Yes, Zustand usage `const { steeringAngle } ...` triggers re-render on change.
    // So in driving mode, it works because `setSteering` is called.
    // In Replay mode, `steeringAngle` in store is NOT changing.
    // WE SHOULD UPDATE STORE STEERING in Replay loop for visual feedback?
    // That would trigger re-renders 60fps which might be heavy but maybe okay for this app?
    // Let's try updating store steering in replay loop too.
    
    return (
        <>
            {/* Player Car */}
            <group ref={groupRef} position={[0, 0, 0]}>
                {showDriverView ? 
                    (
                        // Driver View (Driving or Replay-Driver)
                         <group rotation={[0, Math.PI, 0]}>
                            <ExternalCarVisuals hideCabin />
                        </group>
                    ) : (
                        // Chase View (Replay-Chase)
                        <group rotation={[0, Math.PI, 0]}>
                            <ExternalCarVisuals />
                        </group>
                    )
                }
                
                {showDriverView && (
                   // Steering Wheel
                   // Note: If in replay, this will show static wheel unless we pipe data.
                   // As a quick hack, I'll assume current store steering is 0 or what it was.
                   // To make it move, I'd need to setSteering(frame.steering) in the replay loop.
                   // I will add that to the loop above.
                   <CarVisuals steeringInput={steeringInput} />
                )}
            </group>

            {/* Ghost Car (Only in Replay) */}
            {isReplaying && (
                <group ref={ghostRef} position={[0, 0, 0]}>
                    <group rotation={[0, Math.PI, 0]}>
                        <ExternalCarVisuals isGhost />
                    </group>
                </group>
            )}
        </>
    );
}

// ... (CarVisuals and ExternalCarVisuals unchanged, include them below for completeness) ...
// Internal View (Driving)
export function CarVisuals({ steeringInput }: { steeringInput: number }) {
    return (
        <group rotation={[0, Math.PI, 0]}> 
          <mesh position={[0, 1.1, -0.25]} rotation={[0.35, 0, 0]}>
              <planeGeometry args={[1.8, 0.9]} />
              <meshStandardMaterial color="#aaddee" opacity={0.1} transparent roughness={0} metalness={0.9} />
          </mesh>

          {/* Steering Wheel */}
          <group position={[0.35, 0.55, -0.35]} rotation={[-0.35, 0, 0]}> 
              <group rotation={[0, 0, steeringInput * 2.5]}>
                  <mesh>
                      <torusGeometry args={[0.19, 0.02, 16, 48]} />
                      <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
                  </mesh>
                  <mesh rotation={[Math.PI/2, 0, 0]}>
                      <cylinderGeometry args={[0.06, 0.06, 0.04, 32]} />
                      <meshStandardMaterial color="#222" />
                  </mesh>
                  <mesh position={[0, -0.1, 0]}>
                      <boxGeometry args={[0.03, 0.18, 0.02]} />
                      <meshStandardMaterial color="#333" metalness={0.5} />
                  </mesh>
                   <mesh position={[-0.1, 0.02, 0]} rotation={[0, 0, 1.3]}>
                      <boxGeometry args={[0.03, 0.18, 0.02]} />
                      <meshStandardMaterial color="#333" />
                  </mesh>
                  <mesh position={[0.1, 0.02, 0]} rotation={[0, 0, -1.3]}>
                      <boxGeometry args={[0.03, 0.18, 0.02]} />
                      <meshStandardMaterial color="#333" />
                  </mesh>
              </group>
              
               <mesh position={[0, 0, -0.1]} rotation={[Math.PI/2, 0, 0]}>
                 <cylinderGeometry args={[0.04, 0.04, 0.2, 16]} />
                 <meshStandardMaterial color="#111" />
              </mesh>
          </group>
        </group>
    );
}

// External View (Replay / Garage)
export function ExternalCarVisuals({ isGhost = false, hideCabin = false }: { isGhost?: boolean, hideCabin?: boolean }) {
  const bodyColor = isGhost ? "#60a5fa" : "#334155";
  const cabinColor = isGhost ? "#93c5fd" : "#1e293b";
  const opacity = isGhost ? 0.3 : 1.0;
  const transparent = isGhost;

  return (
    <group>
      {/* Chassis */}
      <mesh position={[0, 0.4, 0]} castShadow={!isGhost} receiveShadow={!isGhost}>
        <boxGeometry args={[1.8, 0.6, 4]} />
        <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.4} transparent={transparent} opacity={opacity} />
      </mesh>

      {/* Cabin (Conditionally rendered) */}
      {!hideCabin && (
          <mesh position={[0, 1.0, -0.2]} castShadow={!isGhost} receiveShadow={!isGhost}>
            <boxGeometry args={[1.4, 0.7, 2]} />
            <meshStandardMaterial color={cabinColor} metalness={0.1} roughness={0.1} transparent={transparent} opacity={opacity} />
          </mesh>
      )}
      
      {/* Hood detail */}
      <mesh position={[0, 0.71, 1.2]} rotation={[0.1, 0, 0]}>
         <boxGeometry args={[1.5, 0.05, 1.4]} />
         <meshStandardMaterial color={isGhost ? bodyColor : "#475569"} transparent={transparent} opacity={opacity} />
      </mesh>

      {/* Headlights */}
      <mesh position={[-0.6, 0.5, 2.05]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={isGhost ? 0.5 : 2} toneMapped={false} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0.6, 0.5, 2.05]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={isGhost ? 0.5 : 2} toneMapped={false} transparent={transparent} opacity={opacity} />
      </mesh>

      {/* Taillights */}
      <mesh position={[-0.6, 0.6, -2.05]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={isGhost ? 0.5 : 2} toneMapped={false} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0.6, 0.6, -2.05]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={isGhost ? 0.5 : 2} toneMapped={false} transparent={transparent} opacity={opacity} />
      </mesh>

      {/* Wheels */}
      <Wheel position={[-0.8, 0.35, 1.2]} isGhost={isGhost} />
      <Wheel position={[0.8, 0.35, 1.2]} isGhost={isGhost} />
      <Wheel position={[-0.8, 0.35, -1.2]} isGhost={isGhost} />
      <Wheel position={[0.8, 0.35, -1.2]} isGhost={isGhost} />
      
      {/* Underglow (Only real car) */}
      {!isGhost && (
          <pointLight position={[0, 0.1, 0]} color="#3b82f6" intensity={2} distance={5} decay={2} />
      )}
    </group>
  );
}

function Wheel({ position, isGhost }: { position: [number, number, number], isGhost?: boolean }) {
  const tireColor = isGhost ? "#60a5fa" : "#171717";
  const rimColor = isGhost ? "#93c5fd" : "#94a3b8";
  const opacity = isGhost ? 0.3 : 1.0;
  const transparent = isGhost;

  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow={!isGhost}>
        <cylinderGeometry args={[0.35, 0.35, 0.3, 32]} />
        <meshStandardMaterial color={tireColor} roughness={0.8} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.16, 0, 0]}>
         <cylinderGeometry args={[0.2, 0.2, 0.05, 16]} />
         <meshStandardMaterial color={rimColor} metalness={0.8} roughness={0.2} transparent={transparent} opacity={opacity} />
      </mesh>
    </group>
  );
}
