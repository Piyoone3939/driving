"use client";

import { useDrivingStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

export function HistoryScreen() {
  const setScreen = useDrivingStore(state => state.setScreen);
  const user = useDrivingStore(state => state.user);
  const missionHistory = useDrivingStore(state => state.missionHistory);
  const setMissionHistory = useDrivingStore(state => state.setMissionHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchHistory() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const q = query(
          collection(db, "mission_logs"),
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(10),
        );
        
        const querySnapshot = await getDocs(q);
        const historyData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          timestamp: doc.data().timestamp,
          lesson: doc.data().lesson,
          score: doc.data().score,
          clearTime: doc.data().clearTime,
          feedbackSummary: doc.data().feedbackSummary,
        }));
        
        setMissionHistory(historyData);
      } catch (e: any) {
        console.error("Error fetching history:", e);
        if (e.code === 'failed-precondition') {
          setError('データベースの設定が必要です。管理者にお問い合わせください。');
        } else {
          setError('履歴の読み込みに失敗しました');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [user, setMissionHistory]);

  // ログインしていない場合
  if (!user) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-blue-400 mb-4">🔒 ログインが必要です</h2>
          <p className="text-slate-400 mb-6">履歴を見るにはログインしてください</p>
          <div className="space-x-4">
            <button 
              onClick={() => setScreen('auth')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold"
            >
              ログイン / 新規登録
            </button>
            <button 
              onClick={() => setScreen('home')}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded"
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getLessonName = (lesson: string) => {
    const names: Record<string, string> = {
      'straight': '直線走行',
      'left-turn': '左折',
      'right-turn': '右折',
      's-curve': 'S字カーブ',
      'crank': 'クランク'
    };
    return names[lesson] || lesson;
  };

  const getScoreRank = (score: number) => {
    if (score >= 90) return { rank: 'S', color: 'text-yellow-400', bg: 'bg-yellow-400/20' };
    if (score >= 80) return { rank: 'A', color: 'text-green-400', bg: 'bg-green-400/20' };
    if (score >= 70) return { rank: 'B', color: 'text-blue-400', bg: 'bg-blue-400/20' };
    if (score >= 60) return { rank: 'C', color: 'text-orange-400', bg: 'bg-orange-400/20' };
    return { rank: 'D', color: 'text-red-400', bg: 'bg-red-400/20' };
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-white p-8 overflow-hidden">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-blue-400">📊 Driving History</h2>
        <p className="text-sm text-slate-400 mt-1">
          {user.email?.split('@')[0]} の走行記録
        </p>
        <button onClick={() => setScreen('home')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded">
          ← ホームに戻る
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-slate-500 mt-10">
            <div className="animate-pulse">Loading records...</div>
          </div>
        ) : error ? (
          <div className="text-center mt-10">
            <div className="text-red-400 mb-4">{error}</div>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
            >
              再読み込み
            </button>
          </div>
        ) : missionHistory.length === 0 ? (
          <div className="text-center mt-10">
            <div className="text-6xl mb-4">🏎️</div>
            <div className="text-slate-500 mb-4">履歴はまだありません</div>
            <p className="text-slate-600 text-sm mb-6">ミッションをクリアすると記録が残ります</p>
            <button 
              onClick={() => setScreen('home')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold"
            >
              ミッションに挑戦する
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-slate-400">
                全 {missionHistory.length} 件の記録
              </div>
              <div className='text-xs text-slate-500'>
                最新順に表示  
              </div>
            </div>
            <div className="grid gap-3">
            {missionHistory.map((item, index) => {
              const scoreInfo = getScoreRank(item.score);
              return (
                <div
                key={item.id}
                className="bg-slate-800 p-4 rounded-lg flex items-center gap-4 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                <div className="text-xl font-bold text-slate-600 w-10 text-center">
                  #{missionHistory.length - index}
                </div>
              {/* メイン情報 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-lg text-white">
                          {getLessonName(item.lesson)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(item.timestamp).toLocaleString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">{item.feedbackSummary}</div>
                    </div>
                    
                    {/* タイム */}
                    <div className="text-center px-3">
                      <div className="text-xs text-slate-500">TIME</div>
                      <div className="text-lg font-mono text-white">{item.clearTime}</div>
                    </div>
                    
                    {/* スコア */}
                    <div className="text-center px-3">
                      <div className="text-xs text-slate-500">SCORE</div>
                      <div className={`text-2xl font-bold ${
                        item.score >= 80 ? 'text-green-400' : 
                        item.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {item.score}
                      </div>
                    </div>
                    
                    {/* ランク */}
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${scoreInfo.bg}`}>
                      <span className={`text-2xl font-black ${scoreInfo.color}`}>
                        {scoreInfo.rank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}