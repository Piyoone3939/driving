"use client";

import { useDrivingStore } from "@/lib/store";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

export function GoalEffects() {
  const missionState = useDrivingStore((state) => state.missionState);

  if (missionState !== 'success') return null;

  return <Confetti />;
}

function Confetti() {
  const count = 200;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Random initial positions and velocities
  const [positions, velocities, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorPalette = [
        new THREE.Color("#ff0000"),
        new THREE.Color("#00ff00"),
        new THREE.Color("#0000ff"),
        new THREE.Color("#ffff00"),
        new THREE.Color("#ff00ff"),
        new THREE.Color("#00ffff"),
    ];

    for (let i = 0; i < count; i++) {
      // Start high up above the car (roughly 0,0,0 as goal is near)
      // Goal position depends on lesson but let's just spawn around player or goal?
      // For simplicity, spawn in a volume around 0,10,0 to 0,20,-100 covering most goals
      // Better: Spawn "At Goal Marker"? 
      // Let's spawn relative to local view, or just world space if we knew where goal is.
      // Since car stops at goal, let's visual relative to car?
      // But Confetti is world space.
      // Let's just make a "Fountain" effect that plays once.
      
      const x = (Math.random() - 0.5) * 20;
      const y = 5 + Math.random() * 10; 
      const z = (Math.random() - 0.5) * 20;
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      vel[i * 3] = (Math.random() - 0.5) * 0.2;
      vel[i * 3 + 1] = -0.05 - Math.random() * 0.1; // Falling
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    return [pos, vel, col];
  }, []);

  const dummy = new THREE.Object3D();

  useFrame(() => {
    if (!meshRef.current) return;

    // Update positions
    for (let i = 0; i < count; i++) {
        // Apply velocity
        positions[i*3] += velocities[i*3];
        positions[i*3+1] += velocities[i*3+1];
        positions[i*3+2] += velocities[i*3+2];

        // Reset if too low (looping fountain)
        if(positions[i*3+1] < 0) {
            positions[i*3+1] = 10 + Math.random() * 5;
            // Respawn centered-ish
             // Get goal position? Tough. Let's just assume we are watching the car.
             // If we attach this component to the car it moves with it.
             // But let's keep it simple world space for now.
        }

        // Sway
        positions[i*3] += Math.sin(Date.now() * 0.001 + i) * 0.01;

        dummy.position.set(positions[i*3], positions[i*3+1], positions[i*3+2]);
        dummy.rotation.x += 0.1;
        dummy.rotation.y += 0.1;
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    // Attach to camera or car? 
    // To make it visible regardless of where goal is, let's put it in a Group updates with Car?
    // Or just "Screen Space" confetti?
    // Let's try attaching to the car's general vicinity in Scene.
    // If we put it in Scene, it's at 0,0,0.
    // We need it near the car.
    // Actually, let's make it a child of the Car in logic, or pass Car Position.
    // For MVP, let's spawn it in front of the camera using createPortal? No.
    // Let's just make it huge area.
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <planeGeometry args={[0.2, 0.2]} />
      <meshBasicMaterial side={THREE.DoubleSide} vertexColors />
    </instancedMesh>
  );
}
