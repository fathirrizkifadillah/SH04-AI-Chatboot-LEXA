import React from 'react';
import { Shield, ShieldAlert, User, MoreVertical, Plus } from 'lucide-react';

const Users = () => {
  // Mock data for presentation
  const users = [
    { id: 1, name: 'Budi Santoso', role: 'Super Admin', email: 'budi@lexatech.id', status: 'Online', lastActive: 'Sekarang' },
    { id: 2, name: 'Siti Aminah', role: 'CS Agent', email: 'siti@lexatech.id', status: 'Online', lastActive: 'Sekarang' },
    { id: 3, name: 'Andi Wijaya', role: 'CS Agent', email: 'andi@lexatech.id', status: 'Offline', lastActive: '2 jam yang lalu' },
    { id: 4, name: 'Rina Melati', role: 'Editor (Knowledge Base)', email: 'rina@lexatech.id', status: 'Offline', lastActive: 'Kemarin' },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users & Roles</h1>
          <p className="text-slate-500">Kelola akses tim ke Dashboard Lexa.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Tambah Anggota
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="px-6 py-4 font-medium">Nama Anggota</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Terakhir Aktif</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                        ${user.role === 'Super Admin' ? 'bg-indigo-500' : 
                          user.role === 'Editor (Knowledge Base)' ? 'bg-orange-500' : 'bg-blue-500'}`}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      {user.role === 'Super Admin' && <ShieldAlert className="w-4 h-4 text-indigo-500" />}
                      {user.role === 'CS Agent' && <User className="w-4 h-4 text-blue-500" />}
                      {user.role === 'Editor (Knowledge Base)' && <Shield className="w-4 h-4 text-orange-500" />}
                      {user.role}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${user.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Online' ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {user.lastActive}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm text-slate-500">
          <p>Menampilkan 4 anggota tim</p>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50" disabled>Sebelumnya</button>
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50" disabled>Selanjutnya</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
