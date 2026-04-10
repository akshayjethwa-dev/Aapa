import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Activity, TrendingUp, ShieldCheck, FileText, AlertTriangle, Settings, Zap, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import AdminDashboard from './AdminDashboard';
import AISignals from './AISignals';

const AdminPanel = ({ onBack }: { onBack: () => void }) => {
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'whitelist' | 'users'>('whitelist');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ email: '', mobile: '', password: '', role: 'user' });
  const { token } = useAuthStore();

  const fetchWhitelist = async () => {
    try {
      const res = await fetch('/api/admin/whitelist', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWhitelist(data);
      }
    } catch (e) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchWhitelist();
    fetchUsers();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUserForm)
      });
      if (res.ok) {
        setNewUserForm({ email: '', mobile: '', password: '', role: 'user' });
        setShowCreateUser(false);
        fetchUsers();
        toast.success('User created successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create user');
      }
    } catch (e) {
      toast.error('Network error');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdentifier) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ identifier: newIdentifier })
      });
      if (res.ok) {
        setNewIdentifier('');
        fetchWhitelist();
        toast.success('User added to whitelist');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add user');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/whitelist/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchWhitelist();
        toast.success('User removed from whitelist');
      }
    } catch (e) {}
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        fetchUsers();
        toast.success(`User role updated to ${newRole}`);
      }
    } catch (e) {
      toast.error('Failed to update role');
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 space-y-8 pb-24">
      <div className="flex items-center gap-4 pt-10">
        <button onClick={onBack} className="p-3 rounded-2xl bg-zinc-900 text-zinc-400">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Admin Panel</h2>
      </div>

      {/* Admin Tabs */}
      <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800/50">
        <button 
          onClick={() => setActiveAdminTab('whitelist')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
            activeAdminTab === 'whitelist' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
          )}
        >
          Whitelist
        </button>
        <button 
          onClick={() => setActiveAdminTab('users')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
            activeAdminTab === 'users' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
          )}
        >
          Users
        </button>
      </div>

      <div className="space-y-6">
        {activeAdminTab === 'whitelist' ? (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Beta Whitelist Management</h3>
            <form onSubmit={handleAdd} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Email or Mobile" 
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="bg-emerald-500 text-black font-black px-6 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50"
              >
                Add
              </button>
            </form>
            
            <div className="space-y-2 pt-2">
              {whitelist.map(item => (
                <div key={item.id} className="bg-black/40 border border-zinc-800/30 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-white">{item.identifier}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Added: {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <LogOut size={16} className="rotate-90" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">User Management</h3>
              <button 
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
              >
                {showCreateUser ? 'Cancel' : 'Create User'}
              </button>
            </div>

            <AnimatePresence>
              {showCreateUser && (
                <motion.form 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleCreateUser}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="email" 
                      placeholder="Email" 
                      required
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Mobile" 
                      required
                      value={newUserForm.mobile}
                      onChange={(e) => setNewUserForm({...newUserForm, mobile: e.target.value})}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="password" 
                      placeholder="Password" 
                      required
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    />
                    <select 
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-emerald-500 text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all"
                  >
                    Create User Account
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="bg-black/40 border border-zinc-800/30 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-white">{u.email}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{u.mobile || 'No Mobile'}</p>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest",
                      u.role === 'admin' ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                    )}>
                      {u.role}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest">
                      Balance: <span className="text-white">₹{(u.balance || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2">
                      {u.role === 'user' ? (
                        <button 
                          onClick={() => handleUpdateRole(u.id, 'admin')}
                          className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:underline"
                        >
                          Make Admin
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUpdateRole(u.id, 'user')}
                          className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:underline"
                        >
                          Make User
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;