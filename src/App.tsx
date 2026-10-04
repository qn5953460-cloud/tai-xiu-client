import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================
export type GamePhase = 'betting' | 'shaking' | 'result';
export type Choice = 'TAI' | 'XIU';

export interface GameState {
  phase: GamePhase;
  timer: number;
  dices?: [number, number, number];
  totalPoint?: number;
  resultChoice?: Choice;
  totalBets: { TAI: number; XIU: number };
  playerCounts: { TAI: number; XIU: number };
}

export interface MyBets {
  TAI: number;
  XIU: number;
}

export interface PayoutData {
  winAmount: number;
  choice: Choice;
}

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
const CHIP_VALUES = [10000, 50000, 100000, 500000, 1000000];

export const App: React.FC = () => {
  // ==========================================
  // 2. REFS & STATES
  // ==========================================
  const socketRef = useRef<Socket | null>(null);
  
  // Ref theo dõi phase trước đó để phát hiện chuyển ván chính xác 100%
  const prevPhaseRef = useRef<GamePhase>('betting');

  const [balance, setBalance] = useState<number>(5000000); // Số dư tài khoản mẫu
  const [selectedChip, setSelectedChip] = useState<number>(50000);
  const [myBets, setMyBets] = useState<MyBets>({ TAI: 0, XIU: 0 });
  const [lastPayout, setLastPayout] = useState<PayoutData | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const [gameState, setGameState] = useState<GameState>({
    phase: 'betting',
    timer: 15,
    totalBets: { TAI: 0, XIU: 0 },
    playerCounts: { TAI: 0, XIU: 0 },
  });

  // ==========================================
  // 3. SOCKET LISTENERS & PHASE CONTROL
  // ==========================================
  useEffect(() => {
    // Khởi tạo kết nối Socket (chỉ 1 lần)
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    // Event 1: Nhận tick trạng thái từ Server
    socket.on('game_tick', (incomingState: GameState) => {
      setGameState(incomingState);

      // KIỂM TRA CHUYỂN PHASE BẰNG REF (Tránh lỗi đếm lùi/delay mạng)
      if (prevPhaseRef.current !== incomingState.phase) {
        if (incomingState.phase === 'betting') {
          // Chuyển sang ván mới -> Reset sạch cược & modal
          setMyBets({ TAI: 0, XIU: 0 });
          setLastPayout(null);
          setShowResultModal(false);
        } else if (incomingState.phase === 'result') {
          // Chuyển sang kết quả -> Mở Modal
          setShowResultModal(true);
        }
        prevPhaseRef.current = incomingState.phase;
      }
    });

    // Event 2: Xác nhận đặt cược thành công
    socket.on('bet_success', ({ choice, amount }: { choice: Choice; amount: number }) => {
      setMyBets((prev) => ({
        ...prev,
        [choice]: prev[choice] + amount,
      }));
      setBalance((prev) => prev - amount);
    });

    // Event 3: Nhận tiền thưởng/kết quả thắng cược
    socket.on('payout_result', (payout: PayoutData) => {
      setLastPayout(payout);
      if (payout.winAmount > 0) {
        setBalance((prev) => prev + payout.winAmount);
      }
    });

    // Event 4: Thông báo lỗi từ server
    socket.on('bet_error', (errorMsg: string) => {
      alert(`[Đặt cược thất bại]: ${errorMsg}`);
    });

    // Cleanup khi component unmount để chống tràn bộ nhớ
    return () => {
      socket.off('game_tick');
      socket.off('bet_success');
      socket.off('payout_result');
      socket.off('bet_error');
      socket.disconnect();
    };
  }, []);

  // ==========================================
  // 4. HANDLERS
  // ==========================================
  const handlePlaceBet = useCallback(
    (choice: Choice) => {
      if (gameState.phase !== 'betting') {
        alert('Đã hết thời gian đặt cược!');
        return;
      }
      if (balance < selectedChip) {
        alert('Số dư tài khoản không đủ!');
        return;
      }

      // Gửi event cược lên server
      socketRef.current?.emit('place_bet', {
        choice,
        amount: selectedChip,
      });
    },
    [gameState.phase, balance, selectedChip]
  );

  // ==========================================
  // 5. RENDER UI
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      {/* Header Info */}
      <div className="w-full max-w-2xl flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6">
        <div>
          <span className="text-gray-400 text-sm block">Số dư tài khoản</span>
          <span className="text-2xl font-bold text-amber-400">{balance.toLocaleString()}đ</span>
        </div>
        <div className="text-right">
          <span className="text-gray-400 text-sm block">Trạng thái</span>
          <span className="text-lg font-semibold uppercase tracking-wider text-emerald-400">
            {gameState.phase === 'betting' && `Đặt Cược (${gameState.timer}s)`}
            {gameState.phase === 'shaking' && 'Đang Lắc...'}
            {gameState.phase === 'result' && 'Trả Thưởng'}
          </span>
        </div>
      </div>

      {/* Main Game Bàn Cược */}
      <div className="w-full max-w-2xl bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-2xl relative">
        {/* Kết quả Xúc Xắc / Đĩa Lắc */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="w-32 h-32 rounded-full bg-slate-900 border-4 border-amber-500/30 flex items-center justify-center gap-2 shadow-inner">
            {gameState.phase === 'result' && gameState.dices ? (
              gameState.dices.map((d, i) => (
                <div
                  key={i}
                  className="w-8 h-8 bg-white text-slate-900 rounded-md font-extrabold flex items-center justify-center text-lg shadow-md"
                >
                  {d}
                </div>
              ))
            ) : (
              <span className="text-3xl animate-bounce">🎲</span>
            )}
          </div>
          {gameState.phase === 'result' && gameState.totalPoint && (
            <div className="mt-3 text-lg font-bold">
              Tổng: <span className="text-amber-400">{gameState.totalPoint}</span> - {gameState.resultChoice}
            </div>
          )}
        </div>

        {/* 2 Cửa Cược: TÀI / XỈU */}
        <div className="grid grid-cols-2 gap-4">
          {/* Cửa TÀI */}
          <button
            onClick={() => handlePlaceBet('TAI')}
            disabled={gameState.phase !== 'betting'}
            className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center ${
              gameState.resultChoice === 'TAI' && gameState.phase === 'result'
                ? 'border-emerald-500 bg-emerald-900/30'
                : 'border-slate-700 bg-slate-800 hover:border-amber-500'
            } ${gameState.phase !== 'betting' ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span className="text-3xl font-black text-rose-500 tracking-widest">TÀI</span>
            <span className="text-xs text-gray-400 mt-1">(11 - 17)</span>
            <div className="mt-3 text-sm font-medium">
              Tổng cược: <span className="text-amber-400">{gameState.totalBets.TAI.toLocaleString()}đ</span>
            </div>
            <div className="text-xs text-emerald-400 mt-1 font-semibold">
              Cược của bạn: {myBets.TAI.toLocaleString()}đ
            </div>
          </button>

          {/* Cửa XỈU */}
          <button
            onClick={() => handlePlaceBet('XIU')}
            disabled={gameState.phase !== 'betting'}
            className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center ${
              gameState.resultChoice === 'XIU' && gameState.phase === 'result'
                ? 'border-emerald-500 bg-emerald-900/30'
                : 'border-slate-700 bg-slate-800 hover:border-amber-500'
            } ${gameState.phase !== 'betting' ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span className="text-3xl font-black text-blue-500 tracking-widest">XỈU</span>
            <span className="text-xs text-gray-400 mt-1">(3 - 10)</span>
            <div className="mt-3 text-sm font-medium">
              Tổng cược: <span className="text-amber-400">{gameState.totalBets.XIU.toLocaleString()}đ</span>
            </div>
            <div className="text-xs text-emerald-400 mt-1 font-semibold">
              Cược của bạn: {myBets.XIU.toLocaleString()}đ
            </div>
          </button>
        </div>

        {/* Thanh chọn Mệnh giá Chip */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <span className="text-xs text-gray-400 mb-2 block text-center">Chọn mức cược</span>
          <div className="flex justify-center gap-2 flex-wrap">
            {CHIP_VALUES.map((val) => (
              <button
                key={val}
                onClick={() => setSelectedChip(val)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selectedChip === val
                    ? 'bg-amber-500 text-slate-950 scale-105 shadow-lg'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {(val / 1000).toLocaleString()}k
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Thông Báo Kết Quả Ván */}
      {showResultModal && lastPayout && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-amber-500/50 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl animate-fade-in">
            <h3 className="text-xl font-bold text-amber-400 mb-2">Kết Quả Ván Cược</h3>
            <p className="text-gray-300 text-sm mb-4">
              Xúc xắc: <span className="font-bold">{gameState.dices?.join(' - ')}</span> ({gameState.totalPoint} điểm)
            </p>

            {lastPayout.winAmount > 0 ? (
              <div className="text-emerald-400 font-extrabold text-2xl my-2">
                + {lastPayout.winAmount.toLocaleString()}đ
              </div>
            ) : (
              <div className="text-gray-400 my-2">Chúc bạn may mắn lần sau!</div>
            )}

            <button
              onClick={() => setShowResultModal(false)}
              className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl w-full"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;