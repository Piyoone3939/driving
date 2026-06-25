"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

import { Car } from "./Car";
import { Road } from "./Road";
import { RoadProps } from "./RoadProps";
import { Surroundings } from "./Surroundings";
import { ThreeModelLoader } from "./ThreeModelLoader";

import { MISSION_GOALS } from "@/lib/mission/missions";
import { MissionController } from "./MissionController";
import { useDrivingStore } from "@/lib/store";
import { Text } from "@react-three/drei";
import { TrafficSystem } from "./TrafficSystem";

export function Scene({ cameraTarget = "player" }: { cameraTarget?: "player" | "ghost" }) {
  const currentLesson = useDrivingStore((s) => s.currentLesson);
  const isFreeMode = currentLesson === "free-mode";

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#0f172a", position: "absolute", top: 0, left: 0 }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.2, 0.5], fov: 75 }}
        gl={{ antialias: true, toneMappingExposure: 1.0 }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <Suspense fallback={null}>
          {/* Distance haze for depth; tuned far so near gameplay + the GOAL stay clear. */}
          <fog attach="fog" args={["#dbe4ea", 100, 470]} />

          {/* Sky, the light rig, and the reflection environment all live in <Surroundings>
              so there is a single source of truth for scene lighting. */}
          <Surroundings />

          <Car cameraTarget={cameraTarget} />

          {/* Mission-related elements are not shown in free-mode. MissionController
              MUST be mounted after <Car> (mount order) so its grading useFrame runs
              after Car's physics + transform write within the same tick. */}
          {!isFreeMode && (
            <>
              <Road />
              <RoadProps />
              <GoalMarker />
              <MissionController />
              <TrafficSystem />
            </>
          )}

          {/* The city is shown only in free-mode (could be shown always too) */}
          {isFreeMode && (
            <>
              <ThreeModelLoader url="/models/city.glb" position={[16, 0, -100]} rotation={[0, Math.PI / 2, 0]} scale={0.01} />
              <TrafficSystem />
            </>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

function GoalMarker() {
  const currentLesson = useDrivingStore((state) => state.currentLesson);
  const goal = MISSION_GOALS[currentLesson];

  if (!goal) return null;

  return (
    <group position={[goal.position[0], goal.position[1], goal.position[2]]} rotation={[0, goal.rotation, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[goal.size[0], goal.size[1], goal.size[2]]} />
        <meshStandardMaterial color="#4ade80" transparent opacity={0.3} />
      </mesh>

      <Text position={[0, 4, 0]} fontSize={3} color="#4ade80" anchorX="center" anchorY="middle" outlineWidth={0.1} outlineColor="#000000">
        GOAL
      </Text>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[3, 4, 32]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
