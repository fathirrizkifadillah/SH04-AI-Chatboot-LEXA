import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Send, Minus, RotateCcw, GripHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import lexaBotHead from './assets/lexa_bot_transparent.png';

const API_URL = 'http://localhost:8000';

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('lexa_session_id') || '');
  const [config, setConfig] = useState(null);
  const [escalationShown, setEscalationShown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // Initialize & fetch config
  useEffect(() => {
    const savedMessages = JSON.parse(localStorage.getItem('lexa_messages') || '[]');
    setMessages(savedMessages);

    fetch(`${API_URL}/config`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        if (savedMessages.length === 0) {
          const welcomeMsg = {
            id: Date.now(),
            role: 'bot',
            content: data.welcome_message,
            timestamp: Date.now()
          };
          setMessages([welcomeMsg]);
          localStorage.setItem('lexa_messages', JSON.stringify([welcomeMsg]));
        }
      })
      .catch(err => console.error("Failed to load config", err));
  }, []);

  // Save session & messages
  useEffect(() => {
    localStorage.setItem('lexa_session_id', sessionId);
    if (messages.length > 0) {
      localStorage.setItem('lexa_messages', JSON.stringify(messages));
    }
  }, [messages, sessionId]);

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
    const userMsg = { id: Date.now(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setIsWaitingForResponse(true);

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      if (!response.ok) throw new Error('API Error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let botMsgId = null;
      let isFirstChunk = true;

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
            const data = JSON.parse(jsonStr);
            if (data.type === 'session') {
              setSessionId(data.session_id);
            } else if (data.type === 'chunk') {
              if (isFirstChunk) {
                 isFirstChunk = false;
                 setIsWaitingForResponse(false);
                 botMsgId = Date.now() + 1;
                 setMessages(prev => [...prev, { id: botMsgId, role: 'bot', content: '', timestamp: Date.now() }]);
              }
              
              fullResponse += data.content;
              setMessages(prev => 
                prev.map(m => m.id === botMsgId ? { ...m, content: fullResponse } : m)
              );
            } else if (data.type === 'error') {
               throw new Error(data.message);
            }
          } catch (e) {
            // ignore
          }
        }
      }
      
      const userMessageCount = messages.filter(m => m.role === 'user').length + 1;
      if (userMessageCount >= 5 && !escalationShown) {
        setEscalationShown(true);
      }

    } catch (error) {
       setIsWaitingForResponse(false);
       setMessages(prev => [...prev, { 
         id: Date.now(), 
         role: 'bot', 
         content: 'Maaf, terjadi kesalahan. Silakan coba lagi.', 
         timestamp: Date.now() 
       }]);
    } finally {
      setIsStreaming(false);
      setIsWaitingForResponse(false);
    }
  };

  const handleReset = async () => {
    setIsRefreshing(true);
    if (sessionId) {
      try {
        await fetch(`${API_URL}/chat/reset?session_id=${sessionId}`, { method: 'POST' });
      } catch (e) {}
    }
    
    setSessionId('');
    setEscalationShown(false);
    
    setTimeout(() => {
        if (config) {
          const welcomeMsg = { id: Date.now(), role: 'bot', content: config.welcome_message, timestamp: Date.now() };
          setMessages([welcomeMsg]);
          localStorage.setItem('lexa_messages', JSON.stringify([welcomeMsg]));
        } else {
          setMessages([]);
          localStorage.removeItem('lexa_messages');
        }
        setIsRefreshing(false);
    }, 600); // efek jeda animasi
  };

  const showQuickReplies = config?.quick_replies && messages.length <= 2 && !isStreaming && !isWaitingForResponse;

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] font-sans">
      
      {/* Floating Button (Bouncy entry) */}
      <motion.div 
        className="absolute bottom-6 right-6 pointer-events-auto"
        initial={{ scale: 0, y: 50 }}
        animate={{ scale: isOpen ? 0 : 1, y: isOpen ? 50 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <button 
          onClick={() => setIsOpen(true)}
          className="w-[64px] h-[64px] bg-transparent text-white flex items-center justify-center  transition-colors"
        >
          {/* Menggunakan image kepala robot yang transparan */}
          <img src={lexaBotHead} alt="Lexa" className="w-[48px] h-[48px] object-contain drop-shadow-md" />
        </button>
      </motion.div>

      {/* Chat Panel - Draggable with Framer Motion */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={panelRef}
            drag
            dragConstraints={{ left: -800, right: 0, top: -800, bottom: 0 }}
            dragElastic={0.1}
            dragMomentum={false}
            initial={{ opacity: 0, y: 50, scale: 0.9, originX: 1, originY: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            style={{ position: 'absolute', bottom: '24px', right: '24px' }}
            className="w-[380px] h-[640px] min-w-[320px] min-h-[400px] max-w-[90vw] max-h-[calc(100vh-100px)] resize overflow-hidden bg-white/95 backdrop-blur-xl rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200/50 flex flex-col pointer-events-auto overflow-hidden"
          >
            {/* Header (Drag Handle) */}
            <div className="cursor-grab active:cursor-grabbing flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white/80 shrink-0 z-10 relative">
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-slate-300">
                 <GripHorizontal size={24} />
              </div>
              <div className="flex items-center gap-3 mt-1 pointer-events-none">
                 <div className="relative">
                    {/* Hapus background frame agar murni kepalanya saja */}
                    <img src={lexaBotHead} alt="Lexa Avatar" className="w-11 h-11 object-contain drop-shadow-sm" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                 </div>
                 <div>
                    <h2 className="text-[15px] font-bold text-slate-800 leading-tight">Xabot</h2>
                    <p className="text-xs text-green-500 font-medium mt-0.5">Online</p>
                 </div>
              </div>
              <div className="flex gap-1 mt-1 z-20">
                 <button onClick={handleReset} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Refresh/Reset">
                   <RotateCcw size={18} className={isRefreshing ? "animate-spin text-blue-600" : ""} />
                 </button>
                 <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Tutup">
                   <Minus size={18} />
                 </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 scroll-smooth relative">
              <AnimatePresence>
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div 
                      key={msg.id || idx} 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 max-w-[90%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                       {!isUser && (
                          <div className="w-9 h-9 flex-shrink-0 flex items-start justify-center mt-0.5">
                             <img src={lexaBotHead} alt="bot" className="w-full h-full object-contain drop-shadow-sm" />
                          </div>
                       )}
                       <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-3 text-[14px] leading-[1.6] shadow-sm break-words whitespace-pre-wrap ${
                              isUser 
                                ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                                : 'bg-white text-slate-700 border border-slate-200/60 rounded-2xl rounded-tl-sm markdown-body'
                            }`}>
                             {isUser ? msg.content : (
                               <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
                                 {msg.content}
                               </ReactMarkdown>
                             )}
                          </div>
                          <span className="text-[10px] text-slate-400 px-1 font-medium mt-0.5">
                            {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp)}
                          </span>
                       </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Typing Indicator with Framer Motion Bounce */}
              <AnimatePresence>
                {isWaitingForResponse && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex gap-3 max-w-[90%]"
                  >
                     <div className="w-10 h-10 flex-shrink-0 flex items-start justify-center mt-0.5">
                        <motion.img 
                          src={lexaBotHead} 
                          alt="typing" 
                          className="w-full h-full object-contain drop-shadow-sm" 
                          animate={{ y: [0, -8, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        />
                     </div>
                     <div className="flex flex-col items-start gap-1">
                         <div className="bg-white border border-slate-200/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm h-11 flex items-center justify-center">
                             <div className="flex gap-1.5 items-center">
                                 <motion.div animate={{y:[0,-4,0]}} transition={{repeat:Infinity, duration:0.6, delay:0}} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.div>
                                 <motion.div animate={{y:[0,-4,0]}} transition={{repeat:Infinity, duration:0.6, delay:0.2}} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.div>
                                 <motion.div animate={{y:[0,-4,0]}} transition={{repeat:Infinity, duration:0.6, delay:0.4}} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.div>
                             </div>
                         </div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            {showQuickReplies && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-5 pb-4 pt-1 flex flex-wrap gap-2 bg-slate-50/50 shrink-0"
              >
                {config.quick_replies.map((text, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleSend(text)}
                    className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white text-[13px] font-medium rounded-full shadow-sm transition-all active:scale-95 text-left"
                  >
                    {text}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Escalation */}
            <AnimatePresence>
              {escalationShown && (
                 <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-5 py-3 bg-amber-50/90 backdrop-blur-md border-t border-amber-200 flex items-center justify-between shrink-0"
                  >
                    <span className="text-xs font-semibold text-amber-800">Butuh bantuan lebih spesifik?</span>
                    <a 
                       href="https://wa.me/6285320132014" 
                       target="_blank" 
                       rel="noreferrer"
                       className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm transition-colors"
                    >
                       Tanya CS Manusia
                    </a>
                 </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shrink-0 z-10 relative">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ketik pertanyaan Anda..."
                  className="flex-1 max-h-[120px] min-h-[48px] bg-slate-100/70 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white rounded-[24px] px-5 py-3.5 text-[14px] text-slate-700 outline-none resize-none transition-all"
                  rows={1}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isStreaming || isWaitingForResponse}
                  className="w-[48px] h-[48px] shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full flex items-center justify-center shadow-md shadow-blue-500/20 transition-all active:scale-95"
                >
                  <Send size={18} className="ml-1" />
                </button>
              </div>
              <div className="text-center mt-3 mb-1">
                 <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">Powered by LEXA Software House</span>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;



