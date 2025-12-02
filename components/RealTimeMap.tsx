
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L, { Icon, DivIcon } from 'leaflet';
import { RoadData } from '../types';
import { Navigation, MapPin, AlertTriangle, Clock, Spline, Car, Loader2, Siren } from 'lucide-react';

// Destination Coordinates: Midan Al-Galaa (Near Tahrir)
const DESTINATION_COORDS: [number, number] = [30.0441, 31.2338]; 

// Component to handle map center changes
const RecenterMap = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

// Component to automatically fit map bounds to show all roads (October to Tahrir)
const FitBoundsToRoads = ({ roads }: { roads: RoadData[] }) => {
  const map = useMap();
  
  useEffect(() => {
    if (roads.length === 0) return;
    
    try {
      // Collect all points: Road centers, Road paths, and Destination
      const bounds = L.latLngBounds(roads.map(r => r.coordinates));
      
      roads.forEach(r => {
        if (r.path) {
          r.path.forEach(p => bounds.extend(p));
        }
      });
      
      bounds.extend(DESTINATION_COORDS);
      
      // Fit the map to these bounds with some padding
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (e) {
      console.warn("Bounds calculation error", e);
    }
  }, [roads, map]);
  
  return null;
};

// Routing Component handles the path calculation
const Routing = ({ 
  start, 
  end, 
  onRouteFound 
}: { 
  start: [number, number]; 
  end: [number, number];
  onRouteFound: (summary: any, coordinates: any[]) => void;
}) => {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

    useEffect(() => {
      if (!map || !start || !end) return;

      let intervalId: any = null;

      const initRouting = () => {
        // @ts-ignore
        const Leaflet: any = window.L;

        if (!Leaflet || !Leaflet.Routing) {
          console.warn("Waiting for Leaflet Routing Machine...");
          return false;
        }

        // Cleanup existing control
        if (routingControlRef.current) {
          try {
            map.removeControl(routingControlRef.current);
          } catch (e) {
            console.warn("Cleanup error", e);
          }
          routingControlRef.current = null;
        }

        try {
          const routingControl = Leaflet.Routing.control({
            waypoints: [
            Leaflet.latLng(start[0], start[1]),
            Leaflet.latLng(end[0], end[1])
          ],
          routeWhileDragging: false,
          addWaypoints: false, 
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          showAlternatives: true, // Show alternative routes
          lineOptions: {
            styles: [
                { color: 'black', opacity: 0.15, weight: 9 }, // Shadow
                { color: 'white', opacity: 0.8, weight: 6 }, // Outline
                { color: '#3b82f6', opacity: 1, weight: 5 }  // Main Line (Blue)
            ]
          },
          createMarker: function() { return null; } 
        });

        routingControl.addTo(map);
        routingControlRef.current = routingControl;

        routingControl.on('routesfound', function(e: any) {
          const routes = e.routes;
          if (routes && routes.length > 0) {
            // Take the primary route
            const summary = routes[0].summary;
            const coordinates = routes[0].coordinates;
            onRouteFound(summary, coordinates);
          }
        });

        return true;
      } catch (err) {
        console.error("Error initializing routing:", err);
        return false;
      }
    };

    if (!initRouting()) {
      intervalId = setInterval(() => {
        if (initRouting()) {
          clearInterval(intervalId);
        }
      }, 500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current);
        } catch (e) {
          console.warn("Unmount cleanup error", e);
        }
      }
    };
  }, [map, start, end, onRouteFound]);

  return null;
};

interface RealTimeMapProps {
  roads: RoadData[];
}

interface RouteInfo {
  distance: number; // in meters
  time: number; // in seconds
  trafficWarnings: string[];
}

