import React, { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { RealTimeMap } from './components/RealTimeMap';
import { Welcome } from './components/Welcome';
import { Auth } from './components/Auth';
import { LayoutDashboard, Map as MapIcon, Activity, Wifi, X, AlertTriangle } from 'lucide-react';
import { RoadData } from './types';
// @ts-ignore
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getDatabase, ref, onValue } from 'firebase/database';

// Real coordinates for Roads from 6th of October to Tahrir
const initialRoads: RoadData[] = [
  {
    id: 1,
    name: 'محور 26 يوليو',
    capacity: 5,
    currentVehicles: 180,
    vocs: 85,
    gateStatus: 'open',
    location: 'اتجاه ميدان لبنان',
    coordinates: [30.0350, 31.0800],
    path: [
      [30.0074, 30.9733],
      [30.0300, 31.0200],
      [30.0500, 31.1300],
      [30.0550, 31.1800],
    ],
    avgGreenTime: 10,
  },
  {
    id: 2,
    name: 'شارع جامعة الدول العربية',
    capacity: 120,
    currentVehicles: 60,
    vocs: 45,
    gateStatus: 'open',
    location: 'المهندسين',
    coordinates: [30.0511, 31.2000],
    path: [
      [30.0550, 31.1800],
      [30.0511, 31.2000],
      [30.0469, 31.2100],
    ],
    avgGreenTime: 15,
  },
  {
    id: 3,
    name: 'كوبري 6 أكتوبر',
    capacity: 180,
    currentVehicles: 170,
    vocs: 92,
    gateStatus: 'closed',
    location: 'أعلى الزمالك',
    coordinates: [30.0469, 31.2290],
    path: [
      [30.0469, 31.2100],
      [30.0520, 31.2250],
      [30.0469, 31.2290],
      [30.0450, 31.2330],
    ],
    avgGreenTime: 12,
  },
  {
    id: 4,
    name: 'طريق الواحات',
    capacity: 15,
    currentVehicles: 5,
    vocs: 30,
    gateStatus: 'open',
    location: 'مدخل أكتوبر',
    coordinates: [29.9800, 31.0200],
    path: [
      [29.9600, 30.9400],
      [29.9800, 31.0200],
      [30.0000, 31.1000],
    ],
    avgGreenTime: 5,
  },
  {
    id: 5,
    name: 'كوبري قصر النيل',
    capacity: 100,
    currentVehicles: 80,
    vocs: 50,
    gateStatus: 'open',
    location: 'وسط البلد',
    coordinates: [30.0435, 31.2285],
    path: [
      [30.0430, 31.2200],
      [30.0435, 31.2285],
      [30.0444, 31.2357],
    ],
    avgGreenTime: 10,
  },
];

// HARDCODED FIREBASE URL
const FIREBASE_DB_URL = "https://traffic-c79be-default-rtdb.firebaseio.com/";

// Initialize Firebase App OUTSIDE the component
let db: any;
try {
  const app = initializeApp({ databaseURL: FIREBASE_DB_URL });
  db = getDatabase(app);
} catch (e) {
  console.error("Firebase Initialization Error:", e);
}

// Notifications helper
const sendSystemNotification = (title: string, body: string, tag: string) => {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/1032/1032989.png',
        tag,
        renotify: true,
        requireInteraction: tag === 'closed',
      });
    } catch (e) {
      console.error("Notification Error", e);
    }
  }
};

// ---- TUNABLES ----
const WARNING_THRESHOLD = 8;      // cars >= 8 => warning
const CLOSED_THRESHOLD = 10;      // cars >= 10 => closed
const POPUP_AUTO_CLOSE_MS = 30000;
const SNOOZE_MS = 30000;          // when user clicks X, hide this alert type for 30s

