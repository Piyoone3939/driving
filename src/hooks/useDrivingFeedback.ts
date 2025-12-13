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

    useEffect(() => {
        if (missionState !== 'active') return;

        const now = Date.now();
        if (now - lastLogTimeRef.current < COOLDOWN_MS) return;

        // 1. Route Accuracy
        if (isOffTrack) {
            addFeedbackLog({
                time: now,
                type: 'KAIZEN',
                message: 'コースを逸脱しています。'
            });
            lastLogTimeRef.current = now;
            return; 
        }

        // 2. Speed Check
        const limit = SPEED_LIMITS[currentLesson] || 40;
        if (speed > limit + 5) { // Buffer +5
             addFeedbackLog({
                time: now,
                type: 'KAIZEN',
                message: `${currentLesson === 'crank' ? 'クランク' : '走行'}速度が速すぎます (${Math.floor(speed)}km/h)`
            });
            lastLogTimeRef.current = now;
            return;
        }

        // 3. Gaze Check
        // If gaze.x is mostly > 0.6 or < -0.6 for 2 seconds
        if (Math.abs(gaze.x) > 0.8) { // Threshold
            if (gazeTimerRef.current === 0) gazeTimerRef.current = now;
            else if (now - gazeTimerRef.current > 2000) {
                 addFeedbackLog({
                    time: now,
                    type: 'KAIZEN',
                    message: 'わき見運転検知：前方を確認してください'
                });
                lastLogTimeRef.current = now;
                gazeTimerRef.current = 0; // Reset
            }
        } else {
            gazeTimerRef.current = 0;
        }

    }, [speed, isOffTrack, gaze, currentLesson, missionState, addFeedbackLog]);
}
