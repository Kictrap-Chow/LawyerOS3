import React from 'react';
import { uuid } from '../utils';
import { Case } from '../types';
import { useI18n } from '../store/I18nContext';

interface CaseFormProps {
  onClose: () => void;
  onSave: (c: Case) => void;
}

export const CaseForm: React.FC<CaseFormProps> = ({ onClose, onSave }) => {
  const { t, lang } = useI18n();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const newCase: Case = {
      id: uuid(),
      name: formData.get('name') as string,
      type: formData.get('type') as any,
      status: 'active',
      clientContactName: '',
      clientContactInfo: '',
      specialProjectRemarks: '',
      clients: [],
      opponents: [],
      litigation: { proceedings: [] },
      tasks: [],
      logs: [],
      reminders: [],
      deadlines: []
    };

    if (newCase.type !== '专项法律服务' && newCase.type !== '常年法律顾问') {
      newCase.litigation.proceedings.push({
        id: uuid(),
        stageName: '一审',
        myRole: '原告',
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[400px] max-w-[95vw] max-h-[85vh] overflow-y-auto p-6 animate-fade-in">
        <h2 className="text-xl font-bold mb-4 text-[#37352f]">{t('case.create.title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('case.create.name')}</label>
            <input required name="name" className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 ring-blue-100 outline-none" placeholder="e.g. Contract Dispute v. Acme Corp" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('case.create.type')}</label>
            <select name="type" className="w-full border border-gray-300 rounded p-2 text-sm outline-none bg-white">
              <option value="诉讼">{t('case.type.litigation')}</option>
              <option value="仲裁">{t('case.type.arbitration')}</option>
              <option value="专项法律服务">{t('case.type.special')}</option>
              <option value="常年法律顾问">{t('case.type.retainer')}</option>
              <option value="争议解决">{t('case.type.dispute')}</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm hover:bg-gray-100 rounded text-gray-600">{t('actions.cancel')}</button>
            <button type="submit" className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800 shadow-sm">{t('actions.create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
