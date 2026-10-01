import { RefObject, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThumbsUp, ThumbsDown, FileText, FileType, ZoomIn, X, Download } from 'lucide-react';
import type { Message } from '../types/api';

export interface ChatMessage extends Message {
  id: number;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isWaitingForResponse: boolean;
  isAdminTyping: boolean;
  feedbackGiven: Record<number, 'thumbs_up' | 'thumbs_down'>;
  onFeedback: (idx: number, rating: 'thumbs_up' | 'thumbs_down') => void;
  botAvatar: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export const ChatMessageList = ({
  messages,
  isStreaming,
  isWaitingForResponse,
  isAdminTyping,
  feedbackGiven,
  onFeedback,
  botAvatar,
  messagesEndRef,
}: ChatMessageListProps) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hidden p-5 space-y-6 bg-slate-50/50 scroll-smooth relative">
      <AnimatePresence>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isAdmin = msg.role === 'admin';
          const isBot = !isUser && !isAdmin;
          const feedbackStatus = feedbackGiven[idx];
          return (
            <motion.div
              key={msg.id || idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 max-w-[90%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {!isUser && (
                <div className="w-9 h-9 flex-shrink-0 flex items-start justify-center mt-0.5">
                  <img src={botAvatar} alt="bot" className="w-full h-full object-contain drop-shadow-sm" />
                </div>
              )}
              <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-3 text-[14px] leading-[1.6] shadow-sm break-words whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#0066FF] text-white rounded-2xl rounded-tr-sm'
                      : isAdmin
                        ? 'bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl rounded-tl-sm markdown-body'
                        : 'bg-white text-slate-700 border border-slate-200/60 rounded-2xl rounded-tl-sm markdown-body'
                  }`}
                >
                  {isUser ? (
                    msg.content
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
                {msg.file && (
                  <div className="mt-1.5">
                    {msg.file.type.startsWith('image/') && msg.file.url ? (
                      <div 
                        className="relative group rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-sm max-w-[220px]"
                        onClick={() => {
                          setPreviewImage(msg.file?.url || '');
                          setPreviewImageName(msg.file?.name || 'Gambar');
                        }}
                      >
                        <img 
                          src={msg.file.url} 
                          alt={msg.file.name} 
                          className="max-h-48 w-auto object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                          <ZoomIn size={16} />
                          <span className="text-[11px] font-semibold">Perbesar</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-2 inline-flex">
                        {msg.file.type === 'application/pdf' ? (
                          <>
                            <FileText size={14} className="text-red-500" />
                            <span className="text-xs text-slate-600">{msg.file.name}</span>
                            <span className="text-[10px] text-slate-400 ml-1">PDF</span>
                          </>
                        ) : msg.file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? (
                          <>
                            <FileText size={14} className="text-blue-500" />
                            <span className="text-xs text-slate-600">{msg.file.name}</span>
                            <span className="text-[10px] text-slate-400 ml-1">DOCX</span>
                          </>
                        ) : msg.file.type === 'text/plain' ? (
                          <>
                            <FileType size={14} className="text-slate-500" />
                            <span className="text-xs text-slate-600">{msg.file.name}</span>
                            <span className="text-[10px] text-slate-400 ml-1">TXT</span>
                          </>
                        ) : (
                          <>
                            <FileText size={14} className="text-slate-500" />
                            <span className="text-xs text-slate-600">{msg.file.name}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <span className="text-[10px] text-slate-400 px-1 font-medium mt-0.5">
                  {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp)}
                </span>
                {isBot && !isStreaming && idx === messages.length - 1 && !feedbackStatus && (
                  <div className="flex gap-1 px-1 mt-0.5">
                    <button
                      onClick={() => onFeedback(idx, 'thumbs_up')}
                      className="p-1 text-slate-300 hover:text-[#0D7AFF] transition-colors rounded"
                      title="Jawaban membantu"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      onClick={() => onFeedback(idx, 'thumbs_down')}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                      title="Jawaban kurang membantu"
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </div>
                )}
                {feedbackStatus && (
                  <div className="flex items-center gap-1 px-1 mt-0.5">
                    {feedbackStatus === 'thumbs_up' ? (
                      <ThumbsUp size={12} className="text-[#0D7AFF]" />
                    ) : (
                      <ThumbsDown size={12} className="text-red-500" />
                    )}
                    <span className="text-[10px] text-slate-400">Thanks!</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Typing Indicator with Framer Motion Bounce */}
      <AnimatePresence>
        {(isWaitingForResponse || isAdminTyping) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex gap-3 max-w-[90%]"
          >
            <div className="w-10 h-10 flex-shrink-0 flex items-start justify-center mt-0.5">
              <motion.img
                src={botAvatar}
                alt="typing"
                className="w-full h-full object-contain drop-shadow-sm"
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              />
            </div>
            <div className="flex flex-col items-start gap-1">
              {isAdminTyping && (
                <span className="text-[10px] text-amber-500 font-medium">CS Agent sedang mengetik...</span>
              )}
              <div className="bg-white border border-slate-200/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm h-11 flex items-center justify-center">
                <div className="flex gap-1.5 items-center">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                    className="w-1.5 h-1.5 bg-[#0D7AFF] rounded-full"
                  />
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                    className="w-1.5 h-1.5 bg-[#0D7AFF] rounded-full"
                  />
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                    className="w-1.5 h-1.5 bg-[#0D7AFF] rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={messagesEndRef} />

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between pb-2 text-white">
              <span className="text-xs font-medium truncate max-w-xs">{previewImageName}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  download={previewImageName || 'image.jpg'}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Unduh"
                >
                  <Download size={15} />
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Tutup"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <img 
              src={previewImage} 
              alt={previewImageName || 'Preview'} 
              className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10" 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessageList;
