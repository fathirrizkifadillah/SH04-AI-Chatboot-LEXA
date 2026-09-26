import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import lexaBotHead from './assets/lexa_bot_transparent.png';
import api from './lib/apiClient';
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
  | { type: 'typing'; role?: string };

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('lexa_messages') || '[]') as ChatMessage[];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('lexa_session_id') || '');
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('lexa_session_token') || '');
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [escalationShown, setEscalationShown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHandoffRequested, setIsHandoffRequested] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'thumbs_up' | 'thumbs_down'>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Initialize & fetch config
  useEffect(() => {
    api
      .get<WidgetConfig>('/config')
      .then((data: WidgetConfig) => {
        setConfig(data);
        setMessages((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: Date.now(),
                role: 'bot',
                content: data.welcome_message,
                timestamp: Date.now(),
              },
            ];
          }
          return prev;
        });
      })
      .catch((err) => console.error('Failed to load widget config:', err));
  }, []);

  // Save session & messages
  useEffect(() => {
    localStorage.setItem('lexa_session_id', sessionId);
    localStorage.setItem('lexa_session_token', sessionToken);
    if (messages.length > 0) {
      localStorage.setItem('lexa_messages', JSON.stringify(messages));
    }
  }, [messages, sessionId, sessionToken]);

  // WebSocket connection for real-time sync
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const adminTypingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const connectWebSocket = useCallback(() => {
    if (!sessionId || !sessionToken) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/chat/${sessionId}`);
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
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                role: 'admin',
                content: data.content,
                timestamp: Date.now(),
              },
            ]);
          }
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
        } else if (data.type === 'handoff_requested') {
          setIsHandoffRequested(true);
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

  const handleSend = async (textToSend = input) => {
    const text = textToSend.trim();
    if (!text || isStreaming || isWaitingForResponse) return;

    setInput('');
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setIsWaitingForResponse(true);

    try {
      const response = await api.stream('/chat/stream', {
        message: text,
        session_id: sessionId,
        session_token: sessionToken,
      });

      if (!response.ok) throw new Error('API Error');

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

    setSessionId('');
    setSessionToken('');
    setEscalationShown(false);

    setTimeout(() => {
      if (config) {
        const welcomeMsg: ChatMessage = {
          id: Date.now(),
          role: 'bot',
          content: config.welcome_message,
          timestamp: Date.now(),
        };
        setMessages([welcomeMsg]);
        localStorage.setItem('lexa_messages', JSON.stringify([welcomeMsg]));
      } else {
        setMessages([]);
        localStorage.removeItem('lexa_messages');
      }
      setIsRefreshing(false);
    }, 600);
  };

  const handleRequestHandoff = async () => {
    setIsHandoffRequested(true);

    // Kirim via WebSocket jika koneksi terbuka
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'handoff_request', user_name: 'Customer' }));
    }

    // Kirim juga via REST API sebagai garansi pengiriman notifikasi ke admin
    if (sessionId) {
      try {
        await api.post('/api/chat/request-handoff', {
          session_id: sessionId,
          user_name: 'Customer',
        });
      } catch (err) {
        console.warn('REST handoff fallback error:', err);
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'bot',
        content: 'Permintaan bantuan CS Manusia telah diteruskan ke tim kami. Notifikasi sudah dikirim ke Admin CS dan staf kami akan segera bergabung di sini.',
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

  const showQuickReplies =
    config?.quick_replies &&
    messages.length <= 2 &&
    !isStreaming &&
    !isWaitingForResponse &&
    typeof window !== 'undefined' &&
    window.innerWidth > 480;

  // Deteksi layar kecil untuk menyesuaikan ukuran panel
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 480;

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] font-sans">
      {/* Floating Button */}
      <motion.div
        className="absolute bottom-5 right-5 sm:bottom-6 sm:right-6 pointer-events-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        initial={{ scale: 0, y: 50 }}
        animate={{ scale: isOpen ? 0 : 1, y: isOpen ? 50 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="w-[64px] h-[64px] bg-transparent text-white flex items-center justify-center transition-colors"
          aria-label="Buka chat Lexa"
        >
          <img src={lexaBotHead} alt="Lexa" className="w-[48px] h-[48px] object-contain drop-shadow-md" />
        </button>
      </motion.div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            drag={!isSmallScreen}
            dragConstraints={{ left: -800, right: 0, top: -800, bottom: 0 }}
            dragElastic={0.1}
            dragMomentum={false}
            initial={{ opacity: 0, y: 50, scale: 0.9, originX: 1, originY: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            style={
              isSmallScreen
                ? { position: 'absolute', inset: 0, width: '100vw', height: '100vh' }
                : { position: 'absolute', bottom: '24px', right: '24px' }
            }
            className={
              isSmallScreen
                ? 'w-screen h-screen max-w-full max-h-full bg-white rounded-none shadow-none border-0 flex flex-col pointer-events-auto overflow-hidden'
                : 'w-[380px] h-[640px] min-w-[320px] min-h-[400px] max-w-[90vw] max-h-[calc(100vh-100px)] resize overflow-hidden bg-white/95 backdrop-blur-xl rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200/50 flex flex-col pointer-events-auto'
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
            />

            {/* Messages */}
            <ChatMessageList
              messages={messages}
              isStreaming={isStreaming}
              isWaitingForResponse={isWaitingForResponse}
              isAdminTyping={isAdminTyping}
              feedbackGiven={feedbackGiven}
              onFeedback={handleFeedback}
              botAvatar={lexaBotHead}
              messagesEndRef={messagesEndRef}
            />

            {/* Quick Replies */}
            {showQuickReplies && config && (
              <QuickReplies replies={config.quick_replies} onSelect={handleSend} />
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
              disabled={!input.trim() || isStreaming || isWaitingForResponse}
              inputRef={inputRef}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
