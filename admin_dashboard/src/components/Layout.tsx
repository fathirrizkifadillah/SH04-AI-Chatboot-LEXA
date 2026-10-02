import { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import api from '../lib/apiClient';
import type { ChatSession } from '../types/api';

interface LayoutProps {
  setAuthToken: (token: string | null) => void;
}

// Global Chime alert 2-nada Web Audio API
const playGlobalHandoffChime = () => {
  try {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;
    const audioCtx = new AudioCtxClass();
    const now = audioCtx.currentTime;
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.32, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn('Audio chime warning:', e);
  }
};

const Layout = ({ setAuthToken }: LayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('lexa_sidebar_collapsed') === 'true';
  });
  const [pendingHandoffCount, setPendingHandoffCount] = useState<number>(0);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('lexa_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  const refreshPendingCount = useCallback(() => {
    api.authGet<{ items: ChatSession[]; total: number }>('/api/admin/sessions?limit=100')
      .then(data => {
        const count = data.items.filter(s => Boolean(s.is_human_handoff)).length;
        setPendingHandoffCount(count);
      })
      .catch(() => {});
  }, []);

  // Sinkronkan jumlah antrean CS saat awal dimuat
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Global WebSocket listener untuk notifikasi & chime audio
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;
    let isMounted = true;

    const connectGlobalWs = () => {
      if (!isMounted) return;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/admin`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'handoff_request') {
            playGlobalHandoffChime();
            refreshPendingCount();

            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('Permintaan Bantuan CS Masuk', {
                  body: `${data.user_name || 'Pelanggan'} meminta bantuan staf CS sekarang.`,
                  icon: '/favicon.ico',
                });
              } catch {}
            }
          } else if (data.type === 'handoff_status' || data.type === 'session_deleted' || data.type === 'new_message') {
            refreshPendingCount();
          }
        } catch (e) {
          console.error('Global WS parse error:', e);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimer = setTimeout(connectGlobalWs, 3000);
        }
      };
    };

    connectGlobalWs();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [refreshPendingCount]);

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#0B1529] transition-colors">
      <Sidebar
        setAuthToken={setAuthToken}
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        pendingHandoffCount={pendingHandoffCount}
      />
      <div className={`${sidebarCollapsed ? 'ml-[72px]' : 'ml-64'} transition-all duration-300`}>
        <Header onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;