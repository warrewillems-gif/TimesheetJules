import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RevenueData } from '../types';
import * as api from '../api';
import { getMaandNaam } from '../utils';

const UURTARIEF = 35;
const MAANDEN = Array.from({ length: 12 }, (_, i) => i);

export default function Revenue() {
  const navigate = useNavigate();
  const now = new Date();
  const [jaar, setJaar] = useState(now.getFullYear());
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await api.getRevenue(jaar);
      setData(result);
    } catch (err) {
      console.error('Fout bij laden omzet:', err);
    }
    setLoading(false);
  };

  // Helper: format maand key like "2026-03" to month index
  const maandKey = (m: number) =>
    `${jaar}-${String(m + 1).padStart(2, '0')}`;

  const formatEuro = (bedrag: number) =>
    `€${parseFloat(bedrag.toFixed(2)).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatUren = (uren: number) =>
    `${parseFloat(uren.toFixed(2))}u`;

  // Compute monthly totals across all clients
  const maandTotalen = MAANDEN.map(m => {
    if (!data) return 0;
    const key = maandKey(m);
    return data.clients.reduce((sum, c) => sum + (c.maanden[key] || 0), 0);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Omzetoverzicht</h1>
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 text-sm text-white rounded hover:opacity-80"
            style={{ backgroundColor: '#0061FF' }}
          >
            ← Terug
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="no-print max-w-6xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow p-4 flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jaar</label>
            <input
              type="number"
              value={jaar}
              onChange={e => setJaar(Number(e.target.value))}
              className="border rounded px-3 py-2 text-sm w-24"
            />
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 text-sm text-white rounded hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: '#0061FF' }}
          >
            {loading ? 'Laden...' : 'Bekijk overzicht'}
          </button>
          {data && (
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
            >
              Printen
            </button>
          )}
        </div>
      </div>

      {/* Revenue table */}
      {data && (
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="bg-white rounded-lg shadow p-8 print:shadow-none print:p-0">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              Omzetoverzicht {jaar}
            </h2>
            <p className="text-sm text-gray-500 mb-6">Uurtarief: €{UURTARIEF}/uur</p>

            {data.clients.length === 0 ? (
              <p className="text-gray-400 italic">Geen gefactureerde uren voor {jaar}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-800">
                      <th className="text-left py-2 pr-4 font-semibold text-gray-800">Client</th>
                      {MAANDEN.map(m => (
                        <th key={m} className="text-right py-2 px-2 font-semibold text-gray-800 whitespace-nowrap">
                          {getMaandNaam(m).substring(0, 3)}
                        </th>
                      ))}
                      <th className="text-right py-2 pl-4 font-bold text-gray-900">Jaar totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.map(client => (
                      <tr key={client.id} className="border-b border-gray-200">
                        <td className="py-2 pr-4 font-medium text-gray-700">{client.naam}</td>
                        {MAANDEN.map(m => {
                          const uren = client.maanden[maandKey(m)] || 0;
                          return (
                            <td key={m} className="text-right py-2 px-2 tabular-nums text-gray-600">
                              {uren > 0 ? formatEuro(uren * UURTARIEF) : '–'}
                            </td>
                          );
                        })}
                        <td className="text-right py-2 pl-4 font-semibold tabular-nums text-gray-800">
                          {formatEuro(client.totaalUren * UURTARIEF)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {/* Monthly uren totals row */}
                    <tr className="border-t border-gray-300">
                      <td className="py-1 pr-4 text-gray-500 font-medium">Uren</td>
                      {MAANDEN.map((m, i) => (
                        <td key={m} className="text-right py-1 px-2 tabular-nums text-gray-500">
                          {maandTotalen[i] > 0 ? formatUren(maandTotalen[i]) : '–'}
                        </td>
                      ))}
                      <td className="text-right py-1 pl-4 font-semibold tabular-nums text-gray-700">
                        {formatUren(data.totaalUren)}
                      </td>
                    </tr>
                    {/* Monthly revenue totals row */}
                    <tr className="border-t-2 border-gray-800">
                      <td className="py-2 pr-4 font-bold text-gray-900">Totaal</td>
                      {MAANDEN.map((m, i) => (
                        <td key={m} className="text-right py-2 px-2 font-bold tabular-nums text-gray-900">
                          {maandTotalen[i] > 0 ? formatEuro(maandTotalen[i] * UURTARIEF) : '–'}
                        </td>
                      ))}
                      <td className="text-right py-2 pl-4 font-bold tabular-nums text-gray-900 text-base">
                        {formatEuro(data.totaalUren * UURTARIEF)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
