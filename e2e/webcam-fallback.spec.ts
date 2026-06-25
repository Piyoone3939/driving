import { test, expect, type Page } from "@playwright/test";

// Shape of the opt-in debug hook exposed on `window.__drivingStore` when the
// page is loaded with `?e2e` (see src/lib/store.ts).
type E2EState = {
  steeringAngle: number;
  screen: string;
  missionState: string;
  replayData: unknown[];
  setLesson: (lesson: string) => void;
  setScreen: (screen: string) => void;
  setMissionState: (state: string) => void;
};
type E2EStore = { getState: () => E2EState };
type E2EWindow = Window & { __drivingStore?: E2EStore };

const STEER_AMOUNT = 0.6; // mirrors KeyboardControls.tsx

// Force getUserMedia to reject with NotAllowedError BEFORE app scripts run, so:
//  (1) the vision loop never starts and therefore never overrides steering, and
//  (2) the camera-denied fallback path is exercised.
async function denyCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const reject = () =>
      Promise.reject(new DOMException("denied by e2e test", "NotAllowedError"));
    try {
      if (!navigator.mediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", {
          value: {},
          configurable: true,
        });
      }
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: reject,
        configurable: true,
      });
    } catch {
      // If the property cannot be redefined in this browser, the test that
      // depends on it will surface the failure clearly.
    }
  });
}

// Navigate from a fresh load into the driving screen via Free Mode, which goes
// straight to active driving (no briefing overlay to dismiss).
async function startFreeDrive(page: Page): Promise<void> {
  // Skip the first-launch language picker: a fresh browser has no saved
  // language, so the store routes to the LanguageScreen picker instead of Home
  // and the Free Mode button is absent. Seed "ja" so it goes straight to Home
  // with the button labelled フリーモード. (The camera-denied overlay text is
  // hardcoded English regardless of language — see the assertions below.)
  await page.addInitScript(() => localStorage.setItem("language", "ja"));
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: /フリーモード/ }).click();
  await page.waitForFunction(
    () => (window as unknown as E2EWindow).__drivingStore?.getState().screen === "driving",
    undefined,
    { timeout: 30_000 },
  );
  // Let KeyboardControls' effect attach its window keydown/keyup listeners.
  await page.waitForTimeout(500);
}

function steeringAngle(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as E2EWindow).__drivingStore!.getState().steeringAngle,
  );
}

test("keyboard steering works as the fallback when the camera is unavailable", async ({
  page,
}) => {
  await denyCamera(page);
  await startFreeDrive(page);

  expect(await steeringAngle(page)).toBe(0);

  await page.keyboard.down("ArrowRight");
  await expect.poll(() => steeringAngle(page)).toBe(STEER_AMOUNT);
  await page.keyboard.up("ArrowRight");
  await expect.poll(() => steeringAngle(page)).toBe(0);

  await page.keyboard.down("ArrowLeft");
  await expect.poll(() => steeringAngle(page)).toBe(-STEER_AMOUNT);
  await page.keyboard.up("ArrowLeft");
  await expect.poll(() => steeringAngle(page)).toBe(0);
});

// Camera acquisition is decoupled from MediaPipe model loading (see
// VisionController.acquireCamera), so the denial overlay appears promptly and
// independently of the CDN — this test is deterministic, no network dependency.
test("camera-denied shows the keyboard-fallback overlay", async ({ page }) => {
  await denyCamera(page);
  await startFreeDrive(page);

  await expect(page.getByText("📷 Camera unavailable")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("Camera access was denied", { exact: false }),
  ).toBeVisible();
});

// End-to-end proof that mission grading still fires after being relocated out of
// Car.tsx into MissionController/useMission: drive the straight lesson forward to
// its goal and assert the success + feedback transition. Guards the mount-order /
// transform-timing contract. The straight lesson has the lightest scene (highest
// frame rate, so the real-time drive is as quick as possible on headless CI); the
// poll resolves as soon as the goal fires, so the generous timeout only caps the
// failure case, it doesn't slow the happy path.
test("reaching a lesson goal triggers success + feedback (grading relocation)", async ({
  page,
}) => {
  // Headroom: the car physics advances per-frame (no delta), so the wall-clock to
  // the goal scales with headless-CI frame rate. The scene's shadow pass + reflection
  // environment lower that frame rate, so this cap is set generously above the happy
  // path (which resolves the moment the goal fires — the timeout only bounds failure).
  test.setTimeout(160_000);
  await denyCamera(page);
  await page.addInitScript(() => localStorage.setItem("language", "ja"));
  await page.goto("/?e2e=1");
  await page.waitForFunction(() => Boolean((window as unknown as E2EWindow).__drivingStore), undefined, {
    timeout: 30_000,
  });

  // Start the lesson programmatically (avoids i18n button navigation).
  await page.evaluate(() => {
    const s = (window as unknown as E2EWindow).__drivingStore!.getState();
    s.setLesson("straight");
    s.setScreen("driving");
    s.setMissionState("active");
  });
  await page.waitForFunction(
    () => (window as unknown as E2EWindow).__drivingStore!.getState().screen === "driving",
    undefined,
    { timeout: 30_000 },
  );
  // Let the Scene/Car mount and KeyboardControls attach its listeners.
  await page.waitForTimeout(800);

  // Drive forward (the car faces -z; ArrowUp = throttle) until the goal fires.
  await page.keyboard.down("ArrowUp");
  await expect
    .poll(() => page.evaluate(() => (window as unknown as E2EWindow).__drivingStore!.getState().screen), {
      timeout: 140_000,
    })
    .toBe("feedback");
  await page.keyboard.up("ArrowUp");

  const state = await page.evaluate(() => {
    const s = (window as unknown as E2EWindow).__drivingStore!.getState();
    return { missionState: s.missionState, frames: s.replayData.length };
  });
  expect(state.missionState).toBe("success");
  expect(state.frames).toBeGreaterThan(0);
});
