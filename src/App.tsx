import React, { useEffect, useState, useRef } from 'react';
import { socket } from './services/socket';
import { GameState, BetChoice, ChatMessage } from './types/game';

export const App: React.FC = () => {
  const [connected, setConnected] = useState<boolean>(false);
  const [balance, setBalance] = useState<number>(100000);
  const [betAmount, setBetAmount] = useState<number>(10000);
  const [myBets, setMyBets] = useState<{ TAI: number; XIU: number }>({ TAI: 0, XIU: 0 });

  // Stale closure fix
  const myBetsRef = useRef(myBets);
  useEffect(() => {
    myBetsRef.current = myBets;
  }, [myBets]);

  // Pop-up & Payout Notification States
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [lastPayout, setLastPayout] = useState<{ amount: number; isWin: boolean } | null>(null);
  const [resultModal, setResultModal] = useState<{
    show: boolean;
    isWin: boolean;
    amount: number;
    choice: string;
    totalPoints: number;
    isTriple?: boolean;
  } | null>(null);

  // Chat states
  const [showChat, setShowChat] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', user: 'Hệ thống', text: 'Chào mừng bạn đến với Tài Xỉu Online! Chúc bạn may mắn 🎲', time: '12:00', isMe: false },
    { id: '2', user: 'HoangNam', text: 'Ván này về Tài chắc luôn anh em ơi 🔥', time: '12:01', isMe: false },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasSettledRef = useRef<boolean>(false);

  const [gameState, setGameState] = useState<GameState>({
    timer: 15,
    phase: 'betting',
    dice: [1, 1, 1],
    totalBetTai: 0,
    totalBetXiu: 0,
    history: ['TAI', 'XIU', 'TAI', 'TAI', 'XIU'],
  });

  // Client timer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setGameState((prev) => {
        if (prev.timer > 0) {
          return { ...prev, timer: prev.timer - 1 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showChat]);

  // Socket Events
  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('game_tick', (data: GameState) => {
      setGameState(data);

      // Bắt đầu ván mới: Reset cược & thông báo thưởng ván cũ
      if (data.phase === 'betting' && data.timer >= 15) {
        setMyBets({ TAI: 0, XIU: 0 });
        setResultModal(null);
        setLastPayout(null);
        hasSettledRef.current = false;
      }

      // Phase Trả Thưởng: Tính toán kết quả & cộng/trừ tiền
      if (data.phase === 'result' && !hasSettledRef.current) {
        hasSettledRef.current = true;

        const currentBets = myBetsRef.current;
        const totalDice = data.dice.reduce((a, b) => a + b, 0);
        
        // Kiểm tra Bão (3 xí ngầu giống nhau - Ví dụ: 1-1-1 hoặc 6-6-6)
        const isTriple = data.dice[0] === data.dice[1] && data.dice[1] === data.dice[2];
        const winChoice = isTriple ? 'BÃO' : (totalDice >= 11 ? 'TAI' : 'XIU');

        const wonBetAmount = winChoice === 'TAI' ? currentBets.TAI : (winChoice === 'XIU' ? currentBets.XIU : 0);
        const totalInvested = currentBets.TAI + currentBets.XIU;

        if (totalInvested > 0) {
          if (wonBetAmount > 0) {
            // Thắng cược: Nhận x2 tiền cược cửa thắng
            const payout = wonBetAmount * 2;
            const profit = payout - totalInvested;

            // Cộng tiền vào tài khoản
            setBalance((prev) => prev + payout);
            setLastPayout({ amount: profit, isWin: true });

            setResultModal({
              show: true,
              isWin: true,
              amount: profit,
              choice: winChoice,
              totalPoints: totalDice,
            });
          } else {
            // Thua cược: Mất toàn bộ tiền đã đặt trong ván
            setLastPayout({ amount: totalInvested, isWin: false });

            setResultModal({
              show: true,
              isWin: false,
              amount: totalInvested,
              choice: winChoice,
              totalPoints: totalDice,
              isTriple,
            });
          }
        }
      }
    });

    socket.on('receive_chat', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('game_tick');
      socket.off('receive_chat');
    };
  }, []);

  // Xử lý Đặt Cược (Trừ tiền ngay khi bấm cược)
  const handleBet = (choice: BetChoice) => {
    if (gameState.phase !== 'betting' || gameState.timer <= 0) {
      alert('Đã hết thời gian đặt cược!');
      return;
    }

    if ((choice === 'TAI' && myBets.XIU > 0) || (choice === 'XIU' && myBets.TAI > 0)) {
      alert('Bạn chỉ được đặt vào 1 cửa trong mỗi ván!');
      return;
    }

    if (balance < betAmount) {
      alert('Số dư không đủ!');
      return;
    }

    // Trừ tiền cược khỏi số dư hiện tại
    setBalance((prev) => prev - betAmount);
    setMyBets((prev) => ({ ...prev, [choice]: prev[choice] + betAmount }));
    socket.emit('place_bet', { choice, amount: betAmount });
  };

  // Chat
  const sendChatMessage = (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      user: 'Tôi',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    socket.emit('send_chat', { text: text.trim() });
    if (!textToSend) setChatInput('');
  };

  const isBettingDisabled = gameState.phase !== 'betting' || gameState.timer <= 0;
  const isTaiDisabled = isBettingDisabled || myBets.XIU > 0;
  const isXiuDisabled = isBettingDisabled || myBets.TAI > 0;

  const totalDice = gameState.dice.reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between items-center p-3 md:p-6 font-sans relative overflow-x-hidden">
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center py-3 px-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
            {connected ? 'ONLINE SERVER' : 'OFFLINE'}
          </span>
          <button
            onClick={() => setShowRulesModal(true)}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-lg border border-slate-700 transition"
          >
            ❓ Luật chơi
          </button>
        </div>

        {/* Khung Số Dư + Hiệu ứng Biến Động Tiền */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowChat(!showChat)}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-1"
          >
            💬 Chat {showChat ? 'Tắt' : 'Mở'}
          </button>

          <div className="text-right relative">
            <span className="text-xs text-slate-400 block">Số Dư</span>
            <span className="text-lg md:text-xl font-extrabold text-amber-400 font-mono">
              {balance.toLocaleString()} đ
            </span>

            {/* Floating Tag hiển thị Tiền Thắng/Thua ở Header */}
            {lastPayout && (
              <div
                className={`absolute -bottom-5 right-0 text-xs font-black font-mono animate-bounce ${
                  lastPayout.isWin ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {lastPayout.isWin ? `+${lastPayout.amount.toLocaleString()}đ` : `-${lastPayout.amount.toLocaleString()}đ`}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-4xl my-auto grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
        {/* Khung Bàn Cược */}
        <main className="lg:col-span-2 flex flex-col items-center gap-5">
          {/* Lịch sử cầu */}
          <div className="flex gap-2 p-2 bg-slate-900 border border-slate-800 rounded-full shadow-inner">
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

          {/* Đếm Ngược & Xí Ngầu */}
          <div className="relative w-64 h-64 md:w-72 md:h-72 rounded-full bg-slate-900 border-4 border-amber-500/30 flex flex-col items-center justify-center shadow-2xl shadow-amber-500/10">
            <div className="text-xs text-amber-400/80 uppercase font-semibold mb-1">
              {gameState.phase === 'betting' ? 'Thời Gian Đặt Cược' : 'Trả Thưởng'}
            </div>

            <div className={`text-6xl font-black font-mono my-2 ${gameState.timer <= 3 && gameState.phase === 'betting' ? 'text-rose-500 animate-bounce' : 'text-amber-400'}`}>
              {gameState.timer}s
            </div>

            {/* 3 Viên Xí Ngầu */}
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

            {/* Kết Quả & Tiền Nhận Khi Hết Ván */}
            {gameState.phase === 'result' && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <div className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full font-bold text-sm border border-amber-500/40 animate-pulse">
                  Tổng: {totalDice} ({gameState.dice[0] === gameState.dice[1] && gameState.dice[1] === gameState.dice[2] ? 'BÃO' : (totalDice >= 11 ? 'TÀI' : 'XỈU')})
                </div>

                {/* Badge Tiền Thắng/Thua Nổi Bật Ngay Trên Bàn */}
                {lastPayout && (
                  <div
                    className={`px-3 py-0.5 rounded-full text-xs font-black font-mono border ${
                      lastPayout.isWin
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                        : 'bg-rose-950/80 text-rose-400 border-rose-500/50'
                    }`}
                  >
                    {lastPayout.isWin ? `Lời +${lastPayout.amount.toLocaleString()}đ` : `Mất -${lastPayout.amount.toLocaleString()}đ`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nút Đặt Cược TÀI / XỈU */}
          <div className="grid grid-cols-2 gap-4 w-full">
            {/* Nút TÀI */}
            <button
              onClick={() => handleBet('TAI')}
              disabled={isTaiDisabled}
              className={`flex flex-col items-center justify-center p-5 rounded-2xl shadow-lg transition border relative overflow-hidden active:scale-95 ${
                isTaiDisabled
                  ? 'bg-slate-800/60 border-slate-700/50 opacity-50 cursor-not-allowed'
                  : 'bg-gradient-to-b from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 border-rose-500/50'
              }`}
            >
              <span className="text-3xl font-black tracking-wider">TÀI</span>
              <span className="text-xs text-rose-200 mt-1">11 - 17</span>
              
              <span className="text-xs font-semibold mt-2 text-rose-100 font-mono">
                Tổng server: {gameState.totalBetTai.toLocaleString()} đ
              </span>

              {myBets.TAI > 0 && (
                <span className="text-xs bg-black/50 px-2 py-0.5 rounded-full mt-1 text-amber-300 font-mono font-bold">
                  Bạn đặt: {myBets.TAI.toLocaleString()} đ
                </span>
              )}

              {isBettingDisabled && (
                <span className="absolute top-2 right-2 bg-rose-950/80 text-rose-300 text-[10px] px-2 py-0.5 rounded-full border border-rose-700 font-bold">
                  🔒 ĐÃ KHÓA
                </span>
              )}
            </button>

            {/* Nút XỈU */}
            <button
              onClick={() => handleBet('XIU')}
              disabled={isXiuDisabled}
              className={`flex flex-col items-center justify-center p-5 rounded-2xl shadow-lg transition border relative overflow-hidden active:scale-95 ${
                isXiuDisabled
                  ? 'bg-slate-800/60 border-slate-700/50 opacity-50 cursor-not-allowed'
                  : 'bg-gradient-to-b from-sky-600 to-sky-800 hover:from-sky-500 hover:to-sky-700 border-sky-500/50'
              }`}
            >
              <span className="text-3xl font-black tracking-wider">XỈU</span>
              <span className="text-xs text-sky-200 mt-1">4 - 10</span>

              <span className="text-xs font-semibold mt-2 text-sky-100 font-mono">
                Tổng server: {gameState.totalBetXiu.toLocaleString()} đ
              </span>

              {myBets.XIU > 0 && (
                <span className="text-xs bg-black/50 px-2 py-0.5 rounded-full mt-1 text-amber-300 font-mono font-bold">
                  Bạn đặt: {myBets.XIU.toLocaleString()} đ
                </span>
              )}

              {isBettingDisabled && (
                <span className="absolute top-2 right-2 bg-sky-950/80 text-sky-300 text-[10px] px-2 py-0.5 rounded-full border border-sky-700 font-bold">
                  🔒 ĐÃ KHÓA
                </span>
              )}
            </button>
          </div>

          {/* Chọn Mệnh Giá Cược */}
          <div className="flex gap-2 justify-center w-full bg-slate-900 p-3 rounded-xl border border-slate-800">
            {[10000, 50000, 100000, 500000].map((amt) => (
              <button
                key={amt}
                onClick={() => setBetAmount(amt)}
                disabled={isBettingDisabled}
                className={`px-4 py-2 rounded-lg font-bold text-xs font-mono transition-all ${
                  betAmount === amt
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                } ${isBettingDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {(amt / 1000).toLocaleString()}k
              </button>
            ))}
          </div>
        </main>

        {/* Khung Chat Trực Tuyến */}
        {showChat && (
          <aside className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between h-[420px] lg:h-auto shadow-xl backdrop-blur-md">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-2">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1">
                💬 Khung Chat Trực Tuyến
              </h3>
              <span className="text-[10px] text-slate-500">Live Socket</span>
            </div>

            {/* Danh sách tin nhắn */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded-xl max-w-[85%] ${
                    msg.isMe
                      ? 'bg-indigo-600/40 text-indigo-100 border border-indigo-500/30 ml-auto text-right'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 mr-auto'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 font-semibold mb-0.5">
                    {msg.user} • <span className="text-[9px] opacity-70">{msg.time}</span>
                  </div>
                  <div className="break-words font-medium">{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat nhanh */}
            <div className="py-2 border-t border-slate-800/80 my-2">
              <div className="text-[10px] text-slate-400 mb-1 font-semibold">Chat nhanh:</div>
              <div className="flex flex-wrap gap-1">
                {['🔥 Tất tay Tài', '😎 Xỉu uy tín', '😭 Cháy túi', '🎲 Bão đi!'].map((quickText) => (
                  <button
                    key={quickText}
                    onClick={() => sendChatMessage(quickText)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg border border-slate-700 transition active:scale-95"
                  >
                    {quickText}
                  </button>
                ))}
              </div>
            </div>

            {/* Ô nhập chat */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChatMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition active:scale-95"
              >
                Gửi
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* MODAL LUẬT CHƠI */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-xl font-black text-amber-400 mb-4 border-b border-slate-800 pb-2 flex justify-between items-center">
              <span>🎲 LUẬT CHƠI TÀI XỈU</span>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </h3>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl">
                <strong className="text-rose-400 text-sm block mb-1">🔴 CỬA TÀI (11 - 17)</strong>
                Tổng số điểm của 3 viên xí ngầu từ **11 đến 17 điểm**.
              </div>

              <div className="p-3 bg-sky-950/40 border border-sky-800/50 rounded-xl">
                <strong className="text-sky-400 text-sm block mb-1">🔵 CỬA XỈU (4 - 10)</strong>
                Tổng số điểm của 3 viên xí ngầu từ **4 đến 10 điểm**.
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl">
                <strong className="text-amber-400 text-sm block mb-1">⚡ BÃO (Bộ 3 giống nhau)</strong>
                Ra 3 mặt giống nhau (VD: 1-1-1 hoặc 6-6-6), nhà cái ăn cả 2 cửa Tài và Xỉu.
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow transition"
            >
              ĐÃ HIỂU
            </button>
          </div>
        </div>
      )}

      {/* MODAL KẾT QUẢ THẮNG / THUA */}
      {resultModal?.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div
            className={`bg-slate-900 border-2 ${
              resultModal.isWin ? 'border-amber-500 shadow-amber-500/20' : 'border-rose-600/60 shadow-rose-600/20'
            } rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-in fade-in zoom-in duration-200`}
          >
            <div className="text-5xl mb-2">{resultModal.isWin ? '🎉' : '😭'}</div>

            <h2
              className={`text-2xl font-black uppercase tracking-wider mb-1 ${
                resultModal.isWin ? 'text-amber-400' : 'text-rose-500'
              }`}
            >
              {resultModal.isWin ? 'BẠN THẮNG LỚN!' : (resultModal.isTriple ? 'BÃO - NHÀ CÁI ĂN!' : 'CHÚC MAY MẮN LẦN SAU')}
            </h2>

            <div className="text-xs text-slate-400 mb-4">
              Kết quả: <strong className="text-white">{resultModal.totalPoints} Điểm</strong> ({resultModal.choice})
            </div>

            <div className="py-3 px-4 bg-slate-950 rounded-2xl border border-slate-800 mb-5 font-mono text-xl font-black">
              {resultModal.isWin ? (
                <span className="text-emerald-400">+{resultModal.amount.toLocaleString()} đ</span>
              ) : (
                <span className="text-rose-400">-{resultModal.amount.toLocaleString()} đ</span>
              )}
            </div>

            <button
              onClick={() => setResultModal(null)}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl shadow-lg transition"
            >
              TIẾP TỤC CHƠI
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-[11px] text-slate-600 py-2">
        Tai Xiu Web Online • Live Socket & Vercel
      </footer>
    </div>
  );
};

export default App;