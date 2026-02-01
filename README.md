# Virtual Driving School

Virtual Driving School へようこそ。このプロジェクトは、Next.js と React Three Fiber を使用したブラウザベースの 3D ドライビングシミュレーターです。MediaPipe を統合し、Webカメラを使用したジェスチャー（顔の向き、手の動き）による直感的な運転操作を実現しています。

## 主な機能

*   **リアルな 3D シミュレーション**: React Three Fiber と Cannon.js (または関連物理エンジン) を使用した車両挙動と環境。
*   **ビジョンコントロール**: MediaPipe を活用し、ハンドル操作やペダル操作を身体の動きでエミュレート。
*   **ミッション & トラフィック**: 交通ルールを意識したミッションシステムと、NPC車両による交通システム。
*   **段階的な学習**: チュートリアルから実践的な走行までをサポート。

## 始め方 (Getting Started)

開発サーバーを起動するには、以下のコマンドを実行してください。

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開き、アプリケーションを確認してください。

## 技術スタック

*   **Framework**: [Next.js](https://nextjs.org/)
*   **3D Library**: [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) (Three.js)
*   **Vision AI**: [MediaPipe](https://developers.google.com/mediapipe) (Tasks Vision)
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Backend/Storage**: [Firebase](https://firebase.google.com/)

## ディレクトリ構造とファイル解説

プロジェクトの主要なファイルとディレクトリの構造について解説します。

### `src/app`
アプリケーションのエントリーポイントとルーティング定義です。
*   `layout.tsx`: 全ページの共通レイアウト。フォント読み込みやメタデータを設定。
*   `page.tsx`: トップページ。キャンバスの初期化やメインコンポーネントの読み込み。
*   `globals.css`: Tailwind のディレクティブを含むグローバルスタイル。
*   `debug/`: デバッグ用ページが含まれるディレクトリ。

### `src/components/simulation`
3Dシーンとシミュレーションロジックに関するコンポーネント群です。
*   `Scene.tsx`: 3Dシーン全体のコンテナ。環境光やカメラ設定などを管理。
*   `Car.tsx`: プレイヤーが操作する車両のモデル、物理挙動、操作ロジック。
*   `Road.tsx`: 道路の描画と生成ロジック。
*   `TrafficSystem.tsx`: NPC（他車）の生成と移動制御を行うシステム。
*   `MissionController.tsx`: ゲームのミッション（課題）、スコア、成功/失敗判定を管理。
*   `RearviewMirror.tsx`: バックミラー機能（後方視点の描画）。
*   `GarageScene.tsx`: 車両選択やプレビュー用のガレージシーン。
*   `GoalEffects.tsx`: ゴール到達時の演出エフェクト。
*   `KeyboardControls.tsx`: キーボードによる操作入力のハンドリング（デバッグや補助用）。
*   `Surroundings.tsx`: 木、建物などの環境オブジェクトの配置。
*   `ThreeModelLoader.tsx`: 3Dモデル（GLTF/GLB）を非同期で読み込むためのユーティリティ。
*   `RoadProps.tsx`: 道路に関連するプロパティや補助オブジェクト。
*   `objects/`: 標識や障害物など、シーン内の個別の静的オブジェクト。

### `src/components/vision`
カメラ入力と画像認識に関するコンポーネントです。
*   `VisionController.tsx`: Webカメラの映像を取得し、MediaPipeで顔・手・姿勢を検出。その結果をステアリングやアクセル/ブレーキの入力値に変換します。

### `src/components/ui`
画面上にオーバーレイ表示される 2D UI コンポーネント群です。
*   `Dashboard.tsx`: 速度計、ギア、RPMなどを表示する計器盤。
*   `HomeScreen.tsx`: ゲーム開始前のメインメニュー画面。
*   `FeedbackScreen.tsx`: 走行終了後のリザルト画面やフィードバック表示。
*   `HistoryScreen.tsx`: 過去の走行履歴を表示する画面。
*   `PauseMenu.tsx`: ゲーム一時停止中に表示されるメニュー。
*   `TutorialScreen.tsx`: チュートリアルの進行管理と説明表示。
*   `TutorialIndicators.tsx`: チュートリアル中の視覚的なヒント（矢印など）。
*   `TutorialPlainScene.tsx`: チュートリアル用の簡易的な3Dシーン背景。

### `src/components/simulation/objects` (詳細)
*   `TrafficLight.tsx`: 信号機のモデルと状態管理。
*   `Pedestrian.tsx`: 歩行者のモデルとアニメーション。
*   `Crosswalk.tsx`: 横断歩道の表示。
*   `Bicycle.tsx`: 自転車のモデル。
*   `RailroadCrossing.tsx`: 踏切のモデル。
*   `ModelErrorBoundary.tsx`: 3Dモデル読み込みエラー時のフォールバック表示。

### `src/lib`
ユーティリティ関数、定数、状態管理ライブラリです。
*   `store.ts`: Zustand を使用したグローバルな状態管理（ゲームの状態、入力値、設定など）。
*   `course.ts`: コースのウェイポイントや形状データ。
*   `oneEuroFilter.ts`: センサーや認識結果のノイズを除去して滑らかにするフィルタリング処理。
*   `footPedalRecognition.ts`: 映像から足（またはそれに代わるジェスチャー）の動きを認識してペダル操作と判定するロジック。
*   `firebase.ts`: Firebase の初期化設定と接続インスタンス。
*   `game/`: ゲーム固有の計算ロジックなどを格納するディレクトリ。

### `src/hooks`
React カスタムフックです。
*   `useDrivingFeedback.ts`: 走行データに基づいて、リアルタイムまたは終了後のアドバイスを生成するフック。
*   `useRegisterCheckpoint.ts`: コース上のチェックポイント通過を判定・登録するロジック。

---
Created by Virtual Driving School Team.
