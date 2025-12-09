"use client";

import { useEffect } from "react";
import { useDrivingStore } from "@/lib/store";

export default function KeyboardControls() {
  const setPedals = useDrivingStore((state) => state.setPedals);
  const setDebugInfo = useDrivingStore((state) => state.setDebugInfo);

  useEffect(() => {
    // Track key states
    const keys = {
      ArrowUp: false,
      w: false,
      ArrowDown: false,
      s: false,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (Object.prototype.hasOwnProperty.call(keys, e.key)) {
         // @ts-ignore
         keys[e.key] = true;
         updatePedals();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (Object.prototype.hasOwnProperty.call(keys, e.key)) {
         // @ts-ignore
         keys[e.key] = false;
         updatePedals();
      }
    };

    const updatePedals = () => {
      // Simple boolean logic for now. 
      // Future: Ramp up/down logic can be here or in Car physics.
      // Car physics has acceleration, so instant 0/1 input is fine.
      
      const gas = (keys.ArrowUp || keys.w) ? 1.0 : 0.0;
      const brake = (keys.ArrowDown || keys.s) ? 1.0 : 0.0;
      
      setPedals(gas, brake);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setPedals]);

  return null; // Logic only component
}
