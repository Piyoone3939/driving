import { useEffect, useRef } from 'react';
import { useDrivingStore } from '@/lib/store';

// config
const SPEED_LIMITS: Record<string, number> = {
    'straight': 60,
    's-curve': 15,
    'crank': 10,
    'left-turn': 20,
    'right-turn': 20
};

const COOLDOWN_MS = 5000;

export function useDrivingFeedback() {
    const { 
        speed, isOffTrack, gaze, currentLesson, missionState, 
        addFeedbackLog 
    } = useDrivingStore();

    const lastLogTimeRef = useRef<number>(0);
    const gazeTimerRef = useRef<number>(0);

    // Optimization: Real-time feedback disabled for performance. 
    // Analysis is now done post-mission in store.ts (calculateMissionResult).
    useEffect(() => {
        // Kept for future real-time features if needed.
    }, []);
}
