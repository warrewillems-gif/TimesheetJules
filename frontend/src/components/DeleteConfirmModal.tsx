import { useState } from 'react';

export default function DeleteConfirmModal({
  type,
  naam,
  onConfirm,
  onClose,
}: {
  type: 'client' | 'project' | 'subproject';
  naam: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const match = input.trim() === naam.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-red-700 mb-2">
          {type === 'client' ? 'Client' : type === 'project' ? 'Project' : 'Subproject'} permanent verwijderen
        </h3>
        <p className="text-sm text-gray-600 mb-1">
          Dit verwijdert <strong>{naam}</strong> en alle bijbehorende data permanent. Dit kan niet ongedaan worden gemaakt.
        </p>
        <p className="text-sm text-gray-600 mb-3">
          Typ <strong className="select-all">{naam}</strong> om te bevestigen:
        </p>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder={naam}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            disabled={!match}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Permanent verwijderen
          </button>
        </div>
      </div>
    </div>
  );
}
