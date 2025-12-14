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
    const creepSpeed = 0.15; // Increased from 0.05 per user request

    // Recording state
    const recordedFrames = useRef<ReplayFrame[]>([]);

    // Replay state
    const replayIndex = useRef(0);
    const ghostDist = useRef(0); // Track ghost car distance independently

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
                    // Variable Speed Logic
                    let targetSpeed = 0.25; // Default ~55km/h

                    // Slow down for turns
                    if (currentLesson === 'left-turn' || currentLesson === 'right-turn') {
                        // Turn is roughly from 50m to 65m
                        if (ghostDist.current > 45 && ghostDist.current < 70) {
                            targetSpeed = 0.1; // Slow down to ~20km/h
                        }
                    } else if (currentLesson === 's-curve' || currentLesson === 'crank') {
                        targetSpeed = 0.08; // Always slow for complex courses
                    }

                    ghostDist.current += targetSpeed;
                    if (ghostDist.current > courseLength) {
                        // Clamp or just stay at end?
                        // If loop, we reset.
                    }

                    const t = Math.min(ghostDist.current / courseLength, 1);

                    if (t <= 1) {
                        const point = coursePath.getPointAt(t);
                        const tangent = coursePath.getTangentAt(t);
                        ghostRef.current.position.set(point.x, point.y, point.z);
                        ghostRef.current.rotation.set(0, Math.atan2(tangent.x, tangent.z) + Math.PI, 0);
                    }
                }

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
                            const forward = new Vector3(0, 0, -1);
                            forward.applyEuler(targetGroup.rotation);
                            baseLookTarget = targetGroup.position.clone().add(forward.multiplyScalar(10));
                        } else {
                            // Player Look
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
                    // Third Person (Chase Cam)
                    const targetGroup = groupRef.current;
                    const camOffset = new Vector3(0, 5, 10);
                    camOffset.applyEuler(targetGroup.rotation);
                    const camPos = targetGroup.position.clone().add(new Vector3(0, 4, 8).applyEuler(targetGroup.rotation));

                    camera.position.lerp(camPos, 0.1);
                    camera.lookAt(targetGroup.position);
                }

                replayIndex.current++;
            } else {
                replayIndex.current = 0; // Loop
                ghostDist.current = 0;
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
             // Non-linear steering curve: Gentle at center, strong at limits
             const curvePower = 1.8;
             const curvedInput = Math.sign(steeringInput) * Math.pow(Math.abs(steeringInput), curvePower);

             const boostedSteering = curvedInput * 8.0; // Boosted to 8.0 per user request (maximum turning)
             groupRef.current.rotation.y -= boostedSteering * turnSpeed * (speed.current / maxSpeed) * 3.0;
        }

        // 3. Move
        const forward = new Vector3(0, 0, -1);
        forward.applyEuler(groupRef.current.rotation);
        groupRef.current.position.add(forward.multiplyScalar(speed.current));

        // CHECK GOAL
        if (checkMissionGoal(currentLesson, groupRef.current.position)) {
             // Save Replay Data
             const frames = recordedFrames.current;
             useDrivingStore.setState({ replayData: frames });

             setMissionState('success'); // Triggers GoalEffects (if any)
             setScreen('feedback');
             return;
        }





        // CHECK INTERMEDIATE CHECKPOINTS
        const checkpoints = dataCheckpoints.current;
        checkpoints.forEach(cp => {
            if (clearedCheckpoints.current.has(cp.id)) return;

            const dx = groupRef.current!.position.x - cp.position[0];
            const dz = groupRef.current!.position.z - cp.position[2];
            const dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < cp.radius) {
                if (cp.type === 'stop') {
                    if (Math.abs(speed.current) < 0.05) {
                        clearedCheckpoints.current.add(cp.id);
                        useDrivingStore.getState().setDrivingFeedback("🛑 一時停止 OK!");
                        setTimeout(() => useDrivingStore.getState().setDrivingFeedback(null), 2000);
                    }
                } else if (cp.type === 'mirror') {
                    const needed = cp.targetYaw || 0;
                    const tolerance = cp.yawTolerance || 0.5;
                    const currentYaw = headRotation.yaw;

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
            speed: Math.abs(speed.current) * 100, // Record speed for analysis
            headRotation: { ...headRotation }
        });

        // 5. Camera (First Person)
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

    const showDriverView = !isReplaying || (isReplaying && replayViewMode === 'driver');

    return (
        <>
            {/* Player Car */}
            <group ref={groupRef} position={[0, 0, 0]}>
                {showDriverView ?
                    (
                         <group rotation={[0, Math.PI, 0]}>
                            <ExternalCarVisuals hideCabin />
                        </group>
                    ) : (
                        <group rotation={[0, Math.PI, 0]}>
                            <ExternalCarVisuals />
                        </group>
                    )
                }

                {showDriverView && (
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
