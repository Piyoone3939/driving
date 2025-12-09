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
    // Define shape in "Side View" where Y is width and X is height (or vice versa? Extrude moves along Z).
    // Standard Extrude: Shape X->X, Shape Y->Y.
    // We want Result X=Width, Result Y=Height.
    // If Path is along Z, and Frenet Frame is standard:
    // Tangent=Z, Normal=X, Binormal=Y.
    // So Shape X maps to Normal (World X), Shape Y maps to Binormal (World Y).
    // So X should be Width, Y should be Height.
    // WAIT. If that was true, the original code (X=Width, Y=Height) should have been correct for Straight.
    // But Straight needed rotateZ(90). That means Shape X was mapping to World Y (Height).
    // So Normal was Up?
    // Let's TRY swapping them so Shape Y is Width.
    // Shape Y maps to Binormal -> World Y? No.
    // If X mapped to Y, then Y maps to -X or something?
    // Let's define the shape such that "Width" is on Y, and "Height" is on X.
    roadShape.moveTo(0, -width);
    roadShape.lineTo(0, width);
    roadShape.lineTo(0.05, width); // Height
    roadShape.lineTo(0.05, -width);

    const roadGeo = new THREE.ExtrudeGeometry(roadShape, {
        extrudePath: path,
        steps: steps,
        bevelEnabled: false
    });
    
    // No rotations needed.

    // 2. Curbs (Side stones)
    const curbShape = new THREE.Shape();
    const curbW = 0.3;
    const curbH = 0.15;
    // Left Curb (relative to road width)
    // Width is on Y axis now.
    // Left means "Negative Y" (if Y is width).
    curbShape.moveTo(0, -width - curbW);
    curbShape.lineTo(0, -width);
    curbShape.lineTo(curbH, -width);
    curbShape.lineTo(curbH, -width - curbW);
    
    const rightCurbShape = new THREE.Shape();
    rightCurbShape.moveTo(0, width);
    rightCurbShape.lineTo(0, width + curbW);
    rightCurbShape.lineTo(curbH, width + curbW);
    rightCurbShape.lineTo(curbH, width);
    
    const curbGeo = new THREE.ExtrudeGeometry([curbShape, rightCurbShape], {
        extrudePath: path,
        steps: steps,
        bevelEnabled: false
    });

    // 3. Center Line
    const lineShape = new THREE.Shape();
    const lineW = 0.1;
    // Position slightly "above" road. Road is X=[0, 0.05]. Line should be X=0.06.
    lineShape.moveTo(0.06, -lineW); 
    lineShape.lineTo(0.06, lineW);
    lineShape.lineTo(0.06, lineW); 
    lineShape.lineTo(0.06, -lineW);

    const lineGeo = new THREE.ExtrudeGeometry(lineShape, {
        extrudePath: path,
        steps: steps,
        bevelEnabled: false
    });

    return { roadGeo, curbGeo, lineGeo };
    
  }, [currentLesson]);

  return (
    <group>
      {/* Ground (Grass) handled in Surroundings, but just in case of gaps */}
      {/* Road Asphalt */}
      <mesh geometry={roadGeo} receiveShadow>
         <meshStandardMaterial color="#333333" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Curbs (Concrete) */}
      <mesh geometry={curbGeo} receiveShadow castShadow>
         <meshStandardMaterial color="#999999" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Center Line (White) */}
      {/* 
         Solid line for now. For dashed, we'd need a texture or shader, 
         or break the geometry. Solid is fine for "No Passing" or just ease.
         Let's assume white center line.
      */}
      <mesh geometry={lineGeo}>
         <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