export const RealTimeMap: React.FC<RealTimeMapProps> = ({ roads }) => {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  // Default Center: Will be overridden by FitBoundsToRoads, but good fallback
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.03, 31.05]); 
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    const d = R * c; 
    return d;
  };

  const handleRouteFound = (summary: any, coordinates: any[]) => {
    const warnings: string[] = [];
    
    // Check if route passes near any congested road
    const congestedRoads = roads.filter(r => (r.currentVehicles / r.capacity) >= 0.8);
    
    congestedRoads.forEach(road => {
        // Check a sample of points along the route
        const isNear = coordinates.some((coord: any, index: number) => {
            if (index % 50 !== 0) return false; // Optimize check
            const dist = getDistanceFromLatLonInKm(coord.lat, coord.lng, road.coordinates[0], road.coordinates[1]);
            return dist < 1.5; // Increased detection radius
        });

        if (isNear) {
            // Avoid duplicates
            if (!warnings.includes(`زحام شديد في ${road.name}`)) {
                warnings.push(`زحام شديد في ${road.name}`);
            }
        }
    });

    setRouteInfo({
        distance: summary.totalDistance,
        time: summary.totalTime,
        trafficWarnings: warnings
    });
  };

  const startNavigation = () => {
    setIsLoading(true);
    setRouteInfo(null);
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setMapCenter([latitude, longitude]);
          setIsNavigating(true);
          setIsLoading(false);
        },
        (error) => {
          console.error("Error:", error);
          alert("تعذر تحديد الموقع. سيتم افتراض أنك في ميدان الحصري - 6 أكتوبر للتجربة.");
          // Fallback: Hosary Mosque, 6th of October City
          const fakeLocation: [number, number] = [29.9737, 30.9468]; 
          setUserLocation(fakeLocation);
          setMapCenter(fakeLocation);
          setIsNavigating(true);
          setIsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert("المتصفح غير مدعوم.");
      setIsLoading(false);
    }
  };

  const destinationIcon = new Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const userIcon = new Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Calculate Traffic Status
  const getTrafficStatus = (road: RoadData) => {
      // Emergency Check First
      if (road.avgGreenTime && road.avgGreenTime > 20) {
         return { color: '#2563eb', text: 'طوارئ / إسعاف', type: 'emergency' }; // Blue
      }

      const occupancy = (road.currentVehicles / road.capacity) * 100;
      if (occupancy >= 80) return { color: '#dc2626', text: 'زحام شديد', type: 'high' }; // Red
      if (occupancy >= 50) return { color: '#d97706', text: 'بطيء', type: 'medium' }; // Amber
      return { color: '#16a34a', text: 'سالك', type: 'low' }; // Green
  };

  // Prediction Logic
  const getTrafficPrediction = (road: RoadData) => {
      if (road.avgGreenTime && road.avgGreenTime > 20) return "تم فتح الطريق لمرور الإسعاف";
      const occupancy = (road.currentVehicles / road.capacity) * 100;
      if (occupancy >= 80) return `توقع فك الزحام: ${Math.floor(Math.random() * 20 + 25)} دقيقة`;
      if (occupancy >= 50) return `توقع فك الزحام: ${Math.floor(Math.random() * 10 + 10)} دقائق`;
      return "الطريق سالك ومستقر";
  };

  return (
    <div className="space-y-4 h-full relative">
      {/* Control Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-indigo-600" />
            الملاحة من أكتوبر للتحرير
          </h2>
          <p className="text-sm text-gray-500">تحليل حالة المحور وكوبري أكتوبر والطرق البديلة</p>
        </div>
        <button
          onClick={startNavigation}
          disabled={isLoading}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-colors text-sm font-bold shadow-md ${
            isNavigating 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          } ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              جاري الاتصال بالأقمار الصناعية...
            </>
          ) : (
            <>
              <Navigation size={18} />
              {isNavigating ? 'تحديث المسار' : 'ابدأ الرحلة من موقعي'}
            </>
          )}
        </button>
      </div>

      <div className="h-[600px] w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner relative z-0">
        <MapContainer 
          center={mapCenter} 
          zoom={11} 
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Auto Fit Bounds on Load */}
          {!isNavigating && <FitBoundsToRoads roads={roads} />}
          
          {/* Recenter only when user explicitly asks for navigation/re-centering */}
          {isNavigating && <RecenterMap lat={mapCenter[0]} lng={mapCenter[1]} />}

          {/* User Location */}
          {userLocation && (
            <Marker position={userLocation} icon={userIcon}>
              <Popup>
                <div className="text-center">
                  <strong>نقطة الانطلاق</strong>
                  <br/>
                  موقعك الحالي (6 أكتوبر)
                </div>
              </Popup>
            </Marker>
          )}

          {/* Destination */}
          <Marker position={DESTINATION_COORDS} icon={destinationIcon}>
            <Popup>
                <div className="text-center">
                  <strong>الوجهة النهائية</strong><br/>
                  ميدان التحرير
                </div>
            </Popup>
          </Marker>

          {/* Routing Machine */}
          {isNavigating && userLocation && (
            <Routing 
                start={userLocation} 
                end={DESTINATION_COORDS} 
                onRouteFound={handleRouteFound}
            />
          )}

          {/* Road Lines (Google Maps Style) */}
          {roads.map((road) => {
             const { color, text, type } = getTrafficStatus(road);
             const prediction = getTrafficPrediction(road);
             
             // Create a custom DivIcon that looks like a Label
             const customIcon = new DivIcon({
                className: '',
                html: `
                    <div class="traffic-label ${type}">
                        <div class="status-dot"></div>
                        <div>${road.name}</div>
                    </div>
                `,
                iconSize: [120, 30],
                iconAnchor: [60, 15] 
             });

             return (
               <React.Fragment key={road.id}>
                    {/* The Traffic Line */}
                    <Polyline 
                        positions={road.path || [road.coordinates]}
                        pathOptions={{ color: color, weight: type === 'emergency' ? 12 : 10, opacity: 0.8, lineCap: 'round' }}
                    >
                         <Popup>
                            <div className="text-right" dir="rtl">
                               <strong className="block text-lg mb-1 flex items-center gap-2">
                                   <Car size={16} /> {road.name}
                               </strong>
                               <div className="mb-2">
                                   <span className={`text-xs font-bold px-2 py-1 rounded ${
                                       type === 'high' ? 'bg-red-100 text-red-700' : 
                                       type === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                                       type === 'emergency' ? 'bg-blue-100 text-blue-700' :
                                       'bg-green-100 text-green-700'
                                   }`}>
                                       {text}
                                   </span>
                               </div>
                               <p className="text-sm m-0 mb-2">الإشغال: {road.currentVehicles}/{road.capacity}</p>
                               {road.avgGreenTime && (
                                   <p className="text-xs text-gray-500 mb-2">زمن الإشارة الخضراء: {road.avgGreenTime}s</p>
                               )}
                               <div className="bg-gray-50 p-2 rounded border border-gray-100 text-xs text-gray-600 flex items-start gap-2">
                                   {type === 'emergency' ? <Siren size={14} className="mt-0.5 shrink-0 text-blue-600" /> : <Clock size={14} className="mt-0.5 shrink-0" />}
                                   {prediction}
                               </div>
                             </div>
                         </Popup>
                    </Polyline>

                    {/* The Label Marker (Centered on the road) */}
                    <Marker position={road.coordinates} icon={customIcon} />
               </React.Fragment>
             );
          })}
        </MapContainer>
        
        {/* Route Analysis Overlay */}
        {isNavigating && routeInfo && (
            <div className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white/95 backdrop-blur shadow-xl rounded-xl p-4 z-[1000] border border-gray-200 animate-fadeIn">
                <h3 className="font-bold text-gray-900 mb-3 border-b pb-2 flex items-center justify-between">
                    <span>تقرير الرحلة</span>
                    {routeInfo.trafficWarnings.length === 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">طريق أخضر</span>}
                </h3>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                        <Clock size={16} className="mx-auto mb-1 text-gray-500" />
                        <span className="block text-lg font-bold text-gray-800">
                            {Math.round(routeInfo.time / 60)}
                        </span>
                        <span className="text-xs text-gray-500">دقيقة</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                        <Spline size={16} className="mx-auto mb-1 text-gray-500" />
                        <span className="block text-lg font-bold text-gray-800">
                            {(routeInfo.distance / 1000).toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500">كم</span>
                    </div>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {routeInfo.trafficWarnings.length > 0 ? (
                        <>
                            <div className="text-xs text-gray-500 mb-1">المناطق المزدحمة:</div>
                            {routeInfo.trafficWarnings.map((warning, idx) => (
                                <div key={idx} className="flex items-start gap-2 bg-red-50 p-2 rounded text-red-700 text-xs font-medium border border-red-100">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <span>{warning}</span>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="flex items-center gap-2 bg-green-50 p-2 rounded text-green-700 text-xs font-medium border border-green-100">
                             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                             <span>جميع الطرق الرئيسية سالكة.</span>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
