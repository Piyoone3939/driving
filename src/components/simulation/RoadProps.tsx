import { useDrivingStore } from "@/lib/store";
import { MISSION_CHECKPOINTS } from "./MissionController";
import { useMemo } from "react";
import { Text } from "@react-three/drei";

export function RoadProps() {
    const currentLesson = useDrivingStore(state => state.currentLesson);
    const checkpoints = useMemo(() => MISSION_CHECKPOINTS[currentLesson] || [], [currentLesson]);

    return (
        <group>
            {checkpoints.map((cp) => {
                if (cp.type === 'stop') {
                    // Render Stop Line on road + Sign on side
                    return <StopSign key={cp.id} position={cp.position} />;
                } else if (cp.type === 'mirror') {
                    // Render Mirror
                    // Position is usually "check area", but let's assume prop is placed relative to it?
                    // Or we should add `propPosition` to Checkpoint definition? 
                    // For now, place it slightly offset from the check zone center.
                    return <CurveMirror key={cp.id} position={[cp.position[0] - 5, 0, cp.position[2] - 5]} />; 
                    // Warning: offsets are hardcoded. ideally strictly defined.
                }
                return null;
            })}
        </group>
    );
}

function StopSign({ position }: { position: [number, number, number] }) {
    // Stop Line on Road
    // Sign Post on Left (assuming left-hand traffic? Japan is Left.)
    const signPos: [number, number, number] = [-4, 0, position[2]]; // Left side of road

    return (
        <group>
            {/* White Stop Line on Road */}
            <mesh position={[0, 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[8, 0.5]} />
                <meshStandardMaterial color="white" />
            </mesh>

            {/* Sign Post */}
            <group position={signPos}>
                <mesh position={[0, 1.5, 0]}>
                    <cylinderGeometry args={[0.05, 0.05, 3]} />
                    <meshStandardMaterial color="#ccc" />
                </mesh>
                {/* Sign Board (Triangle pointing down) */}
                <mesh position={[0, 2.7, 0]} rotation={[0, 0, 0]}>
                   {/* In Japan, Stop sign is Inverted Red Triangle */}
                   <cylinderGeometry args={[0.6, 0.01, 0.5, 3]} /> 
                   {/* This is a prism/cone. Rotation needed. */}
                </mesh>
                
                {/* Let's mimic Japanese Stop Sign: Inverted Red Triangle with text */}
                <group position={[0, 2.7, 0]} rotation={[Math.PI/2, Math.PI, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.6, 0.6, 0.05, 3]} />
                        <meshStandardMaterial color="#ef4444" />
                    </mesh>
                    <Text position={[0, 0, 0.06]} fontSize={0.3} color="white" rotation={[0,0,Math.PI]}>
                        止まれ
                    </Text>
                </group>
            </group>
        </group>
    );
}

function CurveMirror({ position }: { position: [number, number, number] }) {
    return (
        <group position={[position[0], 0, position[2]]}>
            {/* Pole (Yellow/Orange) */}
            <mesh position={[0, 1.5, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 3]} />
                <meshStandardMaterial color="#f97316" />
            </mesh>
            {/* Mirror (Circle) */}
            <group position={[0, 2.8, 0]} rotation={[0, Math.PI / 4, 0]}>
                <mesh rotation={[0, 0, 0]}>
                    <cylinderGeometry args={[0.5, 0.5, 0.1, 32]} rotation={[Math.PI/2, 0, 0]} />
                    <meshStandardMaterial color="#f97316" />
                </mesh>
                <mesh position={[0, 0, 0.06]} rotation={[Math.PI/2, 0, 0]}>
                    <sphereGeometry args={[0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.2]} />
                    <meshStandardMaterial color="#3b82f6" metalness={0.9} roughness={0.1} />
                </mesh>
            </group>
        </group>
    );
}
