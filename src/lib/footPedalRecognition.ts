/**
 * 足元のペダル操作認識用のユーティリティ関数
 * MediaPipe PoseLandmarkerを使用して、足の位置と角度からアクセル・ブレーキを認識します
 *
 * ## 使用方法
 *
 * ### 1. キャリブレーション（初期設定）
 * 運転開始時に、利用者が椅子に座ってブレーキを踏んでいる状態で：
 * ```typescript
 * import { calibrateFootPosition } from './footPedalRecognition';
 *
 * // MediaPipeのPoseLandmarkerから取得したランドマーク
 * const calibration = calibrateFootPosition(landmarks);
 * if (calibration) {
 *   // storeに保存
 *   useDrivingStore.getState().setFootCalibration(calibration);
 *   useDrivingStore.getState().setCalibrationStage('calibrated');
 * }
 * ```
 *
 * ### 2. ペダル認識の実行
 * 各フレームで以下を呼び出す：
 * ```typescript
 * import { processPedalRecognition } from './footPedalRecognition';
 *
 * const store = useDrivingStore.getState();
 * const result = processPedalRecognition(
 *   landmarks,
 *   store.footCalibration,
 *   store.pedalState,
 *   deltaTime // 前回からの経過時間（ms）
 * );
 *
 * // キャリブレーションを更新（アクセル踏み込み位置の記録）
 * store.setFootCalibration(result.updatedCalibration);
 *
 * // ペダル状態を更新（throttle/brakeも自動更新）
 * store.updatePedalState(result.pedalState);
 * ```
 *
 * ## 動作仕様
 *
 * ### キャリブレーション
 * - 椅子に座って右足をブレーキの位置に置く
 * - 5秒間足を動かさずに固定する
 * - 足の位置が安定したら自動的にキャリブレーション完了
 * - Pause中やスタート画面でも自動的に運転画面に遷移
 *
 * ### アクセル
 * - 最初の位置（ブレーキ位置）から右側（カメラでは左側）に足を動かすとアクセルON
 * - 踏み込んだ位置を記憶し、その位置でアクセルを維持
 * - 最初の位置に戻る、または踏み込み位置と異なる場所に移動するとアクセルOFF
 * - アクセルOFF時はクリープ現象で微速前進（throttle = 0.05）
 * - 足先の角度でアクセルの強弱を調整（下がると強くなる）
 *
 * ### ブレーキ
 * - 最初の位置（基準位置）より足先が地面側に傾くとブレーキON
 * - 傾きの度合いでブレーキの強さを制御
 * - 短時間（300ms未満）のブレーキはポンピングブレーキとして弱い減速
 * - 長時間（1秒以上）のブレーキは徐々に減速が強くなる
 */

import { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { convertSegmentPathToStaticExportFilename } from "next/dist/shared/lib/segment-cache/segment-value-encoding";

/**
 * 足の初期位置と角度を保存する型
 */
export interface FootCalibration {
  // 右足の基準位置（ブレーキを踏んでいる状態）
  rightAnkle: { x: number; y: number; z: number };
  rightHeel: { x: number; y: number; z: number };
  rightFootIndex: { x: number; y: number; z: number };
  rightKnee: { x: number; y: number; z: number };

  // 左足の基準位置
  leftAnkle: { x: number; y: number; z: number };
  leftHeel: { x: number; y: number; z: number };
  leftFootIndex: { x: number; y: number; z: number };
  leftKnee: { x: number; y: number; z: number };

  // 腰の基準位置
  leftHip: { x: number; y: number; z: number };
  rightHip: { x: number; y: number; z: number };
  hipCenter: { x: number; y: number; z: number };

  // 基準角度（足先の角度）
  rightFootAngle: number;
  leftFootAngle: number;

  // 腰中点から右膝への角度（ブレーキ時の基準）
  hipToRightKneeAngle: number;

  // アクセル踏み込み時の位置（初回踏み込み時に記録）
  accelPressPosition: { x: number; y: number; z: number } | null;
  accelPressAngle: number | null;

  // 認証完了フラグ
  isCalibrated: boolean;

  // 安定性チェック用（5秒間の位置確認）
  stabilityCheckStartTime: number | null;
  stabilityCheckPosition: { x: number; y: number; z: number } | null;
}

/**
 * ペダル操作の状態
 */
export interface PedalState {
  throttle: number; // 0.0 - 1.0
  brake: number; // 0.0 - 1.0
  isAccelPressed: boolean; // アクセルが踏まれているか
  isBrakePressed: boolean; // ブレーキが踏まれているか
  brakePressDuration: number; // ブレーキを踏んでいる時間（ms）
  brakePressCount: number; // ブレーキを踏んだ回数（ポンピングブレーキ用）
}

/**
 * MediaPipeのポーズランドマークのインデックス
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
const POSE_LANDMARKS = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/**
 * 足首から足先への角度を計算する（ラジアン）
 * 地面に対する傾きを計算
 */
function calculateFootAngle(
  ankle: NormalizedLandmark,
  footIndex: NormalizedLandmark
): number {
  const dy = footIndex.y - ankle.y;
  const dx = footIndex.x - ankle.x;
  return Math.atan2(dy, dx);
}

/**
 * 2点間の角度を計算する（ラジアン）
 * 水平線を基準とした角度
 */
function calculateAngleBetweenPoints(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number }
): number {
  const dy = p2.y - p1.y;
  const dx = p2.x - p1.x;
  return Math.atan2(dy, dx);
}

/**
 * 2点間の距離を計算する
 */
function calculateDistance(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 初期認証: ブレーキを踏んでいる状態の足の位置と角度を記録する
 */
export function calibrateFootPosition(
  landmarks: NormalizedLandmark[]
): FootCalibration | null {
  if (landmarks.length < 33) {
    return null; // ポーズが検出されていない
  }

  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const rightHeel = landmarks[POSE_LANDMARKS.RIGHT_HEEL];
  const rightFootIndex = landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX];
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const leftHeel = landmarks[POSE_LANDMARKS.LEFT_HEEL];
  const leftFootIndex = landmarks[POSE_LANDMARKS.LEFT_FOOT_INDEX];

  // ランドマークの信頼度チェック（visibilityが存在する場合）
  const minVisibility = 0.5;
  if (
    rightAnkle.visibility !== undefined && rightAnkle.visibility < minVisibility ||
    rightFootIndex.visibility !== undefined && rightFootIndex.visibility < minVisibility ||
    rightKnee.visibility !== undefined && rightKnee.visibility < minVisibility ||
    rightHip.visibility !== undefined && rightHip.visibility < minVisibility
  ) {
    return null;
  }

  // 腰の中点を計算
  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: (leftHip.z + rightHip.z) / 2,
  };

  // 腰中点から右膝への角度を計算
  const hipToRightKneeAngle = calculateAngleBetweenPoints(
    hipCenter,
    { x: rightKnee.x, y: rightKnee.y, z: rightKnee.z }
  );

  return {
    leftHip: { x: leftHip.x, y: leftHip.y, z: leftHip.z },
    rightHip: { x: rightHip.x, y: rightHip.y, z: rightHip.z },
    hipCenter,
    leftKnee: { x: leftKnee.x, y: leftKnee.y, z: leftKnee.z },
    rightKnee: { x: rightKnee.x, y: rightKnee.y, z: rightKnee.z },
    rightAnkle: { x: rightAnkle.x, y: rightAnkle.y, z: rightAnkle.z },
    rightHeel: { x: rightHeel.x, y: rightHeel.y, z: rightHeel.z },
    rightFootIndex: { x: rightFootIndex.x, y: rightFootIndex.y, z: rightFootIndex.z },
    leftAnkle: { x: leftAnkle.x, y: leftAnkle.y, z: leftAnkle.z },
    leftHeel: { x: leftHeel.x, y: leftHeel.y, z: leftHeel.z },
    leftFootIndex: { x: leftFootIndex.x, y: leftFootIndex.y, z: leftFootIndex.z },
    rightFootAngle: calculateFootAngle(rightAnkle, rightFootIndex),
    leftFootAngle: calculateFootAngle(leftAnkle, leftFootIndex),
    hipToRightKneeAngle,
    accelPressPosition: null, // アクセル踏み込み位置は初期化時はnull
    accelPressAngle: null,
    isCalibrated: false, // 安定性チェック前はfalse
    stabilityCheckStartTime: null,
    stabilityCheckPosition: null,
  };
}

