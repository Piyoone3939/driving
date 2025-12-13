"use client";

import { useDrivingStore } from "@/lib/store";

const LESSONS = [
  { id: 'straight', label: '直線' },
  { id: 'left-turn', label: '左折' },
  { id: 'right-turn', label: '右折' },
  { id: 's-curve', label: 'S字' },
  { id: 'crank', label: 'クランク' },
] as const;

export function LessonSelector() {
  const currentLesson = useDrivingStore(state => state.currentLesson);
  const setLesson = useDrivingStore(state => state.setLesson);
  const missionState = useDrivingStore(state => state.missionState);

  if (missionState === 'active') return null;

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      display: 'flex',
      gap: '10px',
    }}>
      {LESSONS.map((lesson) => (
        <button
          key={lesson.id}
          onClick={(e) => {
            e.stopPropagation();
            setLesson(lesson.id);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: currentLesson === lesson.id ? '#ffffff' : 'rgba(0,0,0,0.6)',
            color: currentLesson === lesson.id ? '#000000' : '#ffffff',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backdropFilter: 'blur(4px)',
            boxShadow: currentLesson === lesson.id ? '0 0 10px rgba(255,255,255,0.5)' : 'none'
          }}
        >
          {lesson.label}
        </button>
      ))}
    </div>
  );
}
