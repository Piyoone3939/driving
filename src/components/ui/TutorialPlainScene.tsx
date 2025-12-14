"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, ContactShadows, Grid } from "@react-three/drei";
import { Car } from "@/components/simulation/Car";

import { Suspense } from "react";

// Simple Low-Poly Tree Component Removed

export default function TutorialPlainScene() {
    return (
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-800/50 border border-slate-600 shadow-inner">
            {/* Reduced pixel ratio and shadows for performance */}
            <Canvas shadows={false} dpr={[1, 1.5]} camera={{ position: [0, 5, 10], fov: 50 }}>
                {/* Lighting: Simplified (No shadows for max performance, or very simple ones) */}
                <ambientLight intensity={0.8} />
                <directionalLight position={[10, 20, 10]} intensity={1.2} />
                <Environment preset="park" />

                <Suspense fallback={null}>
                    {/* The Player Car */}
                    <Car />

                    {/* Infinite Floor / Grid */}
                     <group position={[0, -0.01, 0]}>
                        <Grid 
                            args={[100, 100]} 
                            cellSize={1} 
                            cellThickness={0.5} 
                            cellColor="#6f6f6f" 
                            sectionSize={5} 
                            sectionThickness={1} 
                            sectionColor="#9d4b4b" 
                            fadeDistance={40} 
                            infiniteGrid 
                        />
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
                            <planeGeometry args={[100, 100]} />
                            <meshStandardMaterial color="#1e1e1e" roughness={0.8} />
                        </mesh>
                    </group>

                    {/* Removed Trees as requested */}

                    {/* Removed ContactShadows as it's very performance heavy */}
                </Suspense>
            </Canvas>
            
            {/* Overlay Labels */}
            <div className="absolute top-4 left-4 text-xs font-mono text-white/50 bg-black/40 px-2 rounded pointer-events-none">
                TEST TRACK - FREE DRIVE
            </div>

            {/* Tutorial Video Overlay */}
            <div className="absolute top-4 right-4 w-1/3 min-w-[300px] aspect-video rounded-lg overflow-hidden shadow-lg border border-slate-600 bg-black/80">
                 <video 
                    src="/videos/tutorial.mp4" 
                    className="w-full h-full object-cover"
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    controls
                />
            </div>
        </div>
    );
}
