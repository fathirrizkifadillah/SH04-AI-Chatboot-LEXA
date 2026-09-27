import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { Search, User, Clock, MessageSquare, AlertCircle, Send, ShieldAlert, Bot, Headphones, X, Download, PhoneCall, CheckCircle2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../lib/apiClient';
import type { ChatSession, SessionHistory, Message, AdminReplyReq } from '../types/api';

interface SSEEvent {
  type: 'admin_reply' | 'handoff_user_msg' | 'done' | 'chunk' | 'typing' | 'error' | 'handoff_status' | 'handoff_ended' | 'session_deleted';
  content?: string;
  session_id?: string;
  message?: string;
  is_handoff?: boolean;
  role?: string;
  references?: Array<{ title: string; source: string; score: number }>;
}

interface HandoffNotification {
  session_id: string;
  user_name: string;
  timestamp: number;
}

// Chime alert 2-nada Web Audio API
const playHandoffChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
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
  const [handoffToast, setHandoffToast] = useState('');
  const [replyError, setReplyError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedSessionRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userTypingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  // Authenticated user & role check
  const currentUser = (() => {
    try {
      const u = localStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();
  const canReply = currentUser?.role === 'Super Admin' || currentUser?.role === 'CS Agent';

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const fetchSessions = () => {
    api.authGet<{ items: ChatSession[]; total: number }>('/api/admin/sessions?limit=100')
      .then(data => {
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

  // Admin WebSocket for real-time alerts
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

              if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  const notif = new Notification('Permintaan CS Lexa Masuk', {
                    body: `${data.user_name || 'Pelanggan'} meminta bantuan CS staf sekarang.`,
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

            if (data.session_id && data.session_id === selectedSessionRef.current) {
              loadSessionHistory(data.session_id);
            }
          } else if (data.type === 'session_deleted') {
            setSessions(prev => prev.filter(s => s.session_id !== data.session_id));
            if (selectedSessionRef.current === data.session_id) {
              setSelectedSession(null);
              setSessionData(null);
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
        } else if (data.type === 'handoff_status') {
          const nextState = Boolean(data.is_handoff);
          setSessionData(prev => prev ? { ...prev, is_human_handoff: nextState } : null);
        } else if (data.type === 'session_deleted') {
          setSessions(prev => prev.filter(s => s.session_id !== selectedSession));
          setSelectedSession(null);
          setSessionData(null);
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

  useEffect(() => {
    if (!selectedSession || !sessionData?.is_human_handoff) return;

    const interval = setInterval(() => {
      loadSessionHistory(selectedSession);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedSession, sessionData?.is_human_handoff]);

  const handleToggleHandoff = () => {
    if (!sessionData || !selectedSession || !canReply) return;
    const newState = !sessionData.is_human_handoff;
    setReplyError('');
    setHandoffToast(newState ? 'Mengambil alih obrolan...' : 'Mengembalikan obrolan ke AI...');
    api.authPost(`/api/admin/handoff?session_id=${selectedSession}&is_handoff=${newState}`)
      .then(() => {
        setSessionData(prev => prev ? {...prev, is_human_handoff: newState} : null);
        fetchSessions();
        setHandoffToast(newState ? 'Mode staf CS aktif' : 'Obrolan dikembalikan ke AI');
        setTimeout(() => setHandoffToast(''), 3000);
        if (newState) {
          setTimeout(() => replyInputRef.current?.focus(), 200);
        }
      })
      .catch(err => {
        console.error("Error toggling handoff:", err);
        setHandoffToast('');
        setReplyError('Gagal mengubah status handoff.');
        setTimeout(() => setReplyError(''), 4000);
      });
  };

  const handleAcceptHandoffModal = (sessionId: string) => {
    setSelectedSession(sessionId);
    setActiveModalAlert(null);
    setHandoffNotifications(prev => prev.filter(n => n.session_id !== sessionId));
    if (!canReply) return;
    setHandoffToast('Mengambil alih obrolan...');
    api.authPost(`/api/admin/handoff?session_id=${sessionId}&is_handoff=true`)
      .then(() => {
        loadSessionHistory(sessionId);
        fetchSessions();
        setHandoffToast('Terhubung ke sesi pelanggan');
        setTimeout(() => setHandoffToast(''), 3000);
        setTimeout(() => replyInputRef.current?.focus(), 300);
      })
      .catch(() => {
        setHandoffToast('');
        setReplyError('Gagal mengambil alih obrolan.');
        setTimeout(() => setReplyError(''), 4000);
      });
  };

  const dismissNotification = (sessionId: string) => {
    setHandoffNotifications(prev => prev.filter(n => n.session_id !== sessionId));
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedSession || !canReply) return;
    
    const payload: AdminReplyReq = { session_id: selectedSession, content: replyText.trim() };
    setReplyError('');
    api.authPost('/api/admin/reply', payload)
      .then(() => {
        setReplyText('');
        loadSessionHistory(selectedSession);
      })
      .catch(err => {
        console.error("Error sending reply:", err);
        setReplyError('Gagal mengirim balasan. Pastikan akun memiliki hak CS.');
        setTimeout(() => setReplyError(''), 4000);
      });
  };

  const handleDeleteSession = async () => {
    if (!selectedSession || isDeleting || !canReply) return;
    if (!window.confirm("Hapus percakapan ini secara permanen? Sesi akan dibersihkan dari server dan widget pelanggan.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.authDelete(`/api/admin/sessions/${selectedSession}`);
      setSessions(prev => prev.filter(s => s.session_id !== selectedSession));
      setSelectedSession(null);
      setSessionData(null);
      setHandoffToast('Percakapan berhasil dihapus');
      setTimeout(() => setHandoffToast(''), 3000);
    } catch (e) {
      console.error(e);
      setReplyError('Gagal menghapus percakapan.');
      setTimeout(() => setReplyError(''), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-130px)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative transition-colors">

      {/* Toast Alert */}
      {handoffToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-full shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 dark:text-blue-600" />
          <span>{handoffToast}</span>
        </div>
      )}
      {replyError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-full shadow-xl flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{replyError}</span>
        </div>
      )}

      {/* Pop-up Modal Alert: Permintaan Handoff */}
      {activeModalAlert && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 dark:border-amber-700/60 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mx-auto mb-3 border border-amber-200 dark:border-amber-800">
              <PhoneCall className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Permintaan Obrolan Masuk</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Pelanggan <span className="font-semibold text-slate-800 dark:text-slate-200">{activeModalAlert.user_name}</span> meminta bantuan langsung staf Customer Service.
            </p>
            <div className="my-3 py-1 px-2.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[11px] font-mono text-slate-600 dark:text-slate-400 inline-block border border-slate-200 dark:border-slate-700">
              ID: {activeModalAlert.session_id.slice(0, 12)}
            </div>

            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setActiveModalAlert(null)}
                className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-xl transition-colors"
              >
                Tutup
              </button>
              {canReply ? (
                <button
                  onClick={() => handleAcceptHandoffModal(activeModalAlert.session_id)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terima & Tangani
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedSession(activeModalAlert.session_id);
                    setActiveModalAlert(null);
                  }}
                  className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-colors"
                >
                  Lihat Obrolan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Banner Alert for Pending Handoffs */}
      {handoffNotifications.length > 0 && (
        <div className="shrink-0 bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 divide-y divide-amber-200 dark:divide-amber-900/40">
          {handoffNotifications.map((notif) => (
            <div
              key={notif.session_id}
              className="px-4 py-2 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span className="text-xs font-medium">
                  {notif.user_name} meminta bantuan staf CS (Sesi: {notif.session_id.substring(0, 8)}...)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canReply && (
                  <button
                    onClick={() => handleAcceptHandoffModal(notif.session_id)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    Ambil Alih Obrolan
                  </button>
                )}
                <button
                  onClick={() => dismissNotification(notif.session_id)}
                  className="p-1 hover:bg-amber-200 dark:hover:bg-amber-900 rounded text-amber-700 dark:text-amber-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Split Row */}
      <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
        
        {/* Left Pane: Sessions */}
        <div className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/80 dark:bg-slate-900/50 min-h-0 transition-colors">
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-xs tracking-wide uppercase flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> 
                Daftar Percakapan
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
                className="p-1 px-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors text-[11px] flex items-center gap-1 border border-slate-200 dark:border-slate-700"
              >
                <Download className="w-3 h-3" />
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
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-lg py-1.5 pl-8 pr-2.5 focus:outline-none focus:border-blue-500 placeholder-slate-400"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Memuat sesi...</div>
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
                            ? 'bg-amber-50/80 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 text-slate-800 dark:text-slate-200'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-xs truncate pr-1 flex items-center gap-1.5">
                          <User className={`w-3 h-3 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`} />
                          {s.session_id.substring(0, 8)}...
                          {s.is_human_handoff && (
                            <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-md flex items-center gap-0.5 ${
                              isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-500 text-white'
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
                      <p className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {s.last_message || "Memulai percakapan..."}
                      </p>
                    </button>
                  );
                })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Room */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 min-w-0 min-h-0 transition-colors">
          {selectedSession ? (
            <>
              {/* Chat Header Bar */}
              <div className="shrink-0 p-3.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Sesi Pelanggan</h3>
                      {sessionData?.is_human_handoff ? (
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-medium text-[10px] rounded-md flex items-center gap-1">
                          <Headphones className="w-3 h-3" /> Mode CS Manusia Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[10px] rounded-md flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                          <Bot className="w-3 h-3 text-blue-500" /> Mode AI Otomatis
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {selectedSession}</p>
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
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                    title="Export percakapan ke CSV"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>

                  {canReply && (
                    <>
                      <button 
                        onClick={handleToggleHandoff}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border shadow-sm transition-all flex items-center gap-1.5 ${
                          sessionData?.is_human_handoff 
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent'
                        }`}
                      >
                        {sessionData?.is_human_handoff ? <Bot className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
                        {sessionData?.is_human_handoff ? 'Kembalikan ke AI' : 'Ambil Alih Obrolan'}
                      </button>

                      <button
                        onClick={handleDeleteSession}
                        disabled={isDeleting}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-1"
                        title="Hapus percakapan dan bersihkan sesi pelanggan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Chat Message Scroll Area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
                {!sessionData ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                ) : sessionData.history && sessionData.history.length > 0 ? (
                  sessionData.history.map((msg: Message, idx) => {
                    const isUser = msg.role === 'user';
                    const isAdmin = msg.role === 'admin';
                    const isSystem = msg.role === 'system';

                    if (isSystem) {
                      return (
                        <div key={idx} className="flex justify-center my-2">
                          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-medium rounded-full shadow-sm flex items-center gap-1.5">
                            <Headphones className="w-3 h-3" /> {msg.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-slate-400 mb-0.5 ml-1 font-medium">
                          {isUser ? 'Pelanggan' : isAdmin ? 'Staf CS' : 'Lexa AI'}
                        </span>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                          isUser 
                            ? 'bg-blue-600 text-white rounded-tr-sm' 
                            : isAdmin
                              ? 'bg-amber-600 text-white rounded-tl-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-sm'
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
                    <AlertCircle className="w-6 h-6 mb-2 text-slate-300 dark:text-slate-600" />
                    <p>Tidak ada pesan dalam sesi ini.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Bottom Input Area */}
              <div className="shrink-0 p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {!canReply ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 text-center">
                    Peran akun Anda adalah <strong className="text-slate-700 dark:text-slate-300">{currentUser?.role || 'Editor'}</strong>. Hak membalas pesan dan mengelola handoff hanya tersedia untuk <strong>CS Agent</strong> dan <strong>Super Admin</strong>.
                  </div>
                ) : sessionData?.is_human_handoff ? (
                  <div>
                    {isUserTyping && (
                      <div className="text-[11px] text-blue-500 mb-1 font-medium animate-pulse">
                        Pelanggan sedang mengetik pesan...
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
                        placeholder="Ketik balasan langsung ke pelanggan... (Enter untuk mengirim)"
                        className="flex-1 resize-none border border-amber-300 dark:border-amber-700/80 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl px-3 py-2 outline-none focus:border-amber-500 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400"
                        rows={2}
                      />
                      <button 
                        onClick={handleSendReply}
                        className="px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm font-semibold text-xs gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim</span>
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-1.5">
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Mode CS Manusia aktif. AI tidak akan menginterupsi.
                      </p>
                      <button
                        onClick={handleToggleHandoff}
                        className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 underline"
                      >
                        Selesai? Kembalikan ke AI Bot
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      AI sedang menangani sesi ini secara otomatis.
                    </span>
                    <button
                      onClick={handleToggleHandoff}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1"
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
              <MessageSquare className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Pilih Percakapan</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Pilih sesi obrolan dari daftar untuk melihat atau merespons pelanggan.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default Conversations;
