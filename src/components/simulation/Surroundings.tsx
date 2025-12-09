"use client";

import { Sky, Stars } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { getCoursePath } from "@/lib/course";
import { useDrivingStore } from "@/lib/store";

export function Surroundings() {
  const currentLesson = useDrivingStore(state => state.currentLesson);
  
  // Generate trees along the path (offset from center)
  const trees = useMemo(() => {
     const path = getCoursePath(currentLesson);
     const points = path.getSpacedPoints(100); // 100 trees
     const treeData: { position: [number, number, number], scale: number }[] = [];

     points.forEach((pt, i) => {
         // Add trees on left and right
         // Calculate normal (side vector)
         // Simple approx: get direction to next point
         const nextPt = points[Math.min(i + 1, points.length - 1)];
         const dir = new THREE.Vector3().subVectors(nextPt, pt).normalize();
         const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize(); // Perpendicular in XZ
         
         // Left Tree
         const offsetL = 15 + Math.random() * 10;
         const posL = pt.clone().add(right.clone().multiplyScalar(-offsetL));
         treeData.push({ position: [posL.x, 0, posL.z], scale: 0.8 + Math.random() * 0.5 });

         // Right Tree
         const offsetR = 15 + Math.random() * 10;
         const posR = pt.clone().add(right.clone().multiplyScalar(offsetR));
         treeData.push({ position: [posR.x, 0, posR.z], scale: 0.8 + Math.random() * 0.5 });
     });

     return treeData;
  }, [currentLesson]);

  return (
    <group>
        <Sky sunPosition={[100, 20, 100]} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {/* Simple Ground Visuals (Grass) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
            <planeGeometry args={[1000, 1000]} />
            <meshStandardMaterial color="#355e3b" />
        </mesh>

        {/* Trees */}
        {trees.map((t, i) => (
            <group key={i} position={t.position as any} scale={[t.scale, t.scale, t.scale]}>
                {/* Trunk */}
                <mesh position={[0, 1, 0]} castShadow>
                    <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
                    <meshStandardMaterial color="#4a3728" />
                </mesh>
                {/* Leaves */}
                <mesh position={[0, 3, 0]} castShadow>
                     <coneGeometry args={[1.5, 3, 8]} />
                     <meshStandardMaterial color="#228b22" />
                </mesh>
                <mesh position={[0, 4.5, 0]} castShadow>
                     <coneGeometry args={[1.2, 2.5, 8]} />
                     <meshStandardMaterial color="#228b22" />
                </mesh>
            </group>
        ))}
    </group>
  );
}
