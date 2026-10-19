import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import lexaBotHead from './assets/lexa_bot_transparent.png';
import api, { API_URL, getWebSocketUrl } from './lib/apiClient';
import type { WidgetConfig, SSEEvent } from './types/api';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList, type ChatMessage } from './components/ChatMessageList';
import { QuickReplies } from './components/QuickReplies';
import { EscalationBanner } from './components/EscalationBanner';
import { ChatInput } from './components/ChatInput';

type ExtendedSSEEvent =
  | SSEEvent
  | { type: 'admin_reply'; content: string }
  | { type: 'handoff_user_msg'; content: string }
  | { type: 'handoff_requested' }
  | { type: 'handoff_status'; is_handoff: boolean }
  | { type: 'handoff_ended' }
  | { type: 'session_deleted'; session_id?: string }
  | { type: 'typing'; role?: string };

// Helper Cookie & LocalStorage persistence untuk mencegah roomchat ter-reset saat refresh
const getCookie = (name: string): string | null => {
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
};

const setCookie = (name: string, value: string, days = 30) => {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
};

const getPersistentId = (key: string): string => {
  let val: string | null = null;
  try {
    val = getCookie(key) || localStorage.getItem(key);
  } catch {}
  if (!val) {
    val = crypto.randomUUID();
  }
  try {
    setCookie(key, val);
    localStorage.setItem(key, val);
  } catch {}
  return val;
};

