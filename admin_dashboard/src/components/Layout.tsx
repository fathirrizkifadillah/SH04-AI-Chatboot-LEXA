import { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import api, { getWebSocketUrl } from '../lib/apiClient';
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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

  // 30-minute idle session timeout (BUG-AUTH-002)
  useEffect(() => {
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 menit

    const performIdleLogout = () => {
      sessionStorage.removeItem('lexa_admin_user');
      sessionStorage.removeItem('lexa_admin_token');
      localStorage.removeItem('lexa_admin_user');
      localStorage.removeItem('lexa_admin_token');
      localStorage.removeItem('lexa_last_activity');
      api.post('/api/auth/logout').catch(() => {});
      setAuthToken(null);
      alert('Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit. Silakan login kembali.');
    };

    const recordActivity = () => {
      localStorage.setItem('lexa_last_activity', Date.now().toString());
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => window.addEventListener(evt, recordActivity, { passive: true }));
    recordActivity();

    const intervalCheck = setInterval(() => {
      const last = Number(localStorage.getItem('lexa_last_activity') || Date.now());
      if (Date.now() - last > IDLE_TIMEOUT_MS) {
        performIdleLogout();
      }
    }, 10000);

    return () => {
      clearInterval(intervalCheck);
      activityEvents.forEach(evt => window.removeEventListener(evt, recordActivity));
    };
  }, [setAuthToken]);

  // Global WebSocket listener untuk notifikasi & chime audio
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;
    let isMounted = true;

    const connectGlobalWs = () => {
      if (!isMounted) return;
      const token = sessionStorage.getItem('lexa_admin_token') || '';
      ws = new WebSocket(`${getWebSocketUrl('/ws/admin')}${token ? `?token=${encodeURIComponent(token)}` : ''}`);

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
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#0B1529] transition-colors relative w-full max-w-full overflow-x-hidden">
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}
      <Sidebar
        setAuthToken={setAuthToken}
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        pendingHandoffCount={pendingHandoffCount}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />
      <div className={`min-h-screen transition-all duration-300 flex flex-col min-w-0 ${sidebarCollapsed ? 'lg:pl-[74px]' : 'lg:pl-64'}`}>
        <Header
          onToggleSidebar={() => {
            if (window.innerWidth < 1024) {
              setIsMobileOpen(prev => !prev);
            } else {
              toggleSidebar();
            }
          }}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="flex-1 w-full min-w-0 p-3.5 sm:p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;