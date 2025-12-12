"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows, Float, Stars } from "@react-three/drei";
import { ExternalCarVisuals } from "./Car";
import { Suspense, useRef } from "react";
import { Group } from "three";

function RotatingCar() {
    const meshRef = useRef<Group>(null);
    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5;
        }
    });

    return (
        <group ref={meshRef}>
            <ExternalCarVisuals />
        </group>
    );
}

export function GarageScene() {
    return (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 bg-slate-900">
            <Canvas camera={{ position: [4, 2, 6], fov: 50 }}>
                {/* Basic Lighting */}
                <ambientLight intensity={1.5} />
                <pointLight position={[10, 10, 10]} intensity={2} />
                <spotLight position={[0, 5, 0]} angle={0.5} penumbra={1} intensity={3} castShadow />
                
                <Suspense fallback={null}>
                     {/* Car Model (Rotating) */}
                     <group position={[0, -0.5, 0]} rotation={[0, -0.5, 0]}>
                         <RotatingCar />
                     </group>

                     <ContactShadows position={[0, -0.1, 0]} opacity={0.6} scale={10} blur={2} far={4} color="#000000" />
                     <gridHelper args={[20, 20, 0x444444, 0x222222]} position={[0, -0.05, 0]} />
                </Suspense>
            </Canvas>
        </div>
    );
}
