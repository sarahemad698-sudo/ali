
import React, { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { RealTimeMap } from './components/RealTimeMap';
import { Welcome } from './components/Welcome';
import { Auth } from './components/Auth';
import { LayoutDashboard, Map as MapIcon, Activity, Wifi, Siren, X, AlertTriangle, CheckCircle } from 'lucide-react';
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
    currentVehicles: 180, // Very High traffic (Red)
    vocs: 85,
    gateStatus: 'open',
    location: 'اتجاه ميدان لبنان',
    coordinates: [30.0350, 31.0800], // Middle of Mehwar
    path: [
      [30.0074, 30.9733], // Juhayna Sq (October)
      [30.0300, 31.0200], // Near Sheikh Zayed
      [30.0500, 31.1300], // Ring Road Intersection
      [30.0550, 31.1800]  // Lebanon Square
    ],
    avgGreenTime: 10
  },
  {
    id: 2,
    name: 'شارع جامعة الدول العربية',
    capacity: 120,
    currentVehicles: 60, // Medium Traffic (Yellow)
    vocs: 45,
    gateStatus: 'open',
    location: 'المهندسين',
    coordinates: [30.0511, 31.2000],
    path: [
        [30.0550, 31.1800], // Lebanon Sq
        [30.0511, 31.2000], // Mostafa Mahmoud
        [30.0469, 31.2100]  // Sphinx Sq
    ],
    avgGreenTime: 15
  },
  {
    id: 3,
    name: 'كوبري 6 أكتوبر',
    capacity: 180,
    currentVehicles: 170, // High Traffic (Red)
    vocs: 92,
    gateStatus: 'closed',
    location: 'أعلى الزمالك',
    coordinates: [30.0469, 31.2290],
    path: [
        [30.0469, 31.2100], // Agouza ramp
        [30.0520, 31.2250], // Zamalek
        [30.0469, 31.2290], // Over Nile
        [30.0450, 31.2330]  // Tahrir Exit
    ],
    avgGreenTime: 12
  },
  {
    id: 4,
    name: 'طريق الواحات',
    capacity: 80,
    currentVehicles: 5, 
    vocs: 30,
    gateStatus: 'open',
    location: 'مدخل أكتوبر',
    coordinates: [29.9800, 31.0200],
    path: [
        [29.9600, 30.9400], // Dream Land area
        [29.9800, 31.0200], // Ring Road intersection
        [30.0000, 31.1000]  // Towards Pyramids
    ],
    avgGreenTime: 5
  },
  {
    id: 5,
    name: 'كوبري قصر النيل',
    capacity: 100,
    currentVehicles: 80, // Medium
    vocs: 50,
    gateStatus: 'open',
    location: 'وسط البلد',
    coordinates: [30.0435, 31.2285],
    path: [
        [30.0430, 31.2200], // Opera
        [30.0435, 31.2285], // Bridge
        [30.0444, 31.2357]  // Tahrir
    ],
    avgGreenTime: 10
  }
];

// HARDCODED FIREBASE URL
const FIREBASE_DB_URL = "https://traffic-c79be-default-rtdb.firebaseio.com/";

// Initialize Firebase App OUTSIDE the component to prevent re-initialization crashes
let db: any;
try {
  const app = initializeApp({
    databaseURL: FIREBASE_DB_URL
  });
  db = getDatabase(app);
} catch (e) {
  console.error("Firebase Initialization Error:", e);
}

// Helper to send system notifications
const sendSystemNotification = (title: string, body: string, tag: string) => {
  if (!('Notification' in window)) {
    console.log("This browser does not support desktop notification");
    return;
  }

  if (Notification.permission === 'granted') {
    const options = {
      body: body,
      icon: 'https://cdn-icons-png.flaticon.com/512/1032/1032989.png',
      tag: tag,
      renotify: true,
      requireInteraction: tag === 'ambulance' || tag === 'closed'
    };
    try {
       new Notification(title, options);
    } catch (e) {
       console.error("Notification Error", e);
    }
  }
};