/**
 * 5秒間の足位置安定性をチェックする
 * @returns { isStable: boolean, progress: number (0-1), calibration: FootCalibration }
 */
export function checkFootStability(
  landmarks: NormalizedLandmark[],
  previousCalibration: FootCalibration | null,
  currentTime: number
): { isStable: boolean; progress: number; calibration: FootCalibration | null } {
  if (landmarks.length < 33) {
    return { isStable: false, progress: 0, calibration: null };
  }

  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const currentPosition = { x: rightAnkle.x, y: rightAnkle.y, z: rightAnkle.z };

  const STABILITY_DURATION = 3000; // 5秒
  const STABILITY_THRESHOLD = 0.1; // 位置のずれの許容範囲

  // 初回または位置が大きくずれた場合はリセット
  if (!previousCalibration || !previousCalibration.stabilityCheckPosition || !previousCalibration.stabilityCheckStartTime) {
    const newCalibration = calibrateFootPosition(landmarks);
    if (newCalibration) {
      newCalibration.stabilityCheckStartTime = currentTime;
      newCalibration.stabilityCheckPosition = currentPosition;
      newCalibration.isCalibrated = false; // まだ安定していない
      return { isStable: false, progress: 0, calibration: newCalibration };
    }
    return { isStable: false, progress: 0, calibration: null };
  }

  // 位置が安定しているかチェック
  const distance = calculateDistance(previousCalibration.stabilityCheckPosition, currentPosition);

  if (distance > STABILITY_THRESHOLD) {
    // 位置がずれた場合はリセット
    const newCalibration = calibrateFootPosition(landmarks);
    if (newCalibration) {
      newCalibration.stabilityCheckStartTime = currentTime;
      newCalibration.stabilityCheckPosition = currentPosition;
      newCalibration.isCalibrated = false;
      return { isStable: false, progress: 0, calibration: newCalibration };
    }
    return { isStable: false, progress: 0, calibration: null };
  }

  // 経過時間を計算
  const elapsedTime = currentTime - previousCalibration.stabilityCheckStartTime;
  const progress = Math.min(elapsedTime / STABILITY_DURATION, 1.0);

  if (elapsedTime >= STABILITY_DURATION) {
    // 5秒間安定していた場合、キャリブレーション完了
    const finalCalibration = { ...previousCalibration };
    finalCalibration.isCalibrated = true;
    return { isStable: true, progress: 1.0, calibration: finalCalibration };
  }

  return { isStable: false, progress, calibration: previousCalibration };
}

/**
 * アクセル操作を認識する（新ロジック）
 *
 * ロジック:
 * - 右足が基準位置（ブレーキ位置）から右側（カメラ反転により左側に見える）に動いたらアクセルON
 * - 踏み込み位置を記録
 * - 基準位置に戻ったらアクセルOFF（クリープ現象）
 * - 踏み込み位置と異なる場合もアクセルOFF
 * - 足先の角度変化でアクセルの強弱を制御
 */
