import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { Party } from '../types';
import { uuid } from '../utils';
import { Search, Plus, MapPin, CreditCard, Edit2, Trash2, X } from 'lucide-react';

export const PartyManager: React.FC = () => {
  const { parties, addParty, updateParty, deleteParty } = useData();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.idCode.includes(search)
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const newParty: Party = {
      id: editingParty ? editingParty.id : uuid(),
      name: formData.get('name') as string,
      type: formData.get('type') as any,
      idCode: formData.get('idCode') as string,
      address: formData.get('address') as string,
      note: formData.get('note') as string,
    };

    if (editingParty) updateParty(newParty);
    else addParty(newParty);
    
    setModalOpen(false);
    setEditingParty(null);
  };

  const openEdit = (p: Party) => {
    setEditingParty(p);
    setModalOpen(true);
  };

  const openNew = () => {
    setEditingParty(null);
    setModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6 h-full flex flex-col animate-fade-in">
      <div className="craft-surface p-4 md:p-6 mb-4 md:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-strong-theme">Parties Database</h1>
          <p className="text-slate-500 text-sm">Manage clients, opponents, and organizations.</p>
        </div>
        <button onClick={openNew} className="accent-bg accent-bg-hover text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm text-sm font-medium w-fit">
          <Plus size={16} /> New Party
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
        <input 
          className="w-full pl-10 pr-4 py-2.5 craft-input shadow-sm focus:outline-none focus:border-[#8a6d95] transition-colors"
          placeholder="Search by name, ID code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="craft-surface flex-1 overflow-hidden flex flex-col">
        <div className="hidden md:grid grid-cols-12 bg-[#f8fbff] border-b border-[#e1e8f2] px-4 py-2 text-xs font-semibold text-slate-500 uppercase">
          <div className="col-span-1 text-center">Type</div>
          <div className="col-span-4">Name</div>
          <div className="col-span-3">ID Code</div>
          <div className="col-span-3">Address</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        <div className="overflow-y-auto flex-1">
           {filteredParties.map(p => (
             <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 px-4 py-3 border-b border-[#edf2f7] hover:bg-white items-center text-sm group gap-2 md:gap-0">
               <div className="md:col-span-1 text-left md:text-center text-lg">{p.type === 'company' ? '🏢' : '👤'}</div>
               <div className="md:col-span-4 font-medium text-slate-800">{p.name}</div>
               <div className="md:hidden text-[11px] text-slate-500">
                 <span className="font-semibold text-slate-400 mr-1">ID:</span>{p.idCode || '-'}
               </div>
               <div className="md:hidden text-[11px] text-slate-500 truncate">
                 <span className="font-semibold text-slate-400 mr-1">Addr:</span>{p.address || '-'}
               </div>
               <div className="hidden md:block md:col-span-3 font-mono text-slate-500 text-xs">{p.idCode || '-'}</div>
               <div className="hidden md:block md:col-span-3 text-slate-500 text-xs truncate">{p.address || '-'}</div>
               <div className="md:col-span-1 flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                 <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-[#6b5a8b]"><Edit2 size={14}/></button>
                 <button onClick={() => { if(confirm('Delete?')) deleteParty(p.id) }} className="text-gray-400 hover:text-[#7a4f69]"><Trash2 size={14}/></button>
               </div>
             </div>
           ))}
           {filteredParties.length === 0 && <div className="p-8 text-center text-gray-400 italic">No parties found.</div>}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-3">
          <div className="bg-white/90 craft-surface w-[500px] max-w-[95vw] animate-fade-in p-6 relative">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-4">{editingParty ? 'Edit Party' : 'Create Party'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                <input required name="name" defaultValue={editingParty?.name} className="w-full craft-input p-2 text-sm outline-none focus:ring-2 ring-[#e7d9ee]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                   <select name="type" defaultValue={editingParty?.type || 'company'} className="w-full craft-input p-2 text-sm outline-none bg-white">
                     <option value="company">Company</option>
                     <option value="individual">Individual</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Code</label>
                   <input name="idCode" defaultValue={editingParty?.idCode} className="w-full craft-input p-2 text-sm outline-none focus:ring-2 ring-[#e7d9ee]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address</label>
                <input name="address" defaultValue={editingParty?.address} className="w-full craft-input p-2 text-sm outline-none focus:ring-2 ring-[#e7d9ee]" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded hover:bg-gray-100 text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 accent-bg accent-bg-hover text-white rounded-xl text-sm shadow-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
