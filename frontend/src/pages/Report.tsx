import { useState, useEffect } from 'react';
import type { Client, ReportData } from '../types';
import * as api from '../api';
import { getMaandNaam, formatMaand } from '../utils';
import Layout from '../components/Layout';
import { showToast } from '../components/Toast';

export default function Report() {
  const now = new Date();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | ''>('');
  const [jaar, setJaar] = useState(now.getFullYear());
  const [maand, setMaand] = useState(now.getMonth());
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uurtarief, setUurtarief] = useState(35);

  useEffect(() => {
    api.getClients().then(setClients).catch(() => showToast('Fout bij laden clients', 'error'));
    api.getUurtarief().then(data => setUurtarief(data.uurtarief)).catch(() => {});
  }, []);

  const loadReport = async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const data = await api.getReport(Number(selectedClient), formatMaand(jaar, maand));
      setReport(data);
    } catch (err) {
      showToast('Fout bij laden rapport', 'error');
      console.error('Fout bij laden rapport:', err);
    }
    setLoading(false);
  };

  return (
    <Layout>
      {/* Filters */}
      <div className="no-print max-w-4xl mx-auto px-4 py-4 w-full">
        <div className="bg-white rounded-lg shadow p-4 flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value ? Number(e.target.value) : '')}
              className="border rounded px-3 py-2 text-sm min-w-[200px]"
            >
              <option value="">Selecteer client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.naam}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maand</label>
            <select
              value={maand}
              onChange={e => setMaand(Number(e.target.value))}
              className="border rounded px-3 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>{getMaandNaam(i)}</option>
              ))}
            </select>
          </div>
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
            onClick={loadReport}
            disabled={!selectedClient || loading}
            className="px-4 py-2 text-sm text-white rounded hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: '#0061FF' }}
          >
            {loading ? 'Laden...' : 'Bekijk rapport'}
          </button>
          {report && (
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
            >
              Printen
            </button>
          )}
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="max-w-4xl mx-auto px-4 py-4 overflow-auto flex-1">
          <div className="bg-white rounded-lg shadow p-8 print:shadow-none print:p-0">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              Rapport: {getMaandNaam(maand)} {jaar}
            </h2>
            <h3 className="text-lg text-gray-600 mb-6">{report.client.naam}</h3>

            <div className="border-t-2 border-gray-800 pt-4">
              {report.projecten.length === 0 ? (
                <p className="text-gray-400 italic">Geen gefactureerde uren voor deze periode.</p>
              ) : (
                <>
                  {report.projecten.map(project => {
                    const projectBedrag = parseFloat((project.totaal * uurtarief).toFixed(2));
                    return (
                      <div key={project.id} className="mb-4">
                        <div className="flex justify-between items-baseline py-1">
                          <span className="font-semibold text-gray-800">{project.naam}</span>
                          <span className="font-semibold text-gray-800 tabular-nums">
                            {parseFloat(project.totaal.toFixed(2))}u x €{uurtarief} = €{projectBedrag}
                          </span>
                        </div>
                        {project.subprojecten.map((sub, i) => {
                          const subBedrag = parseFloat((sub.totaal * uurtarief).toFixed(2));
                          return (
                            <div key={sub.id} className="flex justify-between items-baseline py-0.5 pl-6">
                              <span className="text-gray-600">
                                {i === project.subprojecten.length - 1 ? '└' : '├'} {sub.naam}
                              </span>
                              <span className="text-gray-600 tabular-nums">
                                {parseFloat(sub.totaal.toFixed(2))}u x €{uurtarief} = €{subBedrag}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  <div className="border-t-2 border-gray-800 mt-4 pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-gray-900 text-lg">
                      Totaal {report.client.naam}:
                    </span>
                    <span className="font-bold text-gray-900 text-lg tabular-nums">
                      {parseFloat(report.totaal.toFixed(2))}u x €{uurtarief} = €{parseFloat((report.totaal * uurtarief).toFixed(2))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
