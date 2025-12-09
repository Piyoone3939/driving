import * as THREE from "three";

export function getCoursePath(lesson: 'straight' | 's-curve' | 'crank' | 'left-turn' | 'right-turn'): THREE.CurvePath<THREE.Vector3> {
    const path = new THREE.CurvePath<THREE.Vector3>();

    if (lesson === 'left-turn') {
        // Straight approach
        path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 20), new THREE.Vector3(0, 0, -30)));
        // Left Turn (Sharp 90 deg)
        // Corner approx 8m radius
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, 0, -30),
            new THREE.Vector3(0, 0, -38), // Corner
            new THREE.Vector3(-8, 0, -38) // End point
        );
        path.add(curve);
        // Straight exit
        path.add(new THREE.LineCurve3(new THREE.Vector3(-8, 0, -38), new THREE.Vector3(-60, 0, -38)));

    } else if (lesson === 'right-turn') {
        // Straight approach
        path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 20), new THREE.Vector3(0, 0, -30)));
        // Right Turn (Sharp 90 deg)
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, 0, -30),
            new THREE.Vector3(0, 0, -38), 
            new THREE.Vector3(8, 0, -38) 
        );
        path.add(curve);
        // Straight exit
        path.add(new THREE.LineCurve3(new THREE.Vector3(8, 0, -38), new THREE.Vector3(60, 0, -38)));

    } else if (lesson === 's-curve') {
        const curve1 = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -20),
            new THREE.Vector3(10, 0, -40),
            new THREE.Vector3(10, 0, -60),
            new THREE.Vector3(-10, 0, -80), 
            new THREE.Vector3(-10, 0, -100),
        ]);
        path.add(curve1);
    } else if (lesson === 'crank') {
        // Crank
        const points = [
            new THREE.Vector3(0, 0, 10),
            new THREE.Vector3(0, 0, -20),
            new THREE.Vector3(15, 0, -20),
            new THREE.Vector3(15, 0, -50),
            new THREE.Vector3(-5, 0, -50),
            new THREE.Vector3(-5, 0, -80)
        ];
        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1); 
        path.add(curve);
    } else {
        // Straight
        const line = new THREE.LineCurve3(
            new THREE.Vector3(0, 0, 20),
            new THREE.Vector3(0, 0, -200)
        );
        path.add(line);
    }
    return path;
}
