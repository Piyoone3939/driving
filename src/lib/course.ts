import * as THREE from "three";

export function getCoursePath(
  lesson: "straight" | "s-curve" | "crank" | "left-turn" | "right-turn"
): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();

  if (lesson === "left-turn") {
    // Straight approach
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 20),
        new THREE.Vector3(0, 0, -30)
      )
    );

    // Left Turn (Sharp 90 deg)
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, -30),
      new THREE.Vector3(0, 0, -38),
      new THREE.Vector3(-8, 0, -38)
    );
    path.add(curve);

    // Straight exit
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(-8, 0, -38),
        new THREE.Vector3(-60, 0, -38)
      )
    );
  } else if (lesson === "right-turn") {
    // Straight approach
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 20),
        new THREE.Vector3(0, 0, -30)
      )
    );

    // Right Turn (Sharp 90 deg)
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, -30),
      new THREE.Vector3(0, 0, -38),
      new THREE.Vector3(8, 0, -38)
    );
    path.add(curve);

    // Straight exit
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(8, 0, -38),
        new THREE.Vector3(60, 0, -38)
      )
    );
  } else if (lesson === "s-curve") {
    const curve = new THREE.CatmullRomCurve3(
        [
        new THREE.Vector3(0, 0, 20),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(14, 0, -30),
        new THREE.Vector3(-14, 0, -60),
        new THREE.Vector3(0, 0, -100),
        ],
        false,
        "centripetal",
        0.5
    );
    path.add(curve);
    } else if (lesson === "crank") {
    const r = 4;   // コーナー丸め（小さめがクランクっぽい）
    const xR = 16; // 右に振る量
    const xL = -8; // 左に振る量

    // 直進（開始は z=20 ）
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 20),
        new THREE.Vector3(0, 0, -15)
      )
    );

    // 90度：-Z -> +X（右へ）
    path.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, -15),
        new THREE.Vector3(0, 0, -15 - r),
        new THREE.Vector3(r, 0, -15 - r)
      )
    );

    // +X 直進
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(r, 0, -15 - r),
        new THREE.Vector3(xR - r, 0, -15 - r)
      )
    );

    // 90度：+X -> -Z
    path.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(xR - r, 0, -15 - r),
        new THREE.Vector3(xR, 0, -15 - r),
        new THREE.Vector3(xR, 0, -15 - 2 * r)
      )
    );

    // -Z 直進
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(xR, 0, -15 - 2 * r),
        new THREE.Vector3(xR, 0, -55)
      )
    );

    // 90度：-Z -> -X（左へ）
    path.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(xR, 0, -55),
        new THREE.Vector3(xR, 0, -55 - r),
        new THREE.Vector3(xR - r, 0, -55 - r)
      )
    );

    // -X 直進（左へ振る）
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(xR - r, 0, -55 - r),
        new THREE.Vector3(xL + r, 0, -55 - r)
      )
    );

    // 90度：-X -> -Z
    path.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(xL + r, 0, -55 - r),
        new THREE.Vector3(xL, 0, -55 - r),
        new THREE.Vector3(xL, 0, -55 - 2 * r)
      )
    );

    // ゴールまで直進
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(xL, 0, -55 - 2 * r),
        new THREE.Vector3(xL, 0, -100)
      )
    );
  } else {
    // Straight
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 20),
        new THREE.Vector3(0, 0, -200)
      )
    );
  }

  return path;
}