function App() {
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const widgetPosition = queryParams.get('position') || 'bottom-right';
  const isLeftPos = widgetPosition === 'bottom-left' || widgetPosition === 'top-left';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('lexa_messages') || '[]') as ChatMessage[];
      return stored.map((m) => {
        if (m.role === 'bot' && m.content.toLowerCase().includes('selamat datang di test')) {
          return {
            ...m,
            content: 'Halo! Selamat datang di LEXA Software House. Ada yang bisa kami bantu seputar layanan teknologi kami?',
          };
        }
        return m;
      });
    } catch {
      return [];
    }
  });
  const [showQuickRepliesBar, setShowQuickRepliesBar] = useState(true);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => getPersistentId('lexa_session_id'));
  const [sessionToken, setSessionToken] = useState(() => getPersistentId('lexa_session_token'));
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [escalationShown, setEscalationShown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHandoffRequested, setIsHandoffRequested] = useState(false);
  const [activeAdminName, setActiveAdminName] = useState<string>('');
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'thumbs_up' | 'thumbs_down'>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Initialize & fetch config (Pastikan welcome_message dinamis dari pengaturan backend tampil di user)
  useEffect(() => {
    api
      .get<WidgetConfig>('/config')
      .then((data: WidgetConfig) => {
        let welcome = data.welcome_message;
        if (!welcome || welcome.toLowerCase().includes('selamat datang di test')) {
          welcome = 'Halo! Selamat datang di LEXA Software House. Ada yang bisa kami bantu seputar layanan teknologi kami?';
          data.welcome_message = welcome;
        }
        setConfig(data);
        setMessages((prev) => {
          const isStaleOrClosedMsg =
            prev.length <= 1 &&
            (!prev[0] ||
              (prev[0].role === 'bot' &&
                (prev[0].content.includes('telah ditutup') ||
                  !prev[0].content.trim() ||
                  prev[0].content.toLowerCase().includes('selamat datang di test'))));

          if (prev.length === 0 || isStaleOrClosedMsg) {
            return [
              {
                id: Date.now(),
                role: 'bot',
                content: welcome,
                timestamp: Date.now(),
              },
            ];
          }
          return prev;
        });
      })
      .catch((err) => console.error('Failed to load widget config:', err));
  }, []);

  // Listen to open-lexa-chat event from parent page or buttons
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-lexa-chat', handleOpen);
    return () => window.removeEventListener('open-lexa-chat', handleOpen);
  }, []);

  // Save session & messages to Cookie and LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('lexa_session_id', sessionId);
      localStorage.setItem('lexa_session_token', sessionToken);
      setCookie('lexa_session_id', sessionId);
      setCookie('lexa_session_token', sessionToken);
      if (messages.length > 0) {
        localStorage.setItem('lexa_messages', JSON.stringify(messages));
      }
    } catch {}
  }, [messages, sessionId, sessionToken]);

  // Sinkronkan status handoff saat widget dimuat ulang (agar tidak nyangkut di mode CS setelah refresh)
  useEffect(() => {
    if (!sessionId || !sessionToken) return;
    api
      .get<{ history: unknown[]; is_human_handoff: boolean }>(
        `/api/chat/poll?session_id=${sessionId}&t=${Date.now()}`,
        { headers: { 'X-Lexa-Session': sessionToken } }
      )
      .then((data) => {
        if (typeof data.is_human_handoff === 'boolean') {
          setIsHandoffRequested(data.is_human_handoff);
        }
      })
      .catch(() => {});
  }, [sessionId, sessionToken]);

  // WebSocket connection for real-time sync
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const adminTypingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const connectWebSocket = useCallback(() => {
    if (!sessionId || !sessionToken) return;

    const ws = new WebSocket(getWebSocketUrl(`/ws/chat/${sessionId}`));
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'authenticate', session_token: sessionToken }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ExtendedSSEEvent;
        if (data.type === 'admin_reply' || data.type === 'handoff_user_msg') {
          setIsAdminTyping(false);
          if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
          if (data.type === 'admin_reply' && data.content) {
            const senderName = (data as any).sender_name || 'Staf CS';
            setActiveAdminName(senderName);
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                role: 'admin',
                content: data.content,
                sender_name: senderName,
                sender_role: (data as any).sender_role || 'CS Agent',
                timestamp: Date.now(),
              },
            ]);
          }
          api
            .get<{ history: Array<{ role: string; content: string; timestamp?: number; sender_name?: string; sender_role?: string }> }>(
              `/api/chat/poll?session_id=${sessionId}&t=${Date.now()}`,
              { headers: { 'X-Lexa-Session': sessionToken } }
            )
            .then((pollData) => {
              if (pollData.history && pollData.history.length > 0) {
                const mappedHistory = pollData.history.map((m, i) => ({
                  id: m.timestamp || Date.now() + i,
                  role: m.role === 'assistant' ? 'bot' : m.role,
                  content: m.content,
                  sender_name: m.sender_name,
                  sender_role: m.sender_role,
                  timestamp: m.timestamp || Date.now(),
                })) as ChatMessage[];
                setMessages((prev) => {
                  const welcomeMsg = prev.length > 0 && prev[0].role === 'bot' ? prev[0] : null;
                  const newMsgs = welcomeMsg ? [welcomeMsg, ...mappedHistory] : mappedHistory;
                  const strip = (msgs: ChatMessage[]) =>
                    JSON.stringify(msgs.map((msg) => ({ role: msg.role, content: msg.content })));
                  return strip(prev) !== strip(newMsgs) ? newMsgs : prev;
                });
              }
            })
            .catch(() => {});
        } else if (data.type === 'handoff_requested') {
          setIsHandoffRequested(true);
        } else if (data.type === 'handoff_status') {
          // Sinkronkan status handoff real-time saat CS mengambil alih atau mengembalikan ke AI
          setIsHandoffRequested(data.is_handoff);
        } else if (data.type === 'handoff_ended') {
          setIsHandoffRequested(false);
          setActiveAdminName('');
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: 'bot',
              content: 'Percakapan dengan staf CS telah berakhir. Anda kembali terhubung dengan Lexa AI. Ada lagi yang bisa saya bantu?',
              timestamp: Date.now(),
            },
          ]);
        } else if (data.type === 'session_deleted') {
          setIsHandoffRequested(false);
          setActiveAdminName('');
          const newId = crypto.randomUUID();
          const newToken = crypto.randomUUID();
          setSessionId(newId);
          setSessionToken(newToken);
          localStorage.setItem('lexa_session_id', newId);
          localStorage.setItem('lexa_session_token', newToken);
          setCookie('lexa_session_id', newId);
          setCookie('lexa_session_token', newToken);
          const resetMsg: ChatMessage = {
            id: Date.now(),
            role: 'bot',
            content: config?.welcome_message || 'Halo! Percakapan baru telah dimulai. Ada yang bisa kami bantu?',
            timestamp: Date.now(),
          };
          setMessages([resetMsg]);
          localStorage.setItem('lexa_messages', JSON.stringify([resetMsg]));
        } else if (data.type === 'typing') {
          if (data.role === 'admin') {
            setIsAdminTyping(true);
            if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
            adminTypingTimeoutRef.current = setTimeout(() => {
              setIsAdminTyping(false);
            }, 4000);
          } else {
            setIsWaitingForResponse(true);
          }
        } else if (data.type === 'done') {
          api
            .get<{ history: Array<{ role: string; content: string; timestamp?: number }> }>(
              `/api/chat/poll?session_id=${sessionId}&t=${Date.now()}`,
              { headers: { 'X-Lexa-Session': sessionToken } }
            )
            .then((pollData) => {
              if (pollData.history && pollData.history.length > 0) {
                const mappedHistory = pollData.history.map((m, i) => ({
                  id: m.timestamp || Date.now() + i,
                  role: m.role === 'assistant' ? 'bot' : m.role,
                  content: m.content,
                  timestamp: m.timestamp || Date.now(),
                })) as ChatMessage[];
                setMessages((prev) => {
                  const welcomeMsg = prev.length > 0 && prev[0].role === 'bot' ? prev[0] : null;
                  const newMsgs = welcomeMsg ? [welcomeMsg, ...mappedHistory] : mappedHistory;
                  const strip = (msgs: ChatMessage[]) =>
                    JSON.stringify(msgs.map((msg) => ({ role: msg.role, content: msg.content })));
                  return strip(prev) !== strip(newMsgs) ? newMsgs : prev;
                });
              }
            })
            .catch(() => {});
          setIsWaitingForResponse(false);
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = () => {
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = () => {};
  }, [sessionId, sessionToken]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  // Auto scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, isWaitingForResponse]);

  const handleSend = async (textToSend = input, fileToSend: File | null = selectedFile) => {
    const text = textToSend.trim();
    if ((!text && !fileToSend) || isStreaming || isWaitingForResponse) return;

    setInput('');
    setSelectedFile(null);
    
    // Create object URL for preview, will be replaced by server URL after upload
    const filePreviewUrl = fileToSend ? URL.createObjectURL(fileToSend) : undefined;
    
    const userMsg: ChatMessage = { 
      id: Date.now(), 
      role: 'user', 
      content: text || '[File attached]', 
      timestamp: Date.now(),
      ...(fileToSend && { file: { name: fileToSend.name, type: fileToSend.type, url: filePreviewUrl } })
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setIsWaitingForResponse(true);

    try {
      let response: Response;
      
      // If file is attached, use FormData upload endpoint
      if (fileToSend) {
        const formData = new FormData();
        formData.append('file', fileToSend);
        formData.append('message', text);
        formData.append('session_id', sessionId || '');
        formData.append('session_token', sessionToken || '');
        
        response = await fetch(`${API_URL}/api/chat/upload`, {
          method: 'POST',
          body: formData,
        });
      } else {
        // Normal text message
        response = await api.stream('/chat/stream', {
          message: text,
          session_id: sessionId || undefined,
          session_token: sessionToken || undefined,
        });
      }

      // Jika session invalid / 403, retry dengan token baru tanpa memecah roomchat / sessionId
      if (!response.ok && (response.status === 403 || response.status === 401)) {
        console.warn('Session sync warning, retrying with existing sessionId...');
        const currentSessionId = sessionId || getPersistentId('lexa_session_id');
        const refreshedToken = sessionToken || crypto.randomUUID();
        setSessionToken(refreshedToken);
        localStorage.setItem('lexa_session_token', refreshedToken);
        setCookie('lexa_session_token', refreshedToken);

        if (fileToSend) {
          const formData = new FormData();
          formData.append('file', fileToSend);
          formData.append('message', text);
          formData.append('session_id', currentSessionId);
          formData.append('session_token', refreshedToken);
          response = await fetch(`${API_URL}/api/chat/upload`, {
            method: 'POST',
            body: formData,
          });
        } else {
          response = await api.stream('/chat/stream', {
            message: text,
            session_id: currentSessionId,
            session_token: refreshedToken,
          });
        }
      }

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let botMsgId: number = 0;
      let isFirstChunk = true;

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);

          try {
            const data = JSON.parse(jsonStr) as ExtendedSSEEvent;
            if (data.type === 'session') {
              setSessionId(data.session_id);
              setSessionToken(data.session_token);
            } else if (data.type === 'chunk') {
              if (isFirstChunk) {
                isFirstChunk = false;
                setIsWaitingForResponse(false);
                botMsgId = Date.now() + 1;
                setMessages((prev) => [...prev, { id: botMsgId, role: 'bot', content: '', timestamp: Date.now() }]);
              }

              fullResponse += data.content;
              setMessages((prev) =>
                prev.map((m) => (m.id === botMsgId ? { ...m, content: fullResponse } : m))
              );
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      const lowerText = text.toLowerCase();
      const wantsHuman = ['admin', 'cs', 'manusia', 'operator', 'staf', 'ngobrol sama admin', 'hubungi admin', 'bantuan manusia'].some(k => lowerText.includes(k));
      if (wantsHuman) {
        setEscalationShown(true);
      }

      // Jika sesi dalam mode CS Manusia, backend hanya mengembalikan event 'done'
      // sehingga kita perlu menampilkan pesan konfirmasi agar user tahu pesannya terkirim.
      if (!fullResponse && isHandoffRequested) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 2,
            role: 'bot',
            content: 'Pesan Anda telah diteruskan ke staf CS. Mohon tunggu balasan sebentar ya.',
            timestamp: Date.now(),
          },
        ]);
      }

      const userMessageCount = messages.filter((m) => m.role === 'user').length + 1;
      if ((userMessageCount >= 3 || wantsHuman) && !escalationShown) {
        setEscalationShown(true);
      }
    } catch {
      setIsWaitingForResponse(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'bot',
          content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setIsWaitingForResponse(false);
      // Cleanup object URL after upload completes
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    }
  };

  const handleReset = async () => {
    setIsRefreshing(true);
    if (sessionId) {
      try {
        await api.post(`/chat/reset?session_id=${sessionId}`, undefined, {
          headers: { 'X-Lexa-Session': sessionToken },
        });
      } catch (e) {
        console.error('Reset error:', e);
      }
    }

    const newId = crypto.randomUUID();
    const newToken = crypto.randomUUID();
    setSessionId(newId);
    setSessionToken(newToken);
    localStorage.setItem('lexa_session_id', newId);
    localStorage.setItem('lexa_session_token', newToken);
    setIsHandoffRequested(false);
    setEscalationShown(false);

    setTimeout(() => {
      if (config) {
        let msg = config.welcome_message;
        if (!msg || msg.toLowerCase().includes('selamat datang di test')) {
          msg = 'Halo! Selamat datang di LEXA Software House. Ada yang bisa kami bantu seputar layanan teknologi kami?';
        }
        const welcomeMsg: ChatMessage = {
          id: Date.now(),
          role: 'bot',
          content: msg,
          timestamp: Date.now(),
        };
        setMessages([welcomeMsg]);
        localStorage.setItem('lexa_messages', JSON.stringify([welcomeMsg]));
      } else {
        setMessages([]);
        localStorage.removeItem('lexa_messages');
      }
      setIsRefreshing(false);
    }, 400);
  };

  const handleRequestHandoff = async () => {
    setIsHandoffRequested(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'handoff_request', session_id: sessionId, user_name: 'Pelanggan' }));
    } else {
      try {
        await api.post('/api/chat/request-handoff', {
          session_id: sessionId,
          session_token: sessionToken,
          user_name: 'Pelanggan',
        });
      } catch (err) {
        console.warn('REST handoff error:', err);
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'bot',
        content: 'Permintaan bantuan CS telah diteruskan ke staf admin kami. Notifikasi sudah dikirim dan staf kami akan segera bergabung di sini.',
        timestamp: Date.now(),
      },
    ]);
  };

  const handleFeedback = async (messageIndex: number, rating: 'thumbs_up' | 'thumbs_down') => {
    if (!sessionId || feedbackGiven[messageIndex]) return;
    try {
      await api.post(
        `/api/chat/feedback?session_id=${sessionId}&message_index=${messageIndex}&rating=${rating}`,
        undefined,
        { headers: { 'X-Lexa-Session': sessionToken } }
      );
      setFeedbackGiven((prev) => ({ ...prev, [messageIndex]: rating }));
    } catch (e) {
      console.error('Feedback failed:', e);
    }
  };

  const [isSmallScreen, setIsSmallScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] font-sans">
      {/* Floating Button */}
      <motion.div
        className={`absolute bottom-5 ${isLeftPos ? 'left-5 sm:left-6' : 'right-5 sm:right-6'} pointer-events-auto`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        initial={{ scale: 0, y: 30 }}
        animate={{ scale: isOpen ? 0 : 1, y: isOpen ? 30 : 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      >
        <motion.button
          onClick={() => setIsOpen(true)}
          whileHover={{ scale: 1.08, rotate: [0, -6, 6, 0] }}
          whileTap={{ scale: 0.90, rotate: 12 }}
          style={{ width: '58px', height: '58px', minWidth: '58px', minHeight: '58px', maxWidth: '58px', maxHeight: '58px' }}
          className="w-[58px] h-[58px] rounded-full bg-[#0D182E] hover:bg-[#152545] border border-blue-400/35 text-white flex items-center justify-center shadow-[0_12px_32px_-6px_rgba(0,0,0,0.75)] hover:shadow-[0_16px_36px_-6px_rgba(37,99,235,0.4)] transition-colors duration-200 relative group cursor-pointer p-0 overflow-hidden"
          aria-label="Buka dialog chat Lexa"
          title="Buka percakapan LEXA AI"
        >
          <img
            src={lexaBotHead}
            alt="Lexa"
            width={38}
            height={38}
            style={{ width: '38px', height: '38px', maxWidth: '38px', maxHeight: '38px', objectFit: 'contain' }}
            className="filter drop-shadow-sm select-none transition-transform duration-200 group-hover:scale-110"
          />
          <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0D182E] shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
        </motion.button>
      </motion.div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            drag={!isSmallScreen}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ left: -1000, right: 0, top: -850, bottom: 0 }}
            initial={{ opacity: 0, y: 25, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={
              isSmallScreen
                ? {
                    position: 'fixed',
                    inset: 0,
                    width: '100vw',
                    height: '100dvh',
                    zIndex: 99999,
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                  }
                : {
                    position: 'fixed',
                    bottom: '24px',
                    ...(isLeftPos ? { left: '24px' } : { right: '24px' }),
                    width: isExpanded ? '520px' : '380px',
                    height: isExpanded ? '700px' : '580px',
                    maxWidth: 'calc(100vw - 32px)',
                    maxHeight: 'calc(100vh - 48px)',
                    zIndex: 99999,
                    transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1), height 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  }
            }
            className={
              isSmallScreen
                ? 'w-screen h-[100dvh] bg-[#0A1224] rounded-none shadow-none border-0 flex flex-col pointer-events-auto overflow-hidden'
                : 'bg-[#0A1224] rounded-[24px] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] border border-white/15 flex flex-col pointer-events-auto overflow-hidden select-auto'
            }
          >
            {/* Header */}
            <ChatHeader
              isRefreshing={isRefreshing}
              onReset={handleReset}
              onClose={() => setIsOpen(false)}
              botAvatar={lexaBotHead}
              onRequestHandoff={handleRequestHandoff}
              isHandoffRequested={isHandoffRequested}
              isHandoffActive={isHandoffRequested && Boolean(activeAdminName || messages.some(m => m.role === 'admin'))}
              adminName={activeAdminName}
              isExpanded={isExpanded}
              onToggleExpanded={() => setIsExpanded(prev => !prev)}
              isSmallScreen={isSmallScreen}
              onDragStart={(e) => dragControls.start(e)}
            />

            {/* Messages */}
            <ChatMessageList
              messages={messages}
              isStreaming={isStreaming}
              isWaitingForResponse={isWaitingForResponse}
              isAdminTyping={isAdminTyping}
              feedbackGiven={feedbackGiven}
              onFeedback={handleFeedback}
              onRequestHandoff={handleRequestHandoff}
              botAvatar={lexaBotHead}
              messagesEndRef={messagesEndRef}
            />

            {/* Quick Replies (Always Accessible & Persistent) */}
            {config?.quick_replies && config.quick_replies.length > 0 && !isStreaming && !isWaitingForResponse && (
              showQuickRepliesBar ? (
                <QuickReplies
                  replies={config.quick_replies}
                  onSelect={(text) => handleSend(text)}
                />
              ) : (
                <div className="px-4 py-1.5 flex justify-end bg-[#080E20]/95 shrink-0 border-t border-white/[0.04]">
                  <button
                    onClick={() => setShowQuickRepliesBar(true)}
                    className="text-[11px] text-[#0066FF] hover:text-blue-400 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>✨ Tampilkan Saran Pertanyaan</span>
                  </button>
                </div>
              )
            )}

            {/* Escalation Banner */}
            <EscalationBanner
              isHandoffRequested={isHandoffRequested}
              escalationShown={escalationShown}
              onRequestHandoff={handleRequestHandoff}
            />

            {/* Input Area */}
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={() => handleSend()}
              disabled={(!input.trim() && !selectedFile) || isStreaming || isWaitingForResponse}
              inputRef={inputRef}
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