export function recognizeAcceleration(
  landmarks: NormalizedLandmark[],
  calibration: FootCalibration,
  previousState: PedalState
): { throttle: number; isAccelPressed: boolean; updatedCalibration: FootCalibration } {
  if (!calibration.isCalibrated || landmarks.length < 33) {
    return { throttle: 0, isAccelPressed: false, updatedCalibration: calibration };
  }

  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const rightFootIndex = landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX];

  // 現在の足首位置
  const currentAnklePos = { x: rightAnkle.x, y: rightAnkle.y, z: rightAnkle.z };

  // 足先の現在の角度
  const currentAngle = calculateFootAngle(rightAnkle, rightFootIndex);

  // 基準位置（ブレーキ位置）からの距離を計算
  const distanceFromBrake = calculateDistance(calibration.rightAnkle, currentAnklePos);

  // 現在の腰の中点を計算
  const currentHipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: (leftHip.z + rightHip.z) / 2,
  };

  // 現在の腰中点から右膝への角度を計算
  const currentHipToKneeAngle = calculateAngleBetweenPoints(
    currentHipCenter,
    { x: rightKnee.x, y: rightKnee.y, z: rightKnee.z }
  );

  // 基準角度との差分
  const kneeAngleDiff = currentHipToKneeAngle - calibration.hipToRightKneeAngle;

  // しきい値の設定
  const POSITION_THRESHOLD = 0.03; // 基準位置と判定する閾値（余裕を持たせて安定化）
  const ACCEL_MOVE_THRESHOLD = 0.01; // アクセル踏み込みと判定する閾値（体の中心から右側へ）
  const ACCEL_RETURN_THRESHOLD = 0.02; // アクセルから戻る際の閾値（ヒステリシス）
  const ANGLE_SENSITIVITY = 2.5; // 角度の感度
  const KNEE_ANGLE_THRESHOLD = 0.10; // 腰-膝角度の閾値（ラジアン、約5.8度）

  let isAccelPressed = false;
  let throttle = 0;
  const updatedCalibration = { ...calibration };

  // アクセル方向の移動を計算（カメラ反転を考慮）
  // 実際の右方向への移動 = カメラ上で左方向への移動 = x座標の減少
  // つまり、horizontalMovementが正の値の場合にアクセル方向
  const horizontalMovement = calibration.rightAnkle.x - currentAnklePos.x;
  const isMovingToAccel = horizontalMovement > ACCEL_MOVE_THRESHOLD; // 右方向（カメラ上では左）への移動

  // 腰-膝角度がアクセル方向に開いているか判定
  const isKneeAngleOpening = kneeAngleDiff > KNEE_ANGLE_THRESHOLD;

 

  // 基準位置（ブレーキ位置）にいるか判定
  // ヒステリシス：アクセルが踏まれている場合は、より厳しい閾値を使用
  const brakeThreshold = previousState.isAccelPressed ? ACCEL_RETURN_THRESHOLD : POSITION_THRESHOLD;
  const isAtBrakePosition = distanceFromBrake < brakeThreshold && !isMovingToAccel && !isKneeAngleOpening;
  if (isAtBrakePosition) {
    // 基準位置にいる = アクセルOFF
    isAccelPressed = false;
    throttle = 0;
    // アクセル踏み込み位置をリセット
    updatedCalibration.accelPressPosition = null;
    updatedCalibration.accelPressAngle = null;
  } else if (isMovingToAccel || isKneeAngleOpening) {
    // アクセル方向に移動している、または腰-膝角度が開いている

    if (calibration.accelPressPosition === null) {
      // 初めてアクセル位置に移動した場合
      // アクセル踏み込み位置として記録
      updatedCalibration.accelPressPosition = currentAnklePos;
      updatedCalibration.accelPressAngle = currentAngle;
      isAccelPressed = true;

      // 基本的なスロットル値（移動距離ベース）
      const moveDistance = Math.abs(horizontalMovement);
      const baseThrottle = Math.min((moveDistance - ACCEL_MOVE_THRESHOLD) / 0.15, 0.7);
      throttle = Math.max(0.15, baseThrottle); // クリープ現象を考慮して最低15%
    } else {
      // アクセル踏み込み位置が記録済み
      // 踏み込み位置からの距離を計算
      const distanceFromAccel = calculateDistance(calibration.accelPressPosition, currentAnklePos);

      // アクセル位置にいるか判定（余裕を持たせる）
      const isAtAccelPosition = distanceFromAccel < POSITION_THRESHOLD * 2;

      if (isAtAccelPosition && isMovingToAccel) {
        // アクセル位置にいて、アクセル方向にいる = アクセルON
        isAccelPressed = true;

        // 基本的なスロットル値
        const baseThrottle = 0.5;

        // 足先の角度による強弱調整
        if (calibration.accelPressAngle !== null) {
          const angleDiff = currentAngle - calibration.accelPressAngle;

          // 足先が下がる（角度が大きくなる）とアクセルが強くなる
          const angleAdjustment = angleDiff * ANGLE_SENSITIVITY;
          throttle = Math.max(0.15, Math.min(1.0, baseThrottle + angleAdjustment));
        } else {
          throttle = baseThrottle;
        }
      } else {
        // 踏み込み位置から離れた、またはアクセル方向でない = アクセルOFF
        isAccelPressed = false;
        throttle = 0;
        updatedCalibration.accelPressPosition = null;
        updatedCalibration.accelPressAngle = null;
      }
    }
  } else {
    // アクセル方向以外への移動 = アクセルOFF
    isAccelPressed = false;
    throttle = 0;
    updatedCalibration.accelPressPosition = null;
    updatedCalibration.accelPressAngle = null;
  }

  // クリープ現象の実装（アクセルを離した直後）
  if (!isAccelPressed && previousState.isAccelPressed && !isAtBrakePosition) {
    // アクセルを離したばかりで、まだブレーキ位置に戻っていない場合はクリープ
    throttle = 0.05; // 微速前進
  }
  console.log("Accel",isAccelPressed)

  return { throttle, isAccelPressed, updatedCalibration };
}

