import { useState, useEffect } from 'react';
import type { Cost, CostSummary } from '../types';
import * as api from '../api';
import { getMaandNaam } from '../utils';
import Layout from '../components/Layout';
import { showToast } from '../components/Toast';

const MAANDEN = Array.from({ length: 12 }, (_, i) => i);

export default function Costs() {
  const now = new Date();
  const [jaar, setJaar] = useState(now.getFullYear());
  const [costs, setCosts] = useState<Cost[]>([]);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);

  // Form state
  const [formOmschrijving, setFormOmschrijving] = useState('');
  const [formBedrag, setFormBedrag] = useState('');
  const [formType, setFormType] = useState<'eenmalig' | 'maandelijks'>('eenmalig');
  const [formDatum, setFormDatum] = useState(now.toISOString().substring(0, 10));

  const loadData = async () => {
    setLoading(true);
    try {
      const [costsData, summaryData] = await Promise.all([
        api.getCosts(jaar),
        api.getCostSummary(jaar),
      ]);
      setCosts(costsData);
      setSummary(summaryData);
    } catch (err) {
      showToast('Fout bij laden kosten', 'error');
      console.error('Fout bij laden kosten:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [jaar]);

  const resetForm = () => {
    setFormOmschrijving('');
    setFormBedrag('');
    setFormType('eenmalig');
    setFormDatum(now.toISOString().substring(0, 10));
    setEditingCost(null);
    setShowForm(false);
  };

  const startEdit = (cost: Cost) => {
    setFormOmschrijving(cost.omschrijving);
    setFormBedrag(String(cost.bedrag));
    setFormType(cost.type);
    setFormDatum(cost.datum);
    setEditingCost(cost);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bedrag = parseFloat(formBedrag.replace(',', '.'));
    if (!formOmschrijving || isNaN(bedrag) || bedrag <= 0) return;

    try {
      if (editingCost) {
        await api.updateCost(editingCost.id, {
          omschrijving: formOmschrijving,
          bedrag,
          type: formType,
          datum: formDatum,
        });
        showToast('Kost bijgewerkt', 'success');
      } else {
        await api.createCost({
          omschrijving: formOmschrijving,
          bedrag,
          type: formType,
          datum: formDatum,
        });
        showToast('Kost toegevoegd', 'success');
      }
      resetForm();
      loadData();
    } catch (err) {
      showToast('Fout bij opslaan kost', 'error');
      console.error('Fout bij opslaan kost:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Weet je zeker dat je deze kost wil verwijderen?')) return;
    try {
      await api.deleteCost(id);
      showToast('Kost verwijderd', 'success');
      loadData();
    } catch (err) {
      showToast('Fout bij verwijderen kost', 'error');
      console.error('Fout bij verwijderen kost:', err);
    }
  };

  const formatEuro = (bedrag: number) =>
    `€${parseFloat(bedrag.toFixed(2)).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const maandKey = (m: number) =>
    `${jaar}-${String(m + 1).padStart(2, '0')}`;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-6 overflow-auto flex-1">
        {/* Year selector + add button */}
        <div className="bg-white rounded-lg shadow p-4 flex items-end gap-4 flex-wrap no-print">
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
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 text-sm text-white rounded hover:opacity-80"
            style={{ backgroundColor: '#0061FF' }}
          >
            + Kost toevoegen
          </button>
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {editingCost ? 'Kost bewerken' : 'Nieuwe kost'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving</label>
                <input
                  type="text"
                  value={formOmschrijving}
                  onChange={e => setFormOmschrijving(e.target.value)}
                  className="border rounded px-3 py-2 text-sm w-full"
                  placeholder="bv. Adobe Creative Cloud"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrag (€)</label>
                <input
                  type="text"
                  value={formBedrag}
                  onChange={e => setFormBedrag(e.target.value)}
                  className="border rounded px-3 py-2 text-sm w-full"
                  placeholder="bv. 54,99"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value as 'eenmalig' | 'maandelijks')}
                  className="border rounded px-3 py-2 text-sm w-full"
                >
                  <option value="eenmalig">Eenmalig</option>
                  <option value="maandelijks">Maandelijks</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formType === 'maandelijks' ? 'Startdatum' : 'Datum'}
                </label>
                <input
                  type="date"
                  value={formDatum}
                  onChange={e => setFormDatum(e.target.value)}
                  className="border rounded px-3 py-2 text-sm w-full"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white rounded hover:opacity-80"
                  style={{ backgroundColor: '#0061FF' }}
                >
                  {editingCost ? 'Opslaan' : 'Toevoegen'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Annuleer
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Costs overview table per month */}
        {summary && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Overzicht {jaar}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-800">Type</th>
                    {MAANDEN.map(m => (
                      <th key={m} className="text-right py-2 px-2 font-semibold text-gray-800 whitespace-nowrap">
                        {getMaandNaam(m).substring(0, 3)}
                      </th>
                    ))}
                    <th className="text-right py-2 pl-4 font-bold text-gray-900">Jaar totaal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 font-medium text-gray-700">Eenmalig</td>
                    {MAANDEN.map(m => {
                      const val = summary.maanden[maandKey(m)]?.eenmalig || 0;
                      return (
                        <td key={m} className="text-right py-2 px-2 tabular-nums text-gray-600">
                          {val > 0 ? formatEuro(val) : '–'}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 pl-4 font-semibold tabular-nums text-gray-800">
                      {formatEuro(summary.jaarEenmalig)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 font-medium text-gray-700">Maandelijks</td>
                    {MAANDEN.map(m => {
                      const val = summary.maanden[maandKey(m)]?.maandelijks || 0;
                      return (
                        <td key={m} className="text-right py-2 px-2 tabular-nums text-gray-600">
                          {val > 0 ? formatEuro(val) : '–'}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 pl-4 font-semibold tabular-nums text-gray-800">
                      {formatEuro(summary.jaarMaandelijks)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-800">
                    <td className="py-2 pr-4 font-bold text-gray-900">Totaal</td>
                    {MAANDEN.map(m => {
                      const val = summary.maanden[maandKey(m)]?.totaal || 0;
                      return (
                        <td key={m} className="text-right py-2 px-2 font-bold tabular-nums text-gray-900">
                          {val > 0 ? formatEuro(val) : '–'}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 pl-4 font-bold tabular-nums text-gray-900 text-base">
                      {formatEuro(summary.jaarTotaal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Costs list */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Kosten {jaar}
          </h2>
          {loading ? (
            <p className="text-gray-400 italic">Laden...</p>
          ) : costs.length === 0 ? (
            <p className="text-gray-400 italic">Geen kosten gevonden voor {jaar}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-700">Omschrijving</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">Bedrag</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">Datum</th>
                    <th className="text-right py-2 pl-4 font-semibold text-gray-700 no-print">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map(cost => (
                    <tr key={cost.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-800">{cost.omschrijving}</td>
                      <td className="text-right py-2 px-4 tabular-nums text-gray-800">{formatEuro(cost.bedrag)}</td>
                      <td className="py-2 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          cost.type === 'maandelijks'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {cost.type === 'maandelijks' ? 'Maandelijks' : 'Eenmalig'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-gray-600">{cost.datum}</td>
                      <td className="text-right py-2 pl-4 no-print">
                        <button
                          onClick={() => startEdit(cost)}
                          className="text-blue-600 hover:text-blue-800 mr-3 text-xs"
                        >
                          Bewerk
                        </button>
                        <button
                          onClick={() => handleDelete(cost.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Verwijder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
