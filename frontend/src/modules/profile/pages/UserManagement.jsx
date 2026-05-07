import { useState, useEffect } from 'react';
import { HiUserAdd, HiPencil, HiTrash, HiSearch, HiBadgeCheck, HiBan, HiDotsHorizontal, HiExclamation, HiX, HiShieldCheck, HiUsers } from 'react-icons/hi';
import { api } from '../../../services/api';
import { useTranslation } from 'react-i18next';

export default function UserManagement() {
  const { t } = useTranslation();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    is_active: true
  });
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.admin.listUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: '', // Don't show password
        full_name: user.full_name || '',
        role: user.role,
        is_active: user.is_active
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'viewer',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      if (editingUser) {
        const response = await api.admin.updateUser(editingUser.id, formData);
        if (response.success) {
          setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData } : u));
          setIsModalOpen(false);
        }
      } else {
        const response = await api.admin.createUser(formData);
        if (response.success) {
          setUsers([...users, response.data]);
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const response = await api.admin.updateUser(user.id, { is_active: !user.is_active });
      if (response.success) {
        setUsers(users.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await api.admin.deleteUser(id);
      if (response.success) {
        setUsers(users.filter(u => u.id !== id));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shadow-sm">
            <HiUsers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('user_management.title')}</h1>
            <p className="text-gray-500 text-sm">{t('user_management.desc')}</p>
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-600/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <HiUserAdd className="text-lg" />
          {t('user_management.add_user')}
        </button>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-3 relative group h-14">
          <HiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors text-lg" />
          <input 
            type="text" 
            placeholder={t('user_management.search_placeholder')}
            className="w-full h-full bg-white border border-gray-100 rounded-2xl pl-14 pr-4 text-sm font-medium shadow-xl shadow-gray-200/40 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="h-14 bg-white border border-gray-100 rounded-2xl px-6 flex items-center justify-between shadow-xl shadow-gray-200/40">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('user_management.total_users')}</span>
          <span className="text-xl font-black text-gray-900">{filteredUsers.length}</span>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold text-gray-400 animate-pulse uppercase tracking-[0.2em]">Loading Registry...</p>
          </div>
        ) : error ? (
          <div className="py-20 flex flex-col items-center justify-center text-red-500 gap-3 px-4 text-center">
            <HiExclamation className="text-4xl" />
            <p className="font-bold">{error}</p>
            <button onClick={fetchUsers} className="text-xs font-black uppercase tracking-widest text-primary-600 hover:underline">Retry Connection</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">{t('user_management.user_identity')}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">{t('user_management.access_role')}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">{t('user_management.account_status')}</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm shadow-sm uppercase">
                          {user.full_name ? user.full_name.charAt(0) : user.username.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-none mb-1">{user.full_name || user.username}</p>
                          <p className="text-[11px] text-gray-500 font-medium">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        user.role === 'admin' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 
                        user.role === 'operator' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        'bg-slate-50 text-slate-600 border border-slate-100'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <button 
                        onClick={() => handleToggleStatus(user)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                          user.is_active 
                            ? 'text-green-600 hover:bg-green-50 bg-transparent' 
                            : 'text-gray-400 hover:bg-gray-100 bg-transparent'
                        }`}
                      >
                        {user.is_active ? <HiBadgeCheck className="text-lg" /> : <HiBan className="text-lg" />}
                        <span className="text-xs font-bold">{user.is_active ? t('common.active') : t('common.deactivated')}</span>
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenModal(user)}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all" 
                          title="Edit User"
                        >
                          <HiPencil className="text-lg" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                          title="Delete User"
                        >
                          <HiTrash className="text-lg" />
                        </button>
                        <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all">
                          <HiDotsHorizontal className="text-lg" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="px-8 py-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{editingUser ? t('user_management.edit_registry') : t('user_management.register_new')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Please fill in all the required credentials.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                <HiX className="text-xl text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('user_management.username')}</label>
                  <input 
                    type="text"
                    required
                    disabled={!!editingUser}
                    className="w-full bg-gray-50 border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none disabled:opacity-50"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('user_management.access_role')}</label>
                  <select 
                    className="w-full bg-gray-50 border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none appearance-none cursor-pointer"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="admin">{t('user_management.role_admin')}</option>
                    <option value="operator">{t('user_management.role_operator')}</option>
                    <option value="viewer">{t('user_management.role_viewer')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('user_management.full_name')}</label>
                <input 
                  type="text"
                  className="w-full bg-gray-50 border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('user_management.email')}</label>
                <input 
                  type="email"
                  required
                  className="w-full bg-gray-50 border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  {editingUser ? t('user_management.password_reset_hint') : t('user_management.password_hint')}
                </label>
                <input 
                  type="password" 
                  required={!editingUser}
                  className="w-full bg-gray-50 border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder={editingUser ? '••••••••' : ''}
                />
              </div>

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl text-sm font-bold transition-all active:scale-95"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={modalLoading}
                  className="flex-[2] px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {modalLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <HiShieldCheck className="text-lg" />}
                  {editingUser ? t('common.save') : t('user_management.add_user')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
