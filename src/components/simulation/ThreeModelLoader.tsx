"use client";

import { useGLTF } from "@react-three/drei";
import { GroupProps } from "@react-three/fiber";
import { Euler } from "three";

type ThreeModelLoaderProps = GroupProps & {
  /** 読み込む glTF / glb モデルのパス */
  url: string;
  scale?: number | [number, number, number];
  rotation?: Euler | [number, number, number];
};

export function ThreeModelLoader({
  url,
  scale = 1,
  rotation = [0, 0, 0],
  ...props
}: ThreeModelLoaderProps) {
  const { scene } = useGLTF(url);

  return (
    <primitive
      object={scene}
      scale={scale}
      rotation={rotation}
      {...props}
    />
  );
}
