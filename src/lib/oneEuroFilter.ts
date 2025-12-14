/**
 * 1ユーロフィルタ（One Euro Filter）
 * ランドマークの座標のぶらつきを抑えるための適応型ローパスフィルタ
 *
 * 参考: https://cristal.univ-lille.fr/~casiez/1euro/
 */

/**
 * 低速時は強くスムージング、高速時は弱くスムージングを適用するフィルタ
 */
class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  constructor(private alpha: number) {}

  filter(value: number, alpha?: number): number {
    if (alpha !== undefined) {
      this.alpha = alpha;
    }

    if (this.y === null) {
      this.s = value;
      this.y = value;
    } else {
      this.s = this.alpha * value + (1 - this.alpha) * (this.s ?? value);
      this.y = this.s;
    }

    return this.y;
  }

  lastValue(): number | null {
    return this.y;
  }
}

/**
 * 1ユーロフィルタのメインクラス
 */
export class OneEuroFilter {
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  /**
   * @param minCutoff - 最小カットオフ周波数（デフォルト: 1.0）
   * @param beta - 速度係数（デフォルト: 0.007）高いほど高速動作時の遅延が少ない
   * @param dCutoff - 微分のカットオフ周波数（デフォルト: 1.0）
   */
  constructor(
    private minCutoff: number = 1.0,
    private beta: number = 0.007,
    private dCutoff: number = 1.0
  ) {
    this.xFilter = new LowPassFilter(this.alpha(this.minCutoff));
    this.dxFilter = new LowPassFilter(this.alpha(this.dCutoff));
  }

  /**
   * カットオフ周波数からアルファ値を計算
   */
  private alpha(cutoff: number, dt: number = 1.0): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = dt;
    return 1.0 / (1.0 + tau / te);
  }

  /**
   * 値をフィルタリング
   * @param value - フィルタリングする値
   * @param timestamp - タイムスタンプ（ミリ秒）
   */
  filter(value: number, timestamp: number): number {
    // 時間差分を計算（秒単位）
    let dt = 1.0;
    if (this.lastTime !== null && timestamp > this.lastTime) {
      dt = (timestamp - this.lastTime) / 1000.0;
    }
    this.lastTime = timestamp;

    // 速度を推定
    const prevFiltered = this.xFilter.lastValue();
    const dx = prevFiltered !== null ? (value - prevFiltered) / dt : 0;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff, dt));

    // カットオフ周波数を速度に応じて調整
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    // フィルタリング
    return this.xFilter.filter(value, this.alpha(cutoff, dt));
  }

  /**
   * フィルタをリセット
   */
  reset(): void {
    this.xFilter = new LowPassFilter(this.alpha(this.minCutoff));
    this.dxFilter = new LowPassFilter(this.alpha(this.dCutoff));
    this.lastTime = null;
  }
}

/**
 * 3D座標用の1ユーロフィルタ
 */
export class OneEuroFilter3D {
  private xFilter: OneEuroFilter;
  private yFilter: OneEuroFilter;
  private zFilter: OneEuroFilter;

  constructor(minCutoff: number = 1.0, beta: number = 0.007, dCutoff: number = 1.0) {
    this.xFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.yFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.zFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  /**
   * 3D座標をフィルタリング
   */
  filter(
    point: { x: number; y: number; z: number },
    timestamp: number
  ): { x: number; y: number; z: number } {
    return {
      x: this.xFilter.filter(point.x, timestamp),
      y: this.yFilter.filter(point.y, timestamp),
      z: this.zFilter.filter(point.z, timestamp),
    };
  }

  /**
   * フィルタをリセット
   */
  reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
    this.zFilter.reset();
  }
}

/**
 * ポーズランドマーク全体用のフィルタマネージャー
 */
export class PoseLandmarkFilterManager {
  private filters: Map<number, OneEuroFilter3D> = new Map();

  constructor(
    private minCutoff: number = 1.0,
    private beta: number = 0.007,
    private dCutoff: number = 1.0
  ) {}

  /**
   * 特定のランドマークをフィルタリング
   */
  filterLandmark(
    index: number,
    point: { x: number; y: number; z: number },
    timestamp: number
  ): { x: number; y: number; z: number } {
    if (!this.filters.has(index)) {
      this.filters.set(index, new OneEuroFilter3D(this.minCutoff, this.beta, this.dCutoff));
    }

    const filter = this.filters.get(index)!;
    return filter.filter(point, timestamp);
  }

  /**
   * すべてのフィルタをリセット
   */
  reset(): void {
    this.filters.clear();
  }
}
