import { useState } from 'react';
import { HiColorSwatch, HiTranslate, HiBell, HiMoon, HiSun, HiDesktopComputer } from 'react-icons/hi';

export default function Personalization() {
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('system');
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    alerts: false
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Personalization</h1>
        <p className="text-sm text-gray-500 mt-1">Tailor the dashboard experience to your preferences and workflow.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Appearance */}
        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
          <div className="flex items-center gap-3">
            <HiColorSwatch className="text-primary-500 text-xl" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Appearance</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'light', label: 'Light', icon: <HiSun /> },
              { id: 'dark', label: 'Dark', icon: <HiMoon /> },
              { id: 'system', label: 'System', icon: <HiDesktopComputer /> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                  theme === t.id 
                    ? 'border-primary-500 bg-primary-50 text-primary-700' 
                    : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200'
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Language */}
        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
          <div className="flex items-center gap-3">
            <HiTranslate className="text-indigo-500 text-xl" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Language</h2>
          </div>

          <div className="space-y-3">
            {[
              { id: 'en', label: 'English (US)', desc: 'Standard international version' },
              { id: 'id', label: 'Bahasa Indonesia', desc: 'Versi Bahasa Indonesia' },
            ].map((l) => (
              <button
                key={l.id}
                onClick={() => setLang(l.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                  lang === l.id 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900' 
                    : 'border-gray-50 bg-gray-50 text-gray-700 hover:border-gray-200'
                }`}
              >
                <div>
                  <p className="text-sm font-bold">{l.label}</p>
                  <p className="text-[10px] opacity-60 font-medium">{l.desc}</p>
                </div>
                {lang === l.id && <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
              </button>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="md:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
          <div className="flex items-center gap-3">
            <HiBell className="text-amber-500 text-xl" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Notification Preferences</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.keys(notifications).map((key) => (
              <div key={key} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-sm font-bold text-gray-900 capitalize">{key} Alerts</p>
                  <p className="text-[10px] text-gray-500">Enable system {key}</p>
                </div>
                <div 
                  onClick={() => setNotifications({...notifications, [key]: !notifications[key]})}
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
                    notifications[key] ? 'bg-primary-500' : 'bg-gray-200'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${
                    notifications[key] ? 'left-7' : 'left-1'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 flex justify-end">
        <button className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95">
          Save Preferences
        </button>
      </div>
    </div>
  );
}
