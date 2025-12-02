
import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Database, Save, Wifi, Server, Code } from 'lucide-react';

export const DatabaseConfig: React.FC = () => {
  const [dbUrl, setDbUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedUrl = localStorage.getItem('traffic_db_url');
    if (storedUrl) setDbUrl(storedUrl);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('traffic_db_url', dbUrl);
    setSaved(true);
    // Reload to apply firebase config
    setTimeout(() => {
       setSaved(false);
       window.location.reload();
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
            <Database size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">ربط قاعدة البيانات (ESP32)</h2>
            <p className="text-gray-500">إعداد الاتصال بـ Firebase لاستقبال بيانات السينسور</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">رابط قاعدة البيانات (Realtime DB URL)</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Server size={18} className="text-gray-400" />
              </div>
              <input
                type="url"
                required
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                placeholder="https://your-project-default-rtdb.firebaseio.com"
                className="block w-full pr-10 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-left"
                dir="ltr"
              />
            </div>
            <p className="text-xs text-gray-500">
              انسخ الرابط من Firebase Console &gt; Realtime Database
            </p>
          </div>

          {/* JSON Structure Hint */}
          <div className="bg-gray-900 text-gray-200 rounded-lg p-4 text-sm font-mono overflow-x-auto" dir="ltr">
            <div className="flex items-center gap-2 mb-2 text-gray-400 border-b border-gray-700 pb-2">
               <Code size={16} />
               <span>Firebase Data Structure (JSON)</span>
            </div>
            <pre>{`{
  "4": {  // ID for Wahat Road
    "currentVehicles": 120,
    "gateStatus": "closed", 
    "vocs": 45
  }
}`}</pre>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <strong>تنبيه هام:</strong> لتشغيل طريق الواحات، تأكد من أن الـ ESP32 يرسل البيانات تحت الـ ID رقم <code>"4"</code>.
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-200"
          >
            <Save size={20} />
            {saved ? 'تم الحفظ! جاري إعادة التحميل...' : 'حفظ واتصال'}
          </button>
        </form>
      </Card>
    </div>
  );
};
