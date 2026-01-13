
import React from "react";
import { Card } from './ui/card';
import { AlertTriangle, Car, Wind, CheckCircle, XCircle, MapPin, Siren } from 'lucide-react';
import { Progress } from './ui/progress';
import { RoadData } from '../types';

interface DashboardProps {
  roads: RoadData[];
}

export function Dashboard({ roads }: DashboardProps) {
  const totalRoads = roads.length;
  const closedGates = roads.filter(r => r.gateStatus === 'closed').length;
  const openGates = roads.filter(r => r.gateStatus === 'open').length;
  const avgOccupancy = Math.round(
    roads.reduce((acc, r) => acc + (r.currentVehicles / r.capacity) * 100, 0) / totalRoads
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-700 text-sm font-medium">إجمالي الطرق</p>
              <p className="text-blue-900 mt-1 text-2xl font-bold">{totalRoads}</p>
            </div>
            <div className="bg-blue-600 p-3 rounded-lg shadow-sm">
              <Car className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-700 text-sm font-medium">بوابات مغلقة</p>
              <p className="text-red-900 mt-1 text-2xl font-bold">{closedGates}</p>
            </div>
            <div className="bg-red-600 p-3 rounded-lg shadow-sm">
              <XCircle className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-medium">بوابات مفتوحة</p>
              <p className="text-green-900 mt-1 text-2xl font-bold">{openGates}</p>
            </div>
            <div className="bg-green-600 p-3 rounded-lg shadow-sm">
              <CheckCircle className="text-white" size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-700 text-sm font-medium">متوسط الإشغال</p>
              <p className="text-yellow-900 mt-1 text-2xl font-bold">{avgOccupancy}%</p>
            </div>
            <div className="bg-yellow-600 p-3 rounded-lg shadow-sm">
              <AlertTriangle className="text-white" size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Roads List */}
      <Card className="p-6">
        <h2 className="text-gray-900 text-xl font-bold mb-6">حالة الطرق الحالية (Sensor Data)</h2>
        <div className="space-y-4">
          {roads.map((road) => {
            const occupancyPercent = (road.currentVehicles / road.capacity) * 100;
            const isEmergency = road.avgGreenTime && road.avgGreenTime < 20;
            const isHigh = occupancyPercent >= 80;
            const isMedium = occupancyPercent >= 60 && occupancyPercent < 80;

            return (
              <div
                key={road.id}
                className={`p-4 rounded-xl border-r-4 transition-all hover:shadow-md ${
                  isEmergency 
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                    : isHigh
                    ? 'bg-red-50 border-red-500'
                    : isMedium
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-green-50 border-green-500'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between mb-3 gap-2">
                  <div>
                    <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
                      {road.name}
                      {isEmergency && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded animate-pulse">إسعاف</span>}
                    </h3>
                    <p className="text-gray-600 text-sm flex items-center gap-1">
                      <MapPin size={14} />
                      {road.location}
                    </p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 w-fit ${
                      isEmergency
                        ? 'bg-blue-200 text-blue-900'
                        : road.gateStatus === 'open'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {isEmergency ? (
                       <>
                        <Siren size={16} className="animate-bounce" />
                        أولوية طوارئ
                       </>
                    ) : road.gateStatus === 'open' ? (
                      <>
                        <CheckCircle size={16} />
                        مفتوحة
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        مغلقة
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700 text-sm flex items-center gap-2">
                        <Car size={16} className="text-gray-500" />
                        عدد المركبات
                      </span>
                      <span className="text-gray-900 font-mono font-bold">
                        {road.currentVehicles} / {road.capacity}
                      </span>
                    </div>
                    <Progress
                      value={occupancyPercent}
                      className={`h-3 ${
                        isEmergency 
                          ? '[&>div]:bg-blue-600'
                          : isHigh
                          ? '[&>div]:bg-red-600'
                          : isMedium
                          ? '[&>div]:bg-yellow-600'
                          : '[&>div]:bg-green-600'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700 text-sm flex items-center gap-2">
                        <Wind size={16} className="text-gray-500" />
                        زمن الإشارة الخضراء (Green Time)
                      </span>
                      <span className={`font-mono font-bold ${isEmergency ? 'text-blue-600' : 'text-gray-900'}`}>
                        {road.avgGreenTime ?? 0}s
                      </span>
                    </div>
                    <Progress
                      value={(road.avgGreenTime || 0) * 2} // Assuming 50s max for viz
                      className={`h-3 ${
                         isEmergency ? '[&>div]:bg-blue-600' : '[&>div]:bg-green-600'
                      }`}
                    />
                  </div>
                </div>

                {isEmergency && (
                   <div className="bg-blue-100 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 flex items-start gap-2 shadow-sm">
                    <Siren size={18} className="shrink-0 mt-0.5" />
                    <span>
                      <strong>حالة طوارئ:</strong> تم فتح الإشارة بالكامل لتسهيل مرور سيارة الإسعاف.
                    </span>
                  </div>
                )}
                {!isEmergency && isHigh && (
                  <div className="bg-white border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2 shadow-sm">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <span>
                      <strong>تحذير:</strong> الطريق شبه ممتلئ - نظام الـ ESP32 يرسل إشارات لإغلاق البوابة القادمة.
                    </span>
                  </div>
                )}
                
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
