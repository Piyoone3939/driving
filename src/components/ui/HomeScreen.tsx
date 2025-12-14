import { useDrivingStore } from "@/lib/store";
import { GarageScene } from "../simulation/GarageScene";

const LESSONS = [
  { id: 'straight', label: '直線走行', sub: 'LEVEL 01', desc: 'BASIC CONTROL', icon: 'START' },
  { id: 'left-turn', label: '左折', sub: 'LEVEL 02', desc: 'TURNING LEFT', icon: 'LEFT' },
  { id: 'right-turn', label: '右折', sub: 'LEVEL 03', desc: 'TURNING RIGHT', icon: 'RIGHT' },
  { id: 's-curve', label: 'S字カーブ', sub: 'LEVEL 04', desc: 'S-CURVE', icon: 'S' },
  { id: 'crank', label: 'クランク', sub: 'LEVEL 05', desc: 'CRANK', icon: 'C' },
] as const;

export function HomeScreen() {
  const setLesson = useDrivingStore(state => state.setLesson);
  const setScreen = useDrivingStore(state => state.setScreen);
  const setMissionState = useDrivingStore(state => state.setMissionState);
  const user = useDrivingStore(state => state.user);

  const handleSelectLesson = (lessonId: (typeof LESSONS)[number]["id"]) => {
    setLesson(lessonId);
    setMissionState('briefing');
    setScreen('driving');
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black text-white font-sans selection:bg-blue-500 selection:text-white">

      {/* 3D Background - z-0 */}
      <div className="absolute inset-0 z-0">
          <GarageScene />
      </div>

      {/* Overlay UI - z-10 */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none">

          {/* Top Bar */}
          <div className="w-full p-8 flex justify-between items-start pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
              <div>
                  <h1 className="text-5xl font-extrabold italic tracking-tighter text-white drop-shadow-md">
                      VIRTUAL <span className="text-blue-500">DRIVING</span> SCHOOL
                  </h1>
                  <p className="text-sm font-bold text-slate-400 tracking-[0.3em] mt-2">SIMULATION SYSTEM v2.0</p>
              </div>
          </div>

          {/* Bottom Area: Carousel */}
          <div className="w-full p-8 pb-12 pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end">
              <div className="mb-4 flex items-end gap-4 border-b border-white/20 pb-2 max-w-4xl">
                  <h2 className="text-2xl font-bold tracking-wider text-white">SELECT COURSE</h2>
                  <span className="text-sm text-blue-400 font-mono mb-1 animate-pulse">/ ALL SYSTEMS READY</span>
              </div>

              <div className="flex items-end gap-6 overflow-x-auto pb-4 pt-2 snap-x">
                  {LESSONS.map((lesson, index) => (
                      <button
                          key={lesson.id}
                          onClick={() => handleSelectLesson(lesson.id)}
                          className="group relative flex-shrink-0 w-72 h-48 bg-slate-900/80 border-t-4 border-slate-600 hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] snap-center overflow-hidden"
                          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 90% 100%, 0 100%)' }}
                      >
                          {/* Background Gradient on Hover */}
                          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/0 to-blue-900/20 group-hover:to-blue-600/20 transition-all duration-300" />

                          {/* Inner Content */}
                          <div className="absolute inset-0 p-6 flex flex-col justify-between text-left">
                              <div className="flex justify-between items-start">
                                  <span className="text-xs font-black text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 group-hover:text-blue-400 group-hover:border-blue-500/50 transition-colors">
                                      {lesson.sub}
                                  </span>
                                  <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-slate-700'}`} />
                              </div>

                              <div>
                                  <h3 className="text-2xl font-black italic text-white group-hover:text-blue-300 mb-1">
                                      {lesson.label}
                                  </h3>
                                  <p className="text-xs text-slate-400 font-mono">{lesson.desc}</p>
                              </div>

                              <div className="flex justify-between items-end">
                                  <div className="text-4xl font-black text-slate-800 group-hover:text-slate-700 select-none">
                                      0{index + 1}
                                  </div>

                                  <span className="text-sm font-bold text-blue-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                                      START <span className="text-lg">»</span>
                                  </span>
                              </div>
                          </div>
                      </button>
                  ))}

                  {/* Empty spacer for scroll padding */}
                  <div className="w-12 flex-shrink-0" />
              </div>
          </div>
      </div>
    </div>
  );
}
