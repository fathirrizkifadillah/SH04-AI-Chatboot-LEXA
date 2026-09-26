import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { Search, User, Clock, MessageSquare, AlertCircle, Send, ShieldAlert, Bot, Headphones, X, Download, BellRing, PhoneCall, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../lib/apiClient';
import type { ChatSession, SessionHistory, Message, AdminReplyReq } from '../types/api';

interface SSEEvent {
  type: 'admin_reply' | 'handoff_user_msg' | 'done' | 'chunk' | 'typing' | 'error';
  content?: string;
  session_id?: string;
  message?: string;
  references?: Array<{ title: string; source: string; score: number }>;
}

interface HandoffNotification {
  session_id: string;
  user_name: string;
  timestamp: number;
}

// Suara notifikasi handoff menggunakan Web Audio API murni (Chime alert 2-nada)
const playHandoffChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    // Nada 1: D5 (587.33 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Nada 2: A5 (880 Hz)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch (e) {
    console.warn('Audio chime warning:', e);
  }
};

const Conversations = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [handoffNotifications, setHandoffNotifications] = useState<HandoffNotification[]>([]);
  const [activeModalAlert, setActiveModalAlert] = useState<HandoffNotification | null>(null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserTyping, setIsUserTyping] = useState(false);
  const selectedSessionRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userTypingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  // Simpan reference selectedSession agar selalu up-to-date di handler WebSocket
  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fetch session list
  const fetchSessions = () => {
    api.authGet<{ items: ChatSession[]; total: number }>('/api/admin/sessions?limit=100')
      .then(data => {
        // Sort sessions: yang butuh handoff (is_human_handoff) selalu di paling atas
        const sorted = [...data.items].sort((a, b) => {
          if (a.is_human_handoff && !b.is_human_handoff) return -1;
          if (!a.is_human_handoff && b.is_human_handoff) return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        setSessions(sorted);
        setIsLoading(false);
        if (!selectedSession && sorted.length > 0) {
          setSelectedSession(sorted[0].session_id);
        }
      })
      .catch(err => {
        console.error("Error fetching sessions:", err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Admin WebSocket for real-time handoff alerts
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;
    let isMounted = true;
    
    const connectAdminWs = () => {
      if (!isMounted) return;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/admin`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'handoff_request' || data.type === 'new_message') {
            if (data.type === 'handoff_request') {
              playHandoffChime();

              // Browser Desktop Push Notification
              if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  const notif = new Notification('🚨 Permintaan Obrolan CS Lexa!', {
                    body: `${data.user_name || 'Pelanggan'} meminta bantuan CS sekarang!`,
                    icon: '/favicon.ico',
                  });
                  notif.onclick = () => {
                    window.focus();
                    setSelectedSession(data.session_id);
                  };
                } catch {}
              }

              const newNotif: HandoffNotification = {
                session_id: data.session_id,
                user_name: data.user_name || 'Customer',
                timestamp: data.timestamp || Date.now(),
              };

              setActiveModalAlert(newNotif);
              setHandoffNotifications(prev => {
                if (prev.some(n => n.session_id === data.session_id)) return prev;
                return [newNotif, ...prev];
              });
            }
            fetchSessions();

            // Real-time conversation sync: jika ada pesan masuk pada sesi yang sedang dibuka CS, langsung muat percakapan terbaru
            if (data.session_id && data.session_id === selectedSessionRef.current) {
              loadSessionHistory(data.session_id);
            }
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimeout = setTimeout(connectAdminWs, 3000);
        }
      };
    };

    connectAdminWs();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  // Fetch specific session history
  const loadSessionHistory = (sessionId: string) => {
    api.authGet<SessionHistory>(`/api/admin/sessions/${sessionId}`)
      .then(data => {
        setSessionData(data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      })
      .catch(err => console.error("Error fetching session history:", err));
  };

  // WebSocket connection for real-time sync in selected session
  useEffect(() => {
    if (!selectedSession) return;
    loadSessionHistory(selectedSession);
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/chat/${selectedSession}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const token = localStorage.getItem('lexa_admin_token') || undefined;
      ws.send(JSON.stringify({ type: 'admin_authenticate', token }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        if (data.type === 'admin_reply' || data.type === 'handoff_user_msg' || data.type === 'done' || data.type === 'chunk') {
          if (data.type !== 'chunk') {
            loadSessionHistory(selectedSession);
          }
          if (data.type === 'done') {
            setIsUserTyping(false);
          }
        } else if (data.type === 'typing') {
          setIsUserTyping(true);
          if (userTypingTimeoutRef.current) clearTimeout(userTypingTimeoutRef.current);
          userTypingTimeoutRef.current = setTimeout(() => {
            setIsUserTyping(false);
          }, 4000);
        }
      } catch {}
    };

    return () => {
      if (userTypingTimeoutRef.current) clearTimeout(userTypingTimeoutRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [selectedSession]);

  // Polling fallback saat dalam mode Human Handoff (menjamin pesan tidak pernah terlewat jika WS terputus)
  useEffect(() => {
    if (!selectedSession || !sessionData?.is_human_handoff) return;

    const interval = setInterval(() => {
      loadSessionHistory(selectedSession);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedSession, sessionData?.is_human_handoff]);

  const handleToggleHandoff = () => {
    if (!sessionData || !selectedSession) return;
    const newState = !sessionData.is_human_handoff;
    api.authPost(`/api/admin/handoff?session_id=${selectedSession}&is_handoff=${newState}`)
      .then(() => {
        setSessionData(prev => prev ? {...prev, is_human_handoff: newState} : null);
        fetchSessions();
        if (newState) {
          setTimeout(() => replyInputRef.current?.focus(), 200);
        }
      })
      .catch(err => console.error("Error toggling handoff:", err));
  };

  const handleAcceptHandoffModal = (sessionId: string) => {
    setSelectedSession(sessionId);
    setActiveModalAlert(null);
    setHandoffNotifications(prev => prev.filter(n => n.session_id !== sessionId));
    api.authPost(`/api/admin/handoff?session_id=${sessionId}&is_handoff=true`)
      .then(() => {
        loadSessionHistory(sessionId);
        fetchSessions();
        setTimeout(() => replyInputRef.current?.focus(), 300);
      })
      .catch(() => {});
  };

  const dismissNotification = (sessionId: string) => {
    setHandoffNotifications(prev => prev.filter(n => n.session_id !== sessionId));
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedSession) return;
    
    const payload: AdminReplyReq = { session_id: selectedSession, content: replyText.trim() };
    api.authPost('/api/admin/reply', payload)
      .then(() => {
        setReplyText('');
        loadSessionHistory(selectedSession);
      })
      .catch(err => console.error("Error sending reply:", err));
  };

  return (
    <div className="h-[calc(100vh-130px)] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      
      {/* Pop-up Modal Alert: Permintaan Handoff Baru Masuk */}
      {activeModalAlert && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-amber-400 text-center animate-[scaleUp_0.25s_ease-out]">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-amber-50">
              <PhoneCall className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Panggilan Obrolan Masuk!</h3>
            <p className="text-sm text-slate-600 mt-2">
              Pelanggan <span className="font-semibold text-slate-900">"{activeModalAlert.user_name}"</span> meminta bantuan langsung dengan Staf CS Manusia.
            </p>
            <div className="my-3 py-1.5 px-3 bg-amber-50 rounded-xl text-xs font-mono text-amber-800 inline-block border border-amber-200">
              ID Sesi: {activeModalAlert.session_id}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setActiveModalAlert(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm rounded-xl transition-colors"
              >
                Nanti Dulu
              </button>
              <button
                onClick={() => handleAcceptHandoffModal(activeModalAlert.session_id)}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-green-600/30 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Terima & Balas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner Alert for Pending Handoffs */}
      {handoffNotifications.length > 0 && (
        <div className="shrink-0 bg-amber-500 text-white border-b border-amber-600 divide-y divide-amber-400/40">
          {handoffNotifications.map((notif) => (
            <div
              key={notif.session_id}
              className="px-4 py-2 flex items-center justify-between gap-3 animate-pulse"
            >
              <div className="flex items-center gap-2.5">
                <BellRing className="w-4 h-4 animate-bounce shrink-0" />
                <span className="text-xs font-semibold">
                  🚨 {notif.user_name} meminta bantuan CS Manusia! (Sesi: {notif.session_id.substring(0, 8)}...)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAcceptHandoffModal(notif.session_id)}
                  className="px-3 py-1 bg-white text-amber-700 hover:bg-amber-50 text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Ambil Alih Obrolan
                </button>
                <button
                  onClick={() => dismissNotification(notif.session_id)}
                  className="p-1 hover:bg-amber-600 rounded transition-colors text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Split Row: Left Session List + Right Chat Room */}
      <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
        
        {/* Left Pane: Sessions (Fixed Width 320px) */}
        <div className="w-80 shrink-0 border-r border-slate-100 flex flex-col bg-slate-50/60 min-h-0">
          <div className="p-3.5 border-b border-slate-100 shrink-0">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-600" /> 
                Active Chats
              </h2>
              <button
                onClick={async () => {
                  const apiUrl = window.__LEXA_CONFIG__?.apiUrl || window.location.origin;
                  try {
                    const res = await fetch(`${apiUrl}/api/admin/sessions/export-all?format=csv`, {
                      credentials: 'include',
                    });
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lexa_all_chats.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) { console.error(e); }
                }}
                title="Download semua percakapan (CSV)"
                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors text-xs flex items-center gap-1 border border-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari sesi atau pesan..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs rounded-lg py-1.5 pl-8 pr-2.5 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-400 animate-pulse">Memuat sesi...</div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">Belum ada percakapan.</div>
            ) : (
              sessions
                .filter(s => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return s.session_id.toLowerCase().includes(q) ||
                         (s.last_message && s.last_message.toLowerCase().includes(q));
                })
                .map((s) => {
                  const isSelected = selectedSession === s.session_id;
                  return (
                    <button 
                      key={s.session_id}
                      onClick={() => setSelectedSession(s.session_id)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : s.is_human_handoff
                            ? 'bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/70 text-slate-800'
                            : 'hover:bg-slate-200/60 text-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-semibold text-xs truncate pr-1 flex items-center gap-1.5">
                          <User className={`w-3 h-3 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`} />
                          {s.session_id.substring(0, 8)}...
                          {s.is_human_handoff && (
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-0.5 animate-pulse ${
                              isSelected ? 'bg-amber-400 text-slate-900' : 'bg-red-500 text-white'
                            }`}>
                              <Headphones className="w-2.5 h-2.5" /> BUTUH CS
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] whitespace-nowrap flex items-center gap-0.5 ${
                          isSelected ? 'text-blue-100' : 'text-slate-400'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          {s.updated_at ? new Date(s.updated_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        {s.last_message || "Memulai percakapan..."}
                      </p>
                    </button>
                  );
                })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Room */}
        <div className="flex-1 flex flex-col bg-white min-w-0 min-h-0">
          {selectedSession ? (
            <>
              {/* Chat Header Bar */}
              <div className="shrink-0 p-3.5 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm">Sesi Pelanggan</h3>
                      {sessionData?.is_human_handoff ? (
                        <span className="px-2.5 py-1 bg-amber-500 text-white font-bold text-[10px] rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                          <Headphones className="w-3 h-3" /> Mode CS Manusia Aktif (AI Nonaktif)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold text-[10px] rounded-full flex items-center gap-1 border border-blue-200">
                          <Bot className="w-3 h-3" /> Mode AI Bot Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {selectedSession}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const apiUrl = window.__LEXA_CONFIG__?.apiUrl || window.location.origin;
                      try {
                        const res = await fetch(`${apiUrl}/api/admin/sessions/${selectedSession}/export?format=csv`, {
                          credentials: 'include',
                        });
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `chat_${selectedSession?.slice(0, 8)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (e) { console.error(e); }
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>

                  <button 
                    onClick={handleToggleHandoff}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border shadow-sm transition-all flex items-center gap-1.5 ${
                      sessionData?.is_human_handoff 
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300' 
                        : 'bg-green-600 hover:bg-green-700 text-white border-green-700'
                    }`}
                  >
                    {sessionData?.is_human_handoff ? <Bot className="w-3.5 h-3.5 text-amber-700" /> : <Headphones className="w-3.5 h-3.5 text-white" />}
                    {sessionData?.is_human_handoff ? 'Kembalikan ke AI' : 'Ambil Alih Obrolan (Handoff)'}
                  </button>
                </div>
              </div>
              
              {/* Chat Message Scroll Area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
                {!sessionData ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : sessionData.history && sessionData.history.length > 0 ? (
                  sessionData.history.map((msg: Message, idx) => {
                    const isUser = msg.role === 'user';
                    const isAdmin = msg.role === 'admin';
                    const isSystem = msg.role === 'system';

                    if (isSystem) {
                      return (
                        <div key={idx} className="flex justify-center my-2">
                          <span className="px-3.5 py-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-full shadow-sm flex items-center gap-1.5">
                            <Headphones className="w-3.5 h-3.5" /> {msg.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-slate-400 mb-0.5 ml-1 font-medium">
                          {isUser ? 'Pelanggan' : isAdmin ? 'Staf CS (Anda)' : 'Lexa AI'}
                        </span>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                          isUser 
                            ? 'bg-blue-600 text-white rounded-tr-sm' 
                            : isAdmin
                              ? 'bg-amber-500 text-white rounded-tl-sm'
                              : 'bg-white text-slate-700 border border-slate-200/80 rounded-tl-sm'
                        }`}>
                          {isUser ? msg.content : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                    <AlertCircle className="w-8 h-8 mb-2 text-slate-300" />
                    <p>Tidak ada pesan dalam sesi ini.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Bottom Input Area */}
              <div className="shrink-0 p-3.5 border-t border-slate-100 bg-white">
                {sessionData?.is_human_handoff ? (
                  <div>
                    {isUserTyping && (
                      <div className="text-[11px] text-blue-500 mb-1.5 font-medium animate-pulse">
                        Pelanggan sedang mengetik...
                      </div>
                    )}
                    <div className="flex gap-2">
                      <textarea 
                        ref={replyInputRef}
                        value={replyText}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                          setReplyText(e.target.value);
                          if (wsRef.current?.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({ type: 'typing', role: 'admin' }));
                          }
                        }}
                        onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        placeholder="Ketik balasan langsung ke pelanggan di sini (Enter untuk kirim)..."
                        className="flex-1 resize-none border border-amber-300 bg-amber-50/50 rounded-xl px-3 py-2 outline-none focus:border-amber-500 text-xs text-slate-800"
                        rows={2}
                      />
                      <button 
                        onClick={handleSendReply}
                        className="px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm font-semibold text-xs gap-1.5"
                      >
                        <Send className="w-4 h-4" />
                        <span>Kirim</span>
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-1.5">
                      <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Mode CS Manusia: Anda sedang menjawab langsung. AI tidak akan menginterupsi.
                      </p>
                      <button
                        onClick={handleToggleHandoff}
                        className="text-[10px] text-slate-500 hover:text-slate-800 underline"
                      >
                        Selesai? Kembalikan ke AI Bot
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-blue-600" />
                      AI sedang menjawab otomatis. Ingin membalas langsung secara manual?
                    </span>
                    <button
                      onClick={handleToggleHandoff}
                      className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      Ambil Alih Obrolan
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="w-12 h-12 mb-2 text-slate-200" />
              <p className="text-sm font-medium text-slate-500">Pilih Percakapan</p>
              <p className="text-xs text-slate-400 mt-0.5">Pilih salah satu sesi di sebelah kiri untuk melihat pesan.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default Conversations;
