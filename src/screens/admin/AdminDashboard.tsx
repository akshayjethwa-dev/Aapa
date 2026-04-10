import React from 'react';
import { Users, Activity, TrendingUp, ShieldCheck } from 'lucide-react';

const AdminDashboard = () => {
  return (
    <div className="p-6 space-y-8 pb-24">
      <h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Users', value: '12,450', change: '+12%' },
          { label: 'Revenue', value: '₹4.2L', change: '+8%' },
          { label: 'Active Trades', value: '1,205', change: '+15%' },
          { label: 'KYC Pending', value: '45', change: '-5%' },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase">{stat.label}</p>
            <p className="text-xl font-bold mt-1">{stat.value}</p>
            <p className="text-[10px] font-bold text-emerald-500 mt-1">{stat.change}</p>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Recent KYC Requests</h3>
        {[1,2,3].map(i => (
          <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">JD</div>
              <div>
                <p className="text-xs font-bold">User #{1000 + i}</p>
                <p className="text-[10px] text-zinc-500">2 mins ago</p>
              </div>
            </div>
            <button className="text-[10px] font-bold text-emerald-500 uppercase">Approve</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;