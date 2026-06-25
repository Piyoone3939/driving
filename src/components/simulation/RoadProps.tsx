import { useDrivingStore } from "@/lib/store";
import { MISSION_CHECKPOINTS } from "@/lib/mission/missions";
import { useEffect, useMemo, useState } from "react";

type SignalState = "green" | "yellow" | "red";

const SIGNAL_CYCLE: { state: SignalState; durationMs: number }[] = [
    { state: "green", durationMs: 7000 },
    { state: "yellow", durationMs: 2000 },
    { state: "red", durationMs: 6000 },
];

const MODEL_BY_STATE: Record<SignalState, string> = {
    green: "/models/traffic_light_green.glb",
    yellow: "/models/traffic_light_yellow.glb",
    red: "/models/traffic_light_red.glb",
};
import { Text } from "@react-three/drei";
import { ThreeModelLoader } from "./ThreeModelLoader";

export function RoadProps() {
    const currentLesson = useDrivingStore(state => state.currentLesson);
    const checkpoints = useMemo(() => MISSION_CHECKPOINTS[currentLesson] || [], [currentLesson]);

    return (
        <group>
            {checkpoints.map((cp) => {
                if (cp.type === 'stop') {
                    if (cp.visual === "traffic-light") {
                        return (
                            <TrafficLight
                                key={cp.id}
                                id={cp.id}
                                position={cp.position}
                                orientation={cp.orientation || "z"}
                            />
                        );
                    }
                    return <StopSign key={cp.id} position={cp.position} orientation={cp.orientation || "z"} />;
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

function StopSign({ position, orientation = "z" }: { position: [number, number, number]; orientation?: "z" | "x" }) {
    const isXAxis = orientation === "x";
    const lineRotation: [number, number, number] = isXAxis ? [-Math.PI / 2, Math.PI / 2, 0] : [-Math.PI / 2, 0, 0];
    const signPos: [number, number, number] = isXAxis ? [position[0], 0, position[2] + 4] : [-4, 0, position[2]];

    // Stop Line on Road
    // Sign Post on Left (assuming left-hand traffic? Japan is Left.)
    return (
        <group>
            {/* White Stop Line on Road */}
            <mesh position={[position[0], 0.02, position[2]]} rotation={lineRotation}>
                <planeGeometry args={[8, 0.5]} />
                <meshStandardMaterial color="white" />
            </mesh>

            {/* Sign Post */}
            <group position={signPos}>
                <mesh position={[0, 1.5, 0]} castShadow>
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
                    <mesh castShadow>
                        <cylinderGeometry args={[0.6, 0.6, 0.05, 3]} />
                        <meshStandardMaterial color="#ef4444" />
                    </mesh>
                    <Text position={[0, 0, 0.06]} fontSize={0.3} color="white" rotation={[0,0,Math.PI]}>
                        STOP
                    </Text>
                </group>
            </group>
        </group>
    );
}

function TrafficLight({
    id,
    position,
    orientation = "z",
}: {
    id: string;
    position: [number, number, number];
    orientation?: "z" | "x";
}) {
    const isXAxis = orientation === "x";
    const lineRotation: [number, number, number] = isXAxis ? [-Math.PI / 2, Math.PI / 2, 0] : [-Math.PI / 2, 0, 0];
    const polePos: [number, number, number] = isXAxis ? [position[0], 0, position[2] + 4] : [-4, 0, position[2]];
    const headRotation: [number, number, number] = isXAxis ? [0, Math.PI / 2, 0] : [0, 0, 0];
    const [signalIndex, setSignalIndex] = useState(0);

    useEffect(() => {
        const currentState = SIGNAL_CYCLE[signalIndex].state;
        // Log current signal state to the store so post-run analysis can reconstruct what drivers saw
        try {
            useDrivingStore.getState().addSignalStateLog({ time: Date.now(), checkpointId: id, state: currentState });
        } catch {
            // noop
        }

        const { durationMs } = SIGNAL_CYCLE[signalIndex];
        const timer = setTimeout(() => {
            setSignalIndex((prev) => (prev + 1) % SIGNAL_CYCLE.length);
        }, durationMs);

        return () => clearTimeout(timer);
    }, [signalIndex, id]);

    const currentState = SIGNAL_CYCLE[signalIndex].state;

    return (
        <group>
            {/* Stop line for the signal */}
            <mesh position={[position[0], 0.02, position[2]]} rotation={lineRotation}>
                <planeGeometry args={[8, 0.5]} />
                <meshStandardMaterial color="white" />
            </mesh>

            {/* 3D traffic light model */}
            <ThreeModelLoader
                url={MODEL_BY_STATE[currentState]}
                position={polePos}
                rotation={headRotation}
                scale={1}
            />
        </group>
    );
}

function CurveMirror({ position }: { position: [number, number, number] }) {
    return (
        <group position={[position[0], 0, position[2]]}>
            {/* Pole (Yellow/Orange) */}
            <mesh position={[0, 1.5, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 3]} />
                <meshStandardMaterial color="#f97316" />
            </mesh>
            {/* Mirror (Circle) */}
            <group position={[0, 2.8, 0]} rotation={[0, Math.PI / 4, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.5, 0.5, 0.1, 32]} />
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
