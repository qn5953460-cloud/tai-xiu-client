import React, { useEffect, useState } from 'react';
import { socket } from './services/socket';
import { GameState, BetChoice } from './types/game';

export const App: React.FC = () => {
  const [connected, setConnected] = useState<boolean>(false);
  const [balance, setBalance] = useState<number>(100000);
  const [betAmount, setBetAmount] = useState<number>(10000);
  const [myBets, setMyBets] = useState<{ TAI: number; XIU: number }>({ TAI: 0, XIU: 0 });

  const [gameState, setGameState] = useState<GameState>({
    timer: 15,
    phase: 'betting',
    dice: [1, 1, 1],
    totalBetTai: 0,
    totalBetXiu: 0,
    history: ['TAI', 'XIU', 'TAI', 'TAI', 'XIU'],
  });

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('game_tick', (data: GameState) => {
      setGameState(data);
      if (data.phase === 'betting' && data.timer === 15) {
        setMyBets({ TAI: 0, XIU: 0 });
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('game_tick');
    };
  }, []);

  const handleBet = (choice: BetChoice) => {
    if (gameState.phase !== 'betting') return;
    if (balance < betAmount) {
      alert('Không đủ số dư!');
      return;
    }

    setBalance((prev) => prev - betAmount);
    setMyBets((prev) => ({ ...prev, [choice]: prev[choice] + betAmount }));
    socket.emit('place_bet', { choice, amount: betAmount });
  };

  const totalDice = gameState.dice.reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 font-sans">
      <header className="w-full max-w-2xl flex justify-between items-center py-4 px-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-xs font-semibold text-slate-400">
            {connected ? 'CONNECTED SERVER' : 'DISCONNECTED'}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">Số Dư</span>
          <span className="text-xl font-extrabold text-amber-400 font-mono">
            {balance.toLocaleString()} đ
          </span>
        </div>
      </header>

      <main className="w-full max-w-2xl my-auto flex flex-col items-center gap-6">
        <div className="flex gap-2 p-2 bg-slate-900 border border-slate-800 rounded-full">
          {gameState.history.slice(-10).map((res, i) => (
            <span
              key={i}
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                res === 'TAI' ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white'
              }`}
            >
              {res === 'TAI' ? 'T' : 'X'}
            </span>
          ))}
        </div>

        <div className="relative w-72 h-72 rounded-full bg-slate-900 border-4 border-amber-500/30 flex flex-col items-center justify-center shadow-2xl">
          <div className="text-xs text-amber-400/80 uppercase font-semibold mb-1">
            {gameState.phase === 'betting' ? 'Thời Gian Đặt Cược' : 'Trả Thưởng'}
          </div>

          <div className="text-6xl font-black font-mono text-amber-400 my-2">
            {gameState.timer}s
          </div>

          <div className="flex gap-3 mt-2">
            {gameState.dice.map((val, idx) => (
              <div
                key={idx}
                className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-300 rounded-xl flex items-center justify-center text-slate-900 font-extrabold text-2xl shadow-md border border-white"
              >
                {val}
              </div>
            ))}
          </div>

          {gameState.phase === 'result' && (
            <div className="mt-3 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full font-bold text-sm border border-amber-500/40">
              Tổng: {totalDice} ({totalDice >= 11 ? 'TÀI' : 'XỈU'})
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={() => handleBet('TAI')}
            disabled={gameState.phase !== 'betting'}
            className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 disabled:opacity-40 rounded-2xl shadow-lg border border-rose-500/50"
          >
            <span className="text-3xl font-black tracking-wider">TÀI</span>
            <span className="text-xs text-rose-200 mt-1">11 - 17</span>
            <span className="text-sm font-semibold mt-2 text-rose-100 font-mono">
              Tổng cược: {gameState.totalBetTai.toLocaleString()} đ
            </span>
            {myBets.TAI > 0 && (
              <span className="text-xs bg-black/40 px-2 py-0.5 rounded-full mt-1 text-amber-300 font-mono">
                Bạn đặt: {myBets.TAI.toLocaleString()} đ
              </span>
            )}
          </button>

          <button
            onClick={() => handleBet('XIU')}
            disabled={gameState.phase !== 'betting'}
            className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-sky-600 to-sky-800 hover:from-sky-500 hover:to-sky-700 disabled:opacity-40 rounded-2xl shadow-lg border border-sky-500/50"
          >
            <span className="text-3xl font-black tracking-wider">XỈU</span>
            <span className="text-xs text-sky-200 mt-1">4 - 10</span>
            <span className="text-sm font-semibold mt-2 text-sky-100 font-mono">
              Tổng cược: {gameState.totalBetXiu.toLocaleString()} đ
            </span>
            {myBets.XIU > 0 && (
              <span className="text-xs bg-black/40 px-2 py-0.5 rounded-full mt-1 text-amber-300 font-mono">
                Bạn đặt: {myBets.XIU.toLocaleString()} đ
              </span>
            )}
          </button>
        </div>

        <div className="flex gap-2 justify-center w-full bg-slate-900 p-3 rounded-xl border border-slate-800">
          {[10000, 50000, 100000, 500000].map((amt) => (
            <button
              key={amt}
              onClick={() => setBetAmount(amt)}
              className={`px-4 py-2 rounded-lg font-bold text-sm font-mono transition-all ${
                betAmount === amt
                  ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {(amt / 1000).toLocaleString()}k
            </button>
          ))}
        </div>
      </main>

      <footer className="text-xs text-slate-600 py-2">
        Tai Xiu Web Online • Powered by Vercel & Render
      </footer>
    </div>
  );
};

export default App;