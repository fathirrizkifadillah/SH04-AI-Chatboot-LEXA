import React, { useState, useEffect } from 'react';
import { Search, User, Clock, MessageSquare, AlertCircle } from 'lucide-react';

const Conversations = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionHistory, setSessionHistory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/admin/sessions')
      .then(res => res.json())
      .then(data => {
        setSessions(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching sessions:", err);
        setIsLoading(false);
      });
  }, []);

  const loadSessionHistory = (sessionId) => {
    setSelectedSession(sessionId);
    setSessionHistory(null); // loading state for right pane
    fetch(`http://localhost:8000/api/admin/sessions/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        setSessionHistory(data);
      })
      .catch(err => console.error("Error fetching session history:", err));
  };

  return (
    <div className="h-[calc(100vh-140px)] flex bg-white rounded-2xl shadow-[0_2px_10px_0_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
      
      {/* Left Pane: Session List */}
      <div className="w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" /> 
            Active Conversations
          </h2>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari ID Sesi..." 
              className="w-full bg-white border border-slate-200 text-sm rounded-lg py-2 pl-9 pr-3 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-slate-500 animate-pulse">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">Belum ada percakapan.</div>
          ) : (
            sessions.map((s) => (
              <button 
                key={s.session_id}
                onClick={() => loadSessionHistory(s.session_id)}
                className={`w-full text-left p-3 rounded-xl transition-colors ${selectedSession === s.session_id ? 'bg-blue-50 border border-blue-100 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-slate-800 text-sm truncate pr-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {s.session_id.substring(0, 8)}...
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(s.updated_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{s.last_message || "Memulai percakapan..."}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Chat History */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedSession ? (
          <>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10">
              <div>
                <h3 className="font-bold text-slate-800">Sesi Pelanggan</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {selectedSession}</p>
              </div>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                Riwayat Selesai
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
              {!sessionHistory ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : sessionHistory.history && sessionHistory.history.length > 0 ? (
                sessionHistory.history.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed shadow-sm ${
                        isUser 
                          ? 'bg-blue-600 text-white rounded-tr-sm' 
                          : 'bg-white text-slate-700 border border-slate-200/60 rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <AlertCircle className="w-12 h-12 mb-3 text-slate-300" />
                  <p>Tidak ada pesan dalam sesi ini.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200/60">
                <span>⚠️ Mode Pengawasan (View-Only). Fitur membalas pesan secara manual (Live Takeover) sedang dalam pengembangan.</span>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="w-16 h-16 mb-4 text-slate-200" />
            <p className="text-lg font-medium text-slate-500">Pilih Percakapan</p>
            <p className="text-sm mt-1">Klik salah satu sesi di sebelah kiri untuk melihat riwayat chat.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default Conversations;
