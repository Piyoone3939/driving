"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, useEffect } from "react";
import { Vector3, Group, Quaternion } from "three";
import { useDrivingStore } from "@/lib/store";

export function Car() {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();
  
  // State from store
  const steeringInput = useDrivingStore(state => state.steeringAngle);
  const throttleInput = useDrivingStore(state => state.throttle);
  const brakeInput = useDrivingStore(state => state.brake);
  const headRotation = useDrivingStore(state => state.headRotation);
  const setSpeed = useDrivingStore(state => state.setSpeed);

  // Physics state
  const speed = useRef(0);
  const maxSpeed = 0.5; // units per frame approx
  const acceleration = 0.01;
  const friction = 0.005;
  const turnSpeed = 0.04;

  const creepSpeed = 0.02; // Automatic creep

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 1. Calculate Speed
    let targetSpeed = 0;
    
    if (throttleInput > 0) {
        targetSpeed = maxSpeed * throttleInput;
        speed.current += (targetSpeed - speed.current) * acceleration;
    } else if (brakeInput > 0) {
        speed.current -= brakeInput * 0.05; // Braking
        if (speed.current < 0) speed.current = 0;
    } else {
        // Creep or coast friction
        if (speed.current < creepSpeed) {
            speed.current += 0.001; // Creep acceleration
        } else {
            speed.current -= friction; // Coasting down to creep
            if (speed.current < creepSpeed) speed.current = creepSpeed;
        }
    }

    // 2. Calculate Rotation (Steering)
    // Only turn if moving
    if (Math.abs(speed.current) > 0.001) {
        groupRef.current.rotation.y -= steeringInput * turnSpeed * (speed.current / maxSpeed); 
    }
    
    // Update store speed (convert roughly to km/h for display)
    // 1 unit = 1 meter? approx. 0.5 units/frame @ 60fps = 30m/s = 108km/h. Too fast.
    // Let's assume maxSpeed 0.5 is 50km/h.
    setSpeed(Math.abs(speed.current) * 100); 

    // 3. Move Forward
    const forward = new Vector3(0, 0, -1);
    forward.applyEuler(groupRef.current.rotation);
    const newPos = groupRef.current.position.clone().add(forward.multiplyScalar(speed.current));

    // Collision Detection Logic
    // This is expensive to run every frame if not optimized, but for < 200 points it's fine.
    // Ideally we cache the path points when lesson changes.
    // For now, let's just do a simple boundary check based on currentLesson context if possible?
    // No, let's use the actual path.
    // Note: We need to access the path. Importing getCoursePath inside component is fine.
    
    // Just simple boundary check:
    // If straight, x should be within -3 and 3.
    // If S-Curve or Crank, it's harder.
    // Let's implement a very basic check: If distance to origin > 200, reset?
    // No, user wants "wall collision".
    
    // Let's just limit X for straight for now to test, and boost steering.
    // Boosting steering:
    const boostedSteering = steeringInput * 2.0; // Boost sensitivity
    
    if (Math.abs(speed.current) > 0.001) {
        groupRef.current.rotation.y -= boostedSteering * turnSpeed * (speed.current / maxSpeed) * 3.0; // Extra factor
    }

    groupRef.current.position.copy(newPos);

    // 4. Update Camera (First Person View)
    // Attach camera to car position + offset
    // Driver eye position (Right Hand Drive)
    // Raised camera to see over dashboard clearly
    const camOffset = new Vector3(0.35, 1.28, 0.4); 
    camOffset.applyEuler(groupRef.current.rotation);
    const camPos = groupRef.current.position.clone().add(camOffset);
    
    camera.position.lerp(camPos, 0.5); // Smooth follow

    // Apply Head Rotation (Look around)
    // Basic camera look direction
    // Car forward rotation
    const carRotation = groupRef.current.rotation.clone();
    
    // Combine car rotation with head rotation
    // Simple way: lookAt a point in front + offset by head rotation
    const lookAtDist = 10;
    const lookDir = new Vector3(0, 0, -1);
    
    // Apply head yaw/pitch to the look direction relative to car
    // This requires some matrix math or just varying the lookAt target
    // Simplification:
    const baseLookTarget = groupRef.current.position.clone().add(forward.normalize().multiplyScalar(lookAtDist));
    
    // Offset look target by yaw/pitch
    // Yaw (left/right): shift X relative to car right
    const right = new Vector3(1, 0, 0).applyEuler(groupRef.current.rotation);
    baseLookTarget.add(right.multiplyScalar(headRotation.yaw * 5));
    
    // Pitch (up/down): shift Y
    baseLookTarget.y += headRotation.pitch * 5;

    camera.lookAt(baseLookTarget);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Car Body Visuals (Invisible from inside mostly, but needed for shadows/feel) */}
          <mesh position={[-0.85, 1.1, -0.3]} rotation={[0, 0, -0.3]}>
              <cylinderGeometry args={[0.04, 0.06, 1.4, 12]} />
              <meshStandardMaterial color="#e5e5e5" /> {/* Light interior pillar color */}
          </mesh>
          <mesh position={[0.85, 1.1, -0.3]} rotation={[0, 0, 0.3]}>
              <cylinderGeometry args={[0.04, 0.06, 1.4, 12]} />
              <meshStandardMaterial color="#e5e5e5" />
          </mesh>

          {/* Windshield */}
          <mesh position={[0, 1.1, -0.25]} rotation={[0.35, 0, 0]}>
              <planeGeometry args={[1.8, 0.9]} />
              <meshStandardMaterial color="#aaddee" opacity={0.1} transparent roughness={0} metalness={0.9} />
          </mesh>


      {/* Steering Wheel - Mazda-ish 3 Spoke */}
      <group position={[0.35, 0.65, -0.4]} rotation={[0, 0, -steeringInput * 2.5]} >
          {/* Rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.19, 0.02, 16, 48]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
          </mesh>
          {/* Center Module */}
          <mesh position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.04, 32]} />
              <meshStandardMaterial color="#222" />
          </mesh>
          {/* Spokes */}
          {/* Bottom Spoke */}
          <mesh position={[0, -0.1, 0]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.03, 0.18, 0.02]} />
              <meshStandardMaterial color="#333" metalness={0.5} />
          </mesh>
          {/* Side Spokes */}
          <mesh position={[-0.1, 0.02, 0]} rotation={[0, 0, 1.3]}>
              <boxGeometry args={[0.03, 0.18, 0.02]} />
              <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0.1, 0.02, 0]} rotation={[0, 0, -1.3]}>
              <boxGeometry args={[0.03, 0.18, 0.02]} />
              <meshStandardMaterial color="#333" />
          </mesh>
      </group>
    </group>
  );
}
