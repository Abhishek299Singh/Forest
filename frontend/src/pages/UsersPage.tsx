import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Shield, ShieldCheck, ShieldAlert, CheckCircle, XCircle, KeyRound } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('pench123');
  const [newRole, setNewRole] = useState('ranger');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getUsers();
      setUsersList(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
    }
  }, [user]);

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-slate-100">Access Denied: Administrator Privileges Required</h2>
        <p className="text-xs text-slate-400">
          User account enrollment, role modification, and credential management are restricted to the Field Director (Admin).
        </p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await ApiClient.createUser({
        full_name: newFullName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setShowCreateModal(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('pench123');
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await ApiClient.updateUserStatus(userId, !currentStatus);
      loadUsers();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await ApiClient.updateUserRole(userId, newRole);
      loadUsers();
    } catch (err: any) {
      alert(`Role update failed: ${err.message}`);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#232834]">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Field Staff & User Access Control (RBAC)</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Enrolled Ranger and Administrator identities verified via Firebase Authentication & Local Wildlife DB.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium transition text-xs shadow"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Enroll New Ranger Account</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 rounded text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-[#141820] border border-[#232834] rounded overflow-hidden shadow">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#0f1218] border-b border-[#232834] text-[10px] text-slate-400 uppercase tracking-wider font-mono">
              <th className="py-2.5 px-3">Full Name</th>
              <th className="py-2.5 px-3">Email Address</th>
              <th className="py-2.5 px-3">System Role</th>
              <th className="py-2.5 px-3">Account Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232834]">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500 font-mono">
                  Loading field accounts...
                </td>
              </tr>
            ) : usersList.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500 font-mono">
                  No registered users found.
                </td>
              </tr>
            ) : (
              usersList.map((u) => {
                const isAdmin = u.role === 'admin';
                return (
                  <tr key={u.id} className="hover:bg-[#181d26] transition">
                    <td className="py-2.5 px-3 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          isAdmin ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-[#1b222c] text-emerald-300 border border-[#2a3444]'
                        }`}>
                          {u.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div>{u.full_name}</div>
                          {u.firebase_uid && (
                            <div className="text-[9px] font-mono text-slate-500">
                              UID: {u.firebase_uid.slice(0, 12)}...
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {u.email}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={u.id === user?.id}
                        className="bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2 py-0.5 text-xs font-mono focus:outline-none disabled:opacity-60 cursor-pointer"
                      >
                        <option value="admin">ADMIN</option>
                        <option value="ranger">RANGER</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          <XCircle className="w-3 h-3" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {u.id !== user?.id ? (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.is_active)}
                          className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
                            u.is_active
                              ? 'bg-[#231a1a] hover:bg-[#332020] text-rose-300 border-[#4a2626]'
                              : 'bg-[#16251b] hover:bg-[#1f3527] text-emerald-300 border-[#274833]'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 italic">
                          (Current Session)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Enroll Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141820] border border-[#2e3544] rounded max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#232834]">
              <h3 className="font-semibold text-slate-100 text-xs flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Enroll Ranger Account</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2 bg-rose-950 border border-rose-800 rounded text-rose-200 text-[11px]">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-mono mb-1">
                  Full Name & Designation
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Meshram (Turia Beat Ranger)"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-mono mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="ranger@pench.gov.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-mono mb-1">
                  Initial Password
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-mono mb-1">
                  Role Permission Level
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-[#181d26] border border-[#2a3140] text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ranger">RANGER (Field operations, SD card intake, GIS, Alerts)</option>
                  <option value="admin">ADMIN (Full access, User management, Settings, Policies)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-[#232834] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-[#1e232d] hover:bg-[#282e3c] text-slate-300 rounded border border-[#2e3544]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Enrolling...' : 'Enroll Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
