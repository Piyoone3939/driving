"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Sky } from "@react-three/drei";

import { Car } from "./Car";
import { Road } from "./Road";
import { Surroundings } from "./Surroundings";
import { Suspense } from "react";

export function Scene() {
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
          
          <Car />
          <Road />
          
          {/* Helper controls for debugging, eventually remove or limit */}
          {/* <OrbitControls /> */}
        </Suspense>
      </Canvas>
    </div>
  );
}
