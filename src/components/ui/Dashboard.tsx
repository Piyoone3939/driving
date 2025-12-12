
"use client";

import { useDrivingStore } from "@/lib/store";

export function Dashboard() {
  const speed = useDrivingStore(state => state.speed);
  const gear = useDrivingStore(state => state.gear);
  const steering = useDrivingStore(state => state.steeringAngle); // -1 to 1
  const throttle = useDrivingStore(state => state.throttle);
  const brake = useDrivingStore(state => state.brake);
  const feedback = useDrivingStore(state => state.drivingFeedback);
  const isOffTrack = useDrivingStore(state => state.isOffTrack);

  // Speedometer Arc Calculation
  // Max speed visual 100km/h
  const maxSpeedVis = 100;
  const speedRatio = Math.min(speed / maxSpeedVis, 1);
  const dashOffset = 283 - (283 * speedRatio); // 2 * pi * 45 (r) ~= 283

  return (
    <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
        zIndex: 50 // Ensure high z-index
    }}>
      
      {/* 
        HEADS UP DISPLAY (HUD) LAYER 
        Projected "on glass" feeling
      */}
      
      {/* 
        1. MECHANICAL INSTRUMENT CLUSTER LAYER (Bottom)
        REMOVED as per user request ("Remove speedometer")
      */}

      {/* 
        2. HEADS UP DISPLAY (HUD) LAYER
        REMOVED speed and pedals as per user request.
        Only Critical Warnings remain.
      */}

      {/* Warning Overlay (HUD Style) */}
      {isOffTrack && (
          <div style={{
              position: 'absolute',
              top: '30%',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#ef4444',
              textAlign: 'center',
              animation: 'blink 0.5s infinite'
          }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '4px', border: '2px solid #ef4444', padding: '10px 20px', borderRadius: '4px', backgroundColor: 'rgba(50,0,0,0.5)' }}>
                  WARNING
              </div>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>OFF TRACK</div>
          </div>
      )}

      <style jsx>{`
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