/**
 * ブレーキ操作を認識する（改善版）
 *
 * ロジック:
 * - 基準位置よりも足先が地面側（下方向）に傾いたらブレーキON
 * - 傾きの度合いでブレーキの強さを制御
 * - ブレーキを踏んでいる時間が長いと徐々に減速が強くなる
 * - 短時間のブレーキはポンピングブレーキとして弱い減速
 */
export function recognizeBraking(
  landmarks: NormalizedLandmark[],
  calibration: FootCalibration,
  previousState: PedalState,
  deltaTime: number // 前回の更新からの経過時間（ms）
): { brake: number; isBrakePressed: boolean; brakePressDuration: number; brakePressCount: number } {
  if (!calibration.isCalibrated || landmarks.length < 33) {
    return {
      brake: 0,
      isBrakePressed: false,
      brakePressDuration: 0,
      brakePressCount: 0,
    };
  }

  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const rightFootIndex = landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX];

  // 足先の現在の角度
  const currentAngle = calculateFootAngle(rightAnkle, rightFootIndex);
  const angleDiff = currentAngle - calibration.rightFootAngle;

  // ブレーキの閾値（基準位置よりも下に傾く）
  const BRAKE_THRESHOLD = 0.15; // ラジアン（アクセルとの競合を避けるため広めに設定）
  const MAX_BRAKE_ANGLE = 0.4; // 最大ブレーキ角度

  let isBrakePressed = false;
  let brake = 0;
  let brakePressDuration = previousState.brakePressDuration;
  let brakePressCount = previousState.brakePressCount;

  // 足先が下方向に傾いているか判定（ブレーキを踏んでいる）
  if (angleDiff > BRAKE_THRESHOLD) {
    isBrakePressed = true;

    // 角度に基づいてブレーキの基本強さを計算
    const angleBasedBrake = Math.min((angleDiff - BRAKE_THRESHOLD) / MAX_BRAKE_ANGLE, 1.0);

    // ブレーキを踏んでいる時間を累積
    brakePressDuration += deltaTime;


    brake = angleBasedBrake * 0.5

    // // ブレーキの強さを時間で調整
    // if (brakePressDuration < 300) {
    //   // 300ms未満：短時間のブレーキ（ポンピングブレーキ）
    //   // 踏んでいる時間が短いほど減速が小さい
    //   const timeFactor = brakePressDuration / 300; // 0.0 - 1.0
    //   brake = angleBasedBrake * timeFactor * 0.4; // 最大40%の制動力
    // } else if (brakePressDuration < 1000) {
    //   // 300ms - 1秒：通常のブレーキ
    //   brake = angleBasedBrake * 0.7; // 70%の制動力
    // } else {
    //   // 1秒以上：長時間のブレーキ（徐々に減速を強める）
    //   const longPressFactor = Math.min(1.0 + (brakePressDuration - 1000) / 3000, 1.5);
    //   brake = Math.min(angleBasedBrake * longPressFactor, 1.0);
    // }

  } else {
    // ブレーキを離した
    if (previousState.isBrakePressed) {
      // 前回はブレーキを踏んでいた = 1回のブレーキ操作が完了
      brakePressCount += 1;

      // ポンピングブレーキのログ（デバッグ用）
      if (brakePressDuration < 300) {
        console.log(`ポンピングブレーキ検出: ${brakePressCount}回目, 継続時間: ${brakePressDuration}ms`);
      }

      brakePressDuration = 0;
    }

    isBrakePressed = false;
    brake = 0;

    // ブレーキカウントのリセット（2秒間ブレーキを踏まなかったらリセット）
    // Note: この実装ではsetTimeoutを使わずに、呼び出し側でリセットロジックを実装する方が良い
  }

  return { brake, isBrakePressed, brakePressDuration, brakePressCount };
}

