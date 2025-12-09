"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useDrivingStore } from "@/lib/store";
import { getCoursePath } from "@/lib/course";

export function Road() {
  const currentLesson = useDrivingStore(state => state.currentLesson);

  const { roadGeo, curbGeo, lineGeo } = useMemo(() => {
    const path = getCoursePath(currentLesson);
    const steps = 200; // Smoother curve

 
    
    // Original Extrude Logic as fallback/standard
    // 1. Asphalt Road Surface
    const roadShape = new THREE.Shape();
    const width = 3.5; // Lane width approx
    roadShape.moveTo(-width, 0);
    roadShape.lineTo(width, 0);
    roadShape.lineTo(width, 0.05); // Very thin
    roadShape.lineTo(-width, 0.05);

    const roadGeo = new THREE.ExtrudeGeometry(roadShape, {
        extrudePath: path,
        steps: steps,
        bevelEnabled: false
    });
    
    // Fix orientation for Straight lines if ExtrudeGeometry messed up
    if (currentLesson === 'straight') {
         // It seems straight lines extrude vertically (Normal along X?)
         // We rotate -90 degrees around Z axis to lay it flat??
         // Or 90?
         // Let's guess: "Thin wall stretching".
         // Typically it stands up.
         // Let's look at the shape: width 7, height 0.05.
         // If it stands up, it's 7 high.
         // We want 7 wide.
         // Rotation by 90 deg (PI/2) should fix it.
         roadGeo.rotateZ(Math.PI / 2);
    }

    // 2. Curbs (Side stones)
    const curbShape = new THREE.Shape();
    const curbW = 0.3;
    const curbH = 0.15;
    // Left Curb
    curbShape.moveTo(-width - curbW, 0);
    curbShape.lineTo(-width, 0);
    curbShape.lineTo(-width, curbH);
    curbShape.lineTo(-width - curbW, curbH);
    
    const rightCurbShape = new THREE.Shape();
    rightCurbShape.moveTo(width, 0);
    rightCurbShape.lineTo(width + curbW, 0);
    rightCurbShape.lineTo(width + curbW, curbH);
    rightCurbShape.lineTo(width, curbH);
    
    const curbGeo = new THREE.ExtrudeGeometry([curbShape, rightCurbShape], {
        extrudePath: path,
        steps: steps,
        bevelEnabled: false
    });
    
    if (currentLesson === 'straight') {
         curbGeo.rotateZ(Math.PI / 2);
    }

    // 3. Center Line
    const lineShape = new THREE.Shape();
    const lineW = 0.1;
    lineShape.moveTo(-lineW, 0.06); // Slightly above road
    lineShape.lineTo(lineW, 0.06);
    lineShape.lineTo(lineW, 0.06); // Flat
    lineShape.lineTo(-lineW, 0.06);

    const lineGeo = new THREE.ExtrudeGeometry(lineShape, {
        extrudePath: path,
        steps: steps,
        bevelEnabled: false
    });
    
    if (currentLesson === 'straight') {
         lineGeo.rotateZ(Math.PI / 2);
    }

    return { roadGeo, curbGeo, lineGeo };
    
  }, [currentLesson]);

  return (
    <group>
      {/* Ground (Grass) handled in Surroundings, but just in case of gaps */}
      {/* Road Asphalt */}
      <mesh geometry={roadGeo} receiveShadow>
         <meshStandardMaterial color="#333333" roughness={0.8} />
      </mesh>

      {/* Curbs (Concrete) */}
      <mesh geometry={curbGeo} receiveShadow castShadow>
         <meshStandardMaterial color="#999999" roughness={0.9} />
      </mesh>

      {/* Center Line (White) */}
      {/* 
         Solid line for now. For dashed, we'd need a texture or shader, 
         or break the geometry. Solid is fine for "No Passing" or just ease.
         Let's assume white center line.
      */}
      <mesh geometry={lineGeo}>
         <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
