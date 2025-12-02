import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface AuthProps {
  onSuccess: () => void;
}

export function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock authentication delay
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-blue-50 to-white flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-200/40 rounded-full blur-3xl"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-white/50"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center relative overflow-hidden">
            {/* Glossy Effect */}
            <div className="absolute top-0 left-0 w-full h-full opacity-20">
                <div className="absolute right-10 top-[-20px] w-32 h-32 bg-white rounded-full blur-2xl"></div>
                <div className="absolute left-10 bottom-[-20px] w-24 h-24 bg-blue-400 rounded-full blur-xl"></div>
            </div>
            
          <h2 className="text-3xl font-bold text-white mb-2 relative z-10">
            {isLogin ? 'مرحباً بعودتك' : 'إنشاء حساب جديد'}
          </h2>
          <p className="text-blue-100 relative z-10">
            {isLogin ? 'سجل دخولك لمتابعة حالة الطرق' : 'انضم إلينا لتجربة قيادة أذكى'}
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">الاسم الكامل</label>
                <div className="relative group">
                  <User className="absolute right-3 top-3.5 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <Input placeholder="أدخل اسمك" className="pr-10" required />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">البريد الإلكتروني</label>
              <div className="relative group">
                <Mail className="absolute right-3 top-3.5 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <Input type="email" placeholder="example@email.com" className="pr-10" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">كلمة المرور</label>
              <div className="relative group">
                <Lock className="absolute right-3 top-3.5 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <Input type="password" placeholder="••••••••" className="pr-10" required />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-200" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب'}
                  <ArrowRight className="mr-2" size={18} />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="mr-2 text-indigo-600 font-bold hover:underline"
              >
                {isLogin ? 'سجل الآن' : 'سجل الدخول'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}