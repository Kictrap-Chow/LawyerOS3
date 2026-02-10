import React from 'react';
import { nowISO, uuid } from '../utils';
import { Case } from '../types';
import { useI18n } from '../store/I18nContext';

interface CaseFormProps {
  onClose: () => void;
  onSave: (c: Case) => void;
}

export const CaseForm: React.FC<CaseFormProps> = ({ onClose, onSave }) => {
  const { t } = useI18n();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const newCase: Case = {
      id: uuid(),
      name: formData.get('name') as string,
      type: formData.get('type') as any,
      status: 'active',
      updatedAt: nowISO(),
      clientContactName: '',
      clientContactInfo: '',
      specialProjectRemarks: '',
      clients: [],
      opponents: [],
      litigation: { proceedings: [], propertyPreservations: [] },
      tasks: [],
      logs: [],
      reminders: [],
      deadlines: []
    };

    if (newCase.type !== '专项法律服务' && newCase.type !== '常年法律顾问') {
      newCase.litigation.proceedings.push({
        id: uuid(),
        stageName: '',
        myRole: '',
        caseNo: '',
        courtName: '',
        courtAddress: '',
        personnel: []
      });
    }

    onSave(newCase);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-3">
      <div className="bg-white/85 rounded-3xl shadow-xl border border-white w-[420px] max-w-[95vw] max-h-[85vh] overflow-y-auto p-6 animate-fade-in backdrop-blur-xl">
        <h2 className="text-xl font-bold mb-4 text-[#37352f]">{t('case.create.title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('case.create.name')}</label>
            <input required name="name" className="w-full border border-gray-200 bg-white/90 rounded-xl p-2.5 text-sm focus:ring-2 ring-[#e7d9ee] outline-none" placeholder="e.g. Contract Dispute v. Acme Corp" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('case.create.type')}</label>
            <select name="type" className="w-full border border-gray-200 bg-white/90 rounded-xl p-2.5 text-sm outline-none">
              <option value="诉讼">{t('case.type.litigation')}</option>
              <option value="仲裁">{t('case.type.arbitration')}</option>
              <option value="专项法律服务">{t('case.type.special')}</option>
              <option value="常年法律顾问">{t('case.type.retainer')}</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm hover:bg-gray-100 rounded text-gray-600">{t('actions.cancel')}</button>
            <button type="submit" className="px-4 py-2 text-sm accent-bg accent-bg-hover text-white rounded-xl shadow-sm">{t('actions.create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
