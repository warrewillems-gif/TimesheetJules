import { useState } from 'react';

const LABELS: Record<string, string> = {
  client: 'Client',
  project: 'Project',
  subproject: 'Subproject',
};

export default function AddModal({
  type,
  onSave,
  onClose,
  defaultUurtarief,
}: {
  type: 'client' | 'project' | 'subproject';
  onSave: (naam: string, uurtarief?: number) => void;
  onClose: () => void;
  defaultUurtarief?: number;
}) {
  const [naam, setNaam] = useState('');
  const [rateText, setRateText] = useState(String(defaultUurtarief ?? 35));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!naam.trim()) return;
    if (type === 'client') {
      const rate = parseFloat(rateText.replace(',', '.'));
      onSave(naam.trim(), isNaN(rate) || rate < 0 ? undefined : rate);
    } else {
      onSave(naam.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 min-w-[340px]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Nieuwe {LABELS[type]}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={naam}
            onChange={e => setNaam(e.target.value)}
            placeholder={`Naam van ${LABELS[type].toLowerCase()}`}
            className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#0061FF' } as React.CSSProperties}
            autoFocus
          />
          {type === 'client' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Uurtarief (€)</label>
              <input
                type="text"
                value={rateText}
                onChange={e => setRateText(e.target.value)}
                placeholder="Uurtarief"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#0061FF' } as React.CSSProperties}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Annuleren
            </button>
            <button
              type="submit"
              disabled={!naam.trim()}
              className="px-4 py-2 text-sm text-white rounded hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: '#0061FF' }}
            >
              Toevoegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