/**
 * 足元のペダル操作を総合的に処理する（改善版）
 */
export function processPedalRecognition(
  landmarks: NormalizedLandmark[],
  calibration: FootCalibration,
  previousState: PedalState,
  deltaTime: number
): { pedalState: PedalState; updatedCalibration: FootCalibration } {
  // アクセル認識（キャリブレーション更新あり）
  const accelResult = recognizeAcceleration(landmarks, calibration, previousState);

  // ブレーキ認識（更新されたキャリブレーションを使用）
  const brakeResult = recognizeBraking(landmarks, accelResult.updatedCalibration, previousState, deltaTime);

  // アクセルとブレーキの排他制御（同時に踏まない）
  let throttle = accelResult.throttle;
  let brake = brakeResult.brake;
  let isBrakePressed = brakeResult.isBrakePressed;

  if (accelResult.isAccelPressed && brakeResult.isBrakePressed) {
    // 両方踏んでいる場合はアクセルを優先（ブレーキの誤検出を防ぐため）
    brake = 0;
    isBrakePressed = false;
  }

  const pedalState: PedalState = {
    throttle,
    brake,
    isAccelPressed: accelResult.isAccelPressed,
    isBrakePressed: isBrakePressed,
    brakePressDuration: brakeResult.brakePressDuration,
    brakePressCount: brakeResult.brakePressCount,
  };

  return {
    pedalState,
    updatedCalibration: accelResult.updatedCalibration,
  };
}

/**
 * ブレーキカウントをリセットするためのヘルパー関数
 * 一定時間ブレーキを踏まなかった場合にカウントをリセット
 */
export function shouldResetBrakeCount(
  pedalState: PedalState,
  timeSinceLastBrake: number // 最後にブレーキを離してからの経過時間（ms）
): boolean {
  const RESET_THRESHOLD = 2000; // 2秒
  return !pedalState.isBrakePressed && timeSinceLastBrake > RESET_THRESHOLD;
}

/**
 * ブレーキカウントをリセットしたPedalStateを返す
 */
export function resetBrakeCount(pedalState: PedalState): PedalState {
  return {
    ...pedalState,
    brakePressCount: 0,
  };
}
