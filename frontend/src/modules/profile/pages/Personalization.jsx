import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiColorSwatch, HiTranslate, HiMoon, HiSun, HiDesktopComputer, HiCheckCircle } from 'react-icons/hi';
import useAuth from '../../../hooks/useAuth';
import { api } from '../../../services/api';

export default function Personalization() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [lang, setLang] = useState(i18n.language || 'en');
  const [theme, setTheme] = useState('system');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Sync state if i18n language changes elsewhere
  useEffect(() => {
    setLang(i18n.language);
  }, [i18n.language]);

  const handleSave = async () => {
    setLoading(true);
    setSuccess('');
    try {
      // 1. Update i18n locally if changed
      if (i18n.language !== lang) {
        await i18n.changeLanguage(lang);
      }

      // 2. Save to DB
      await api.profile.updateProfile({ 
        language: lang,
        // theme: theme // if backend supports theme persistence
      });

      // 3. Update localStorage user data to keep it in sync
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.language = lang;
      localStorage.setItem('user', JSON.stringify(storedUser));

      setSuccess(t('common.success'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save personalization:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-pink-600/10 border border-pink-500/20 flex items-center justify-center shadow-sm">
          <HiColorSwatch className="w-5 h-5 text-pink-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('personalization.title')}</h1>
          <p className="text-gray-500 text-sm">{t('personalization.desc')}</p>
        </div>
      </div>

      {success && (
        <div className="mb-6 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl animate-in slide-in-from-top-2">
          <HiCheckCircle className="text-xl" />
          <p className="text-sm font-bold">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
          <div className="flex items-center gap-3">
            <HiColorSwatch className="text-primary-500 text-xl" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{t('personalization.theme')}</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'light', label: t('common.light'), icon: <HiSun /> },
              { id: 'dark', label: t('common.dark'), icon: <HiMoon /> },
              { id: 'system', label: t('common.system'), icon: <HiDesktopComputer /> },
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

        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
          <div className="flex items-center gap-3">
            <HiTranslate className="text-indigo-500 text-xl" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{t('personalization.language')}</h2>
          </div>

          <div className="space-y-3">
            {[
              { id: 'en', label: t('personalization.lang_en'), desc: t('personalization.lang_en_desc') },
              { id: 'id', label: t('personalization.lang_id'), desc: t('personalization.lang_id_desc') },
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

      </div>

      <div className="mt-8 flex justify-end">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95 disabled:bg-gray-400 disabled:shadow-none"
        >
          {loading ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