export default function App() {
  const [viewState, setViewState] = useState<'welcome' | 'auth' | 'app'>('welcome');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map'>('dashboard');
  const [roads, setRoads] = useState<RoadData[]>(initialRoads);
  const [isConnected, setIsConnected] = useState(false);

  const [popupData, setPopupData] = useState<{
    message: string;
    type: 'warning' | 'closed';
    visible: boolean;
  }>({ message: '', type: 'warning', visible: false });

  // Keep latest popup in a ref (so Firebase listener doesn’t use stale state)
  const popupRef = useRef(popupData);
  useEffect(() => {
    popupRef.current = popupData;
  }, [popupData]);

  // Prevent spamming notifications
  const prevWarningRef = useRef(false);
  const prevClosedRef = useRef(false);

  // Snooze (when user clicks X)
  const snoozeUntilRef = useRef<{ warning: number; closed: number }>({
    warning: 0,
    closed: 0,
  });

  const canShow = (type: 'warning' | 'closed') => Date.now() >= snoozeUntilRef.current[type];

  const showPopup = (type: 'warning' | 'closed', message: string) => {
    setPopupData(prev => {
      // If already showing same type, don’t re-render spam
      if (prev.visible && prev.type === type && prev.message === message) return prev;
      return { type, message, visible: true };
    });
  };

  // Request Notification Permission
  useEffect(() => {
    if (viewState === 'app' && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, [viewState]);

  // Auto-close popup
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (popupData.visible) {
      timer = setTimeout(() => {
        setPopupData(prev => ({ ...prev, visible: false }));
      }, POPUP_AUTO_CLOSE_MS);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [popupData.visible]);

  // Listen for Sensor Data (IMPORTANT: subscribe once)
  useEffect(() => {
    if (!db) return;

    console.log("Listening to Firebase...");
    const roadsRef = ref(db, '/');

    const unsubscribe = onValue(
      roadsRef,
      (snapshot: any) => {
        const data = snapshot.val();
        if (!data) return;

        setIsConnected(true);

        setRoads(prevRoads =>
          prevRoads.map(road => {
            if (road.id !== 4) return road;

            // If your DB is root like: { color, gate, sensors } => roadData = data
            // If your DB is nested under "4": { "4": { color, gate... } } => roadData = data["4"]
            const roadData = data["4"] ? data["4"] : data;

            const avgGreen = Number(roadData.color?.avgGreen ?? roadData.avgGreen ?? road.avgGreenTime);
            const currentVehicles = Number(
              roadData.gate?.carCount ??
              roadData.currentVehicles ??
              roadData.Vehicles ??
              road.currentVehicles
            );

            // Debug (so you ALWAYS know what app reads)
            console.log(
              "RAW avgGreen:",
              roadData.color?.avgGreen,
              "avgGreen number:",
              avgGreen,
              "cars:",
              currentVehicles
            );

            let gateStatus: 'open' | 'closed' = roadData.gate?.isClosed ? 'closed' : 'open';

            // ---- ALERT PRIORITY ----
            // 1) Closed (>= 10)
            if (currentVehicles >= CLOSED_THRESHOLD && canShow('closed')) {
              gateStatus = 'closed';

              showPopup('closed', "🚨 طريق مغلق: عدد العربيات وصل 10! سيتم إعادة الفتح بعد 15 دقيقة.");

              if (!prevClosedRef.current) {
                sendSystemNotification("🛑 طريق مغلق", "طريق الواحات مزدحم جداً (10+ سيارات).", "closed");
              }
            }
            // 2) Warning (>= 8)
            else if (currentVehicles >= WARNING_THRESHOLD && canShow('warning')) {
              showPopup('warning', "⚠️ تحذير: كثافة عالية (8 سيارات). الطريق اقترب من الإغلاق.");

              if (!prevWarningRef.current) {
                sendSystemNotification("⚠️ تنبيه مروري", "طريق الواحات قرب يقفل (8 سيارات).", "warning");
              }
            }

            // Update “previous state” refs (to reduce spamming notifications)
            prevClosedRef.current = currentVehicles >= CLOSED_THRESHOLD;
            prevWarningRef.current = currentVehicles >= WARNING_THRESHOLD && currentVehicles < CLOSED_THRESHOLD;

            // Handle Reopen Time (15 min timer)
            let newReopenTime = road.reopenTime;
            if (currentVehicles >= CLOSED_THRESHOLD && !road.reopenTime) {
              newReopenTime = Date.now() + (15 * 60 * 1000);
            } else if (currentVehicles < CLOSED_THRESHOLD) {
              newReopenTime = undefined;
            }

            return {
              ...road,
              currentVehicles,
              gateStatus,
              avgGreenTime: avgGreen,
              reopenTime: newReopenTime,
              sensors: roadData.sensors ?? road.sensors,
            };
          })
        );
      },
      (error: any) => {
        console.error("Firebase Connection Error:", error);
        setIsConnected(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (viewState === 'welcome') {
    return <Welcome onGetStarted={() => setViewState('auth')} />;
  }

  if (viewState === 'auth') {
    return <Auth onSuccess={() => setViewState('app')} />;
  }

  const popupStyles = {
    warning: { bg: 'bg-green-600', border: 'border-green-400', icon: AlertTriangle, title: 'تنبيه مروري' },
    closed: { bg: 'bg-red-600', border: 'border-red-400', icon: X, title: 'طريق مغلق' },
  } as const;

  const currentStyle = popupStyles[popupData.type];

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl">
      {/* Alert Popup Overlay */}
      {popupData.visible && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 pointer-events-none">
          <div
            className={`${currentStyle.bg} text-white p-6 rounded-2xl shadow-2xl max-w-lg w-[90%] pointer-events-auto border-4 ${currentStyle.border} relative animate-in slide-in-from-top-4 duration-500`}
          >
            <button
              onClick={() => {
                // Snooze ONLY this type for 30s (doesn’t permanently break logic)
                snoozeUntilRef.current[popupData.type] = Date.now() + SNOOZE_MS;
                setPopupData(prev => ({ ...prev, visible: false }));
              }}
              className="absolute top-2 left-2 p-1 bg-black/20 hover:bg-black/30 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center gap-3">
              <div className="bg-white p-3 rounded-full shadow-inner">
                <currentStyle.icon
                  className={`text-3xl ${
                    popupData.type === 'closed'
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                  size={32}
                />
              </div>

              <h3 className="text-2xl font-bold">{currentStyle.title}</h3>

              <p className="font-medium text-lg opacity-90 leading-relaxed">
                {popupData.message}
              </p>

              <div className="w-full bg-black/20 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-white/80 w-full animate-[shrink_30s_linear_forwards] origin-right"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar / Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${isConnected ? 'bg-green-600' : 'bg-indigo-600'}`}>
                {isConnected ? <Wifi className="text-white" size={24} /> : <Activity className="text-white" size={24} />}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 hidden sm:block">نظام إدارة المرور الذكي</h1>
                {isConnected && <span className="text-xs text-green-600 font-bold block sm:hidden">متصل بالسينسور</span>}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-4">
              {isConnected && (
                <span className="hidden md:flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200 animate-pulse">
                  <Wifi size={14} />
                  بيانات حية
                </span>
              )}

              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard size={18} />
                <span className="hidden sm:inline">لوحة التحكم</span>
              </button>

              <button
                onClick={() => setActiveTab('map')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'map'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <MapIcon size={18} />
                <span className="hidden sm:inline">الخريطة الحية</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard roads={roads} />}
        {activeTab === 'map' && <RealTimeMap roads={roads} />}
      </main>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
