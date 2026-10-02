import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Shield, ShieldAlert, User, Plus, Trash2, X, MessageSquare, Lock, KeyRound, Loader2, Check } from 'lucide-react';
import api from '../lib/apiClient';
import type { AdminUser, UserCreateRequest } from '../types/api';

const Users = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<UserCreateRequest>({
    name: '',
    email: '',
    password: '',
    role: 'CS Agent'
  });

  // State for Admin resetting user password
  const [selectedUserForPwd, setSelectedUserForPwd] = useState<AdminUser | null>(null);
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [pwdUserLoading, setPwdUserLoading] = useState(false);
  const [pwdUserError, setPwdUserError] = useState('');
  const [pwdUserSuccess, setPwdUserSuccess] = useState('');

  const currentUser = (() => {
    try {
      const u = sessionStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  const fetchUsers = () => {
    api.authGet<{ items: AdminUser[]; total: number }>('/api/admin/users?limit=100')
      .then(data => setUsers(data.items))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200 dark:border-red-900">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Akses Dibatasi</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          Halaman manajemen pengguna dan hak akses hanya dapat dibuka oleh <strong>Super Admin</strong>.
        </p>
      </div>
    );
  }

  const handleDelete = (id: number) => {
    if (window.confirm('Hapus pengguna ini dari sistem?')) {
      api.authDelete(`/api/admin/users/${id}`)
        .then(() => {
          fetchUsers();
        })
        .catch(err => {
          console.error(err);
          alert(err.message || 'Gagal menghapus pengguna.');
        });
    }
  };

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    api.authPost('/api/admin/users', formData)
    .then(() => {
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'CS Agent' });
      fetchUsers();
    })
    .catch(err => {
      console.error(err);
      alert(err.message || 'Gagal menambah pengguna.');
    });
  };

  const handleResetPasswordForUser = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUserForPwd) return;
    if (newPasswordForUser.length < 6) {
      setPwdUserError('Password minimal 6 karakter.');
      return;
    }
    setPwdUserLoading(true);
    setPwdUserError('');
    setPwdUserSuccess('');

    api.authPost(`/api/admin/users/${selectedUserForPwd.id}/change-password`, {
      new_password: newPasswordForUser
    })
    .then(() => {
      setPwdUserSuccess(`Password untuk ${selectedUserForPwd.name} berhasil diperbarui.`);
      setNewPasswordForUser('');
      setTimeout(() => {
        setSelectedUserForPwd(null);
        setPwdUserSuccess('');
      }, 1500);
    })
    .catch((err: any) => {
      setPwdUserError(err.message || 'Gagal mengubah password user.');
    })
    .finally(() => {
      setPwdUserLoading(false);
    });
  };

  return (
    <div className="p-6 max-w-6xl relative space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Users & Roles</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola kredensial tim dan hak akses pada Dashboard LEXA.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Anggota
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs">
                <th className="px-6 py-3.5 font-medium">Nama Anggota</th>
                <th className="px-6 py-3.5 font-medium">Role</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
                <th className="px-6 py-3.5 font-medium">Terakhir Aktif</th>
                <th className="px-6 py-3.5 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm
                        ${user.role === 'Super Admin' ? 'bg-indigo-600' : 
                          user.role === 'Editor (Knowledge Base)' ? 'bg-amber-600' : 'bg-blue-600'}`}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{user.name}</p>
                        <p className="text-[11px] text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {user.role === 'Super Admin' && <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />}
                      {user.role === 'CS Agent' && <User className="w-3.5 h-3.5 text-blue-500" />}
                      {user.role === 'Editor (Knowledge Base)' && <Shield className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{user.role}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {user.status || 'Online'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                    {user.last_active || 'Sekarang'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => {
                          setSelectedUserForPwd(user);
                          setNewPasswordForUser('');
                          setPwdUserError('');
                          setPwdUserSuccess('');
                        }} 
                        className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="Ganti Password User"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      {user.email === 'admin@lexatech.id' || user.id === 1 ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60"
                          title="Super Admin utama bersifat permanen dan tidak dapat dihapus."
                        >
                          <Lock className="w-3 h-3" />
                          <span>Permanen</span>
                        </span>
                      ) : currentUser?.email === user.email ? (
                        <span 
                          className="p-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                          title="Anda tidak dapat menghapus akun Anda sendiri"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleDelete(user.id)} 
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Hapus user"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-xs">Belum ada anggota tim terdaftar.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tambah Anggota Tim</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                <input required type="text" value={formData.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-blue-500" placeholder="e.g. Budi Santoso" />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input required type="email" value={formData.email} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-blue-500" placeholder="budi@lexatech.id" />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input required type="password" value={formData.password} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({...formData, password: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-blue-500" placeholder="Minimal 6 karakter" minLength={6} />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Role / Peran</label>
                <select value={formData.role} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({...formData, role: e.target.value as UserCreateRequest['role']})} className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-blue-500">
                  <option value="CS Agent">CS Agent (Balas Chat & Handoff)</option>
                  <option value="Editor (Knowledge Base)">Editor (Knowledge Base & Sync RAG)</option>
                  <option value="Super Admin">Super Admin (Akses Penuh)</option>
                </select>
              </div>
              <div className="pt-3 flex gap-2.5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 transition-colors">Simpan Pengguna</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ganti Password User (Super Admin) */}
      {selectedUserForPwd && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ganti Password User</h3>
                  <p className="text-[11px] text-slate-500">{selectedUserForPwd.name} ({selectedUserForPwd.email})</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUserForPwd(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordForUser} className="p-5 space-y-3.5 text-xs">
              {pwdUserError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
                  {pwdUserError}
                </div>
              )}
              {pwdUserSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {pwdUserSuccess}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password Baru untuk {selectedUserForPwd.name}
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={newPasswordForUser}
                  onChange={(e) => setNewPasswordForUser(e.target.value)}
                  placeholder="Ketik password baru (min 6 karakter)"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPwd(null)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pwdUserLoading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {pwdUserLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Perbarui Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;