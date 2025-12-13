"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Sky } from "@react-three/drei";

import { Car } from "./Car";

import { Road } from "./Road";
import { RoadProps } from "./RoadProps";
import { Surroundings } from "./Surroundings";
import { Suspense } from "react";

export function Scene({ cameraTarget = 'player' }: { cameraTarget?: 'player' | 'ghost' }) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', position: 'absolute', top: 0, left: 0 }}>
      {/* Optimization: Shadows disabled for performance */}
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.2, 0.5], fov: 75 }} style={{ width: '100%', height: '100%', display: 'block' }}>
        {/* <color attach="background" args={['#87CEEB']} /> */}
        {/* <fog attach="fog" args={['#87CEEB', 20, 100]} /> */}

        <Suspense fallback={null}>
          <Surroundings />

          {/* Lights */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
          />

          {/* GoalEffects removed */}
          <Car cameraTarget={cameraTarget} />
          <Road />
          <RoadProps />
          <GoalMarker />

          {/* Helper controls for debugging, eventually remove or limit */}
          {/* <OrbitControls /> */}
        </Suspense>
      </Canvas>
    </div>
  );
}

import { MISSION_GOALS } from "./MissionController";
import { useDrivingStore } from "@/lib/store";
import { Text } from "@react-three/drei";

function GoalMarker() {
    const currentLesson = useDrivingStore(state => state.currentLesson);
    const goal = MISSION_GOALS[currentLesson];

    if (!goal) return null;

    return (
        <group position={[goal.position[0], goal.position[1], goal.position[2]]} rotation={[0, goal.rotation, 0]}>
            {/* Goal Area Box (Transparent) */}
            <mesh position={[0, 1.5, 0]}>
                <boxGeometry args={[goal.size[0], goal.size[1], goal.size[2]]} />
                <meshStandardMaterial color="#4ade80" transparent opacity={0.3} />
            </mesh>

            {/* Floating Text */}
            <Text
                position={[0, 4, 0]}
                fontSize={3}
                color="#4ade80"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.1}
                outlineColor="#000000"
            >
                GOAL
            </Text>

            {/* Checkered Flag Pattern on floor? Or just glowing ring */}
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
                <ringGeometry args={[3, 4, 32]} />
                <meshBasicMaterial color="#ffff00" transparent opacity={0.5} />
            </mesh>
        </group>
    );
}