export default function App() {
  const [viewState, setViewState] = useState<'welcome' | 'auth' | 'app'>('welcome');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map'>('dashboard');
  const [roads, setRoads] = useState<RoadData[]>(initialRoads);
  const [isConnected, setIsConnected] = useState(false);
  
  // Alert State
  const [popupData, setPopupData] = useState<{
    message: string;
    type: 'ambulance' | 'warning' | 'closed'; // Blue, Green, Red
    visible: boolean;
  }>({ message: '', type: 'warning', visible: false });

  // Refs to track previous states to avoid spamming
  const prevAmbulanceRef = useRef<boolean>(false);
  const prevWarningRef = useRef<boolean>(false); // For count >= 8
  const prevClosedRef = useRef<boolean>(false); // For count >= 10

  // Request Notification Permission
  useEffect(() => {
    if (viewState === 'app' && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, [viewState]);

  // Timer to auto-close popup
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (popupData.visible) {
      timer = setTimeout(() => {
        setPopupData(prev => ({ ...prev, visible: false }));
      }, 30000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [popupData.visible]);

  // Listen for Sensor Data
  useEffect(() => {
  if (!db) return;

  console.log("Listening to Firebase...");
  const roadsRef = ref(db, '/');

  const unsubscribe = onValue(roadsRef, (snapshot: any) => {
    const data = snapshot.val();

    if (data) {
      setIsConnected(true);
      
      setRoads(prevRoads =>
        prevRoads.map(road => {
            if (road.id === 4) {
                // Determine Data Structure (Flat or Nested)
                const roadData = data["4"] ? data["4"] : data;
                
                const avgGreen = Number(roadData.color?.avgGreen ?? roadData.avgGreen ?? road.avgGreenTime);
                const currentVehicles = Number(roadData.gate?.carCount ?? roadData.currentVehicles ?? roadData.Vehicles ?? road.currentVehicles);
                
                // --- LOGIC FOR ALERTS ---
                //freq
                //////////////////////
                const isEmergency = avgGreen > 20;
                /////////////////////////////
                let gateStatus = roadData.gate?.isClosed ? 'closed' : 'open';
                
                // 1. Ambulance Logic (Highest Priority)
                if (isEmergency) {
                    if (!popupData.visible || popupData.type !== 'ambulance') {
                         setPopupData({
                                          /////////////////////////////

                            message: "⚠️  تنبيه عاجل: رصد سيارة طوارئ على طريق الواحات برجاء سرعة اخلاء الحارة الوسطى!",
                                            /////////////////////////////

                            type: 'ambulance',
                            visible: true
                         });
                    }
                    if (!prevAmbulanceRef.current) {
                                      /////////////////////////////

                        sendSystemNotification("🚑 حالة طوارئ", "تم رصد سيارة إسعاف. تم فتح الإشارة.", "ambulance");
                                        /////////////////////////////

                    }
                } 
                // 2. Closed Logic (>= 10) - Red Alert
                else if (currentVehicles >= 10) {
                     gateStatus = 'closed'; // Force visual close
                     
                     if (!prevClosedRef.current) {
                         setPopupData({
                                          /////////////////////////////

                            message: "🚨  بطريق مغلق: لقد وصل الطريق للكثافة القصوى. سيتم إعادة الفتح بعد 15 دقيقة تقريبا.",
                                            /////////////////////////////

                            type: 'closed',
                            visible: true
                         });
                                         /////////////////////////////

                         sendSystemNotification("🛑 طريق مغلق", "طريق الواحات مزدحم جداً (10+ سيارات).", "closed");
                     }
                }
                // 3. Warning Logic (>= 8 but < 10) - Green/Yellow Alert
                else if (currentVehicles >= 8) {
                     if (!prevWarningRef.current) {
                         setPopupData({
                            message: "⚠️ تحذير: كثافة عالية سيتم غلق الطريق بعد 5 دقائق تقريبا.",
                            type: 'warning',
                            visible: true
                         });
                         sendSystemNotification("⚠️ تنبيه مروري", "طريق الواحات قرب يقفل (8 سيارات).", "warning");
                     }
                }
                else {
                    // Reset Logic if count drops below 8
                    // Only auto-close popup if it wasn't an emergency or closed alert
                    if (popupData.visible && popupData.type === 'warning' && currentVehicles < 8) {
                        setPopupData(prev => ({ ...prev, visible: false }));
                    }
                }

                // Update Refs to prevent spamming
                prevAmbulanceRef.current = isEmergency;
                // If it's closed (>=10), it's definitely not just a warning state anymore
                prevClosedRef.current = (currentVehicles >= 10);
                prevWarningRef.current = (currentVehicles >= 8 && currentVehicles < 10);

                // Handle Reopen Time (The 15 Minute Timer)
                let newReopenTime = road.reopenTime;
                if (currentVehicles >= 10 && !road.reopenTime) {
                    // Set timer for 15 minutes from NOW
                    newReopenTime = Date.now() + (15 * 60 * 1000); 
                } else if (currentVehicles < 10) {
                    // Reset timer if traffic clears normally
                    newReopenTime = undefined;
                }

                return {
                    ...road,
                    currentVehicles: currentVehicles,
                    gateStatus: gateStatus as 'open' | 'closed',
                    avgGreenTime: avgGreen,
                    reopenTime: newReopenTime,
                    sensors: roadData.sensors ?? road.sensors
                };
            }
            return road;
        })
      );
    }
  }, (error: any) => {
    console.error("Firebase Connection Error:", error);
    setIsConnected(false);
  });

  return () => unsubscribe();
}, [popupData]); 

  if (viewState === 'welcome') {
    return <Welcome onGetStarted={() => setViewState('auth')} />;
  }

  if (viewState === 'auth') {
    return <Auth onSuccess={() => setViewState('app')} />;
  }

  // Define Styles based on Alert Type
  const popupStyles = {
      ambulance: {
          bg: 'bg-blue-600', border: 'border-blue-400', icon: Siren, title: 'حالة طوارئ'
      },
      warning: {
          bg: 'bg-green-600', border: 'border-green-400', icon: AlertTriangle, title: 'تنبيه مروري' // Green as requested for warning
      },
      closed: {
          bg: 'bg-red-600', border: 'border-red-400', icon: X, title: 'طريق مغلق'
      }
  };

  const currentStyle = popupStyles[popupData.type];

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl">
      
      {/* Alert Popup Overlay */}
      {popupData.visible && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 pointer-events-none">
             <div className={`${currentStyle.bg} text-white p-6 rounded-2xl shadow-2xl max-w-lg w-[90%] pointer-events-auto border-4 ${currentStyle.border} relative animate-in slide-in-from-top-4 duration-500`}>
                
                <button 
                  onClick={() => setPopupData(prev => ({...prev, visible: false}))}
                  className="absolute top-2 left-2 p-1 bg-black/20 hover:bg-black/30 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center gap-3">
                  <div className="bg-white p-3 rounded-full shadow-inner">
                     <currentStyle.icon className={`text-3xl ${popupData.type === 'ambulance' ? 'text-blue-600 animate-pulse' : popupData.type === 'closed' ? 'text-red-600' : 'text-green-600'}`} size={32} />
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
      <nav className="bg-white border-b   border-gray-200 sticky top-0 z-50">
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
