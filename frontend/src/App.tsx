import { useState, useEffect, useCallback, useRef } from 'react';
import type { ClientWithProjects, TimeEntry } from './types';
import * as api from './api';
import { getDagenInMaand, getDagNaam, isWeekend, formatDatum, formatMaand, getMaandNaam } from './utils';
import Layout from './components/Layout';
import AddModal from './components/AddModal';
import EditNameModal from './components/EditNameModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import ClientRows from './components/ClientRows';
import { showToast } from './components/Toast';

type EntryMap = Record<string, TimeEntry>;

function entryKey(subprojectId: number, datum: string) {
  return `${subprojectId}_${datum}`;
}

export default function App() {
  const now = new Date();
  const [jaar, setJaar] = useState(now.getFullYear());
  const [maand, setMaand] = useState(now.getMonth());
  const [hierarchy, setHierarchy] = useState<ClientWithProjects[]>([]);
  const [entries, setEntries] = useState<EntryMap>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLTableCellElement>(null);

  // Hourly rate
  const [uurtarief, setUurtarief] = useState<number>(35);
  const [editingRate, setEditingRate] = useState(false);
  const [rateText, setRateText] = useState('35');

  // Add modal state
  const [addModal, setAddModal] = useState<{ type: 'client' | 'project' | 'subproject'; parentId?: number } | null>(null);
  // Edit modal state
  const [editModal, setEditModal] = useState<{ type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null>(null);
  // Delete confirm modal state
  const [deleteModal, setDeleteModal] = useState<{ type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null>(null);

  const maandStr = formatMaand(jaar, maand);
  const dagen = getDagenInMaand(jaar, maand);

  // Load hourly rate once
  useEffect(() => {
    api.getUurtarief().then(data => {
      setUurtarief(data.uurtarief);
      setRateText(String(data.uurtarief));
    }).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getHierarchy(maandStr);

      const map: EntryMap = {};
      for (const te of data.entries) {
        map[entryKey(te.subprojectId, te.datum)] = te;
      }

      setHierarchy(data.hierarchy);
      setEntries(map);
    } catch (err) {
      showToast('Fout bij laden data. Controleer of de backend draait.', 'error');
      console.error('Fout bij laden data:', err);
    }
    setLoading(false);
  }, [maandStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-scroll to today's column after data loads
  useEffect(() => {
    if (!loading && todayRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cell = todayRef.current;
      const containerRect = container.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const scrollLeft = cell.offsetLeft - container.offsetLeft - containerRect.width / 2 + cellRect.width / 2;
      container.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [loading, maandStr]);

  const handleSaveEntry = async (
    subprojectId: number,
    datum: string,
    field: 'werkelijkeUren' | 'gefactureerdeUren',
    value: number
  ) => {
    const key = entryKey(subprojectId, datum);
    const existing = entries[key];
    const werkelijk = field === 'werkelijkeUren' ? value : (existing?.werkelijkeUren ?? 0);
    const gefactureerd = field === 'gefactureerdeUren' ? value : (existing?.gefactureerdeUren ?? 0);

    try {
      const result = await api.upsertTimeEntry({
        subprojectId,
        datum,
        werkelijkeUren: werkelijk,
        gefactureerdeUren: gefactureerd,
      });

      setEntries(prev => {
        const next = { ...prev };
        if ('deleted' in result) {
          delete next[key];
        } else {
          next[key] = result;
        }
        return next;
      });
    } catch (err) {
      showToast('Fout bij opslaan uren', 'error');
      console.error('Fout bij opslaan:', err);
    }
  };

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navigeerMaand = (delta: number) => {
    let newMaand = maand + delta;
    let newJaar = jaar;
    if (newMaand < 0) { newMaand = 11; newJaar--; }
    if (newMaand > 11) { newMaand = 0; newJaar++; }
    setMaand(newMaand);
    setJaar(newJaar);
  };

  // Calculate totals
  const getSubprojectTotal = (subprojectId: number, field: 'werkelijkeUren' | 'gefactureerdeUren') => {
    let total = 0;
    for (const dag of dagen) {
      const key = entryKey(subprojectId, formatDatum(dag));
      const entry = entries[key];
      if (entry) total += entry[field];
    }
    return total;
  };

  const getProjectTotal = (projectSubIds: number[]) => {
    let total = 0;
    for (const subId of projectSubIds) {
      total += getSubprojectTotal(subId, 'gefactureerdeUren');
    }
    return total;
  };

  const getClientTotal = (client: ClientWithProjects) => {
    let total = 0;
    for (const p of client.projects) {
      total += getProjectTotal(p.subprojects.map(s => s.id));
    }
    return total;
  };

  const handleAdd = async (naam: string) => {
    if (!addModal) return;
    try {
      if (addModal.type === 'client') {
        await api.createClient(naam);
      } else if (addModal.type === 'project') {
        await api.createProject(addModal.parentId!, naam);
      } else {
        await api.createSubproject(addModal.parentId!, naam);
      }
      setAddModal(null);
      showToast('Succesvol toegevoegd', 'success');
      loadData();
    } catch (err) {
      showToast('Fout bij toevoegen', 'error');
      console.error('Fout bij toevoegen:', err);
    }
  };

  const handleEdit = async (naam: string) => {
    if (!editModal) return;
    try {
      if (editModal.type === 'client') {
        await api.updateClient(editModal.id, { naam });
      } else if (editModal.type === 'project') {
        await api.updateProject(editModal.id, { naam });
      } else {
        await api.updateSubproject(editModal.id, { naam });
      }
      setEditModal(null);
      showToast('Naam bijgewerkt', 'success');
      loadData();
    } catch (err) {
      showToast('Fout bij bewerken', 'error');
      console.error('Fout bij bewerken:', err);
    }
  };

  const handleDeactivate = async (type: 'client' | 'project' | 'subproject', id: number) => {
    try {
      if (type === 'client') await api.deleteClient(id);
      else if (type === 'project') await api.deleteProject(id);
      else await api.deleteSubproject(id);
      showToast('Gedeactiveerd', 'success');
      loadData();
    } catch (err) {
      showToast('Fout bij deactiveren', 'error');
      console.error('Fout bij deactiveren:', err);
    }
  };

  const handleReactivate = async (type: 'client' | 'project' | 'subproject', id: number) => {
    try {
      if (type === 'client') await api.updateClient(id, { actief: 1 } as any);
      else if (type === 'project') await api.updateProject(id, { actief: 1 } as any);
      else await api.updateSubproject(id, { actief: 1 } as any);
      showToast('Heractiveerd', 'success');
      loadData();
    } catch (err) {
      showToast('Fout bij heractiveren', 'error');
      console.error('Fout bij heractiveren:', err);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteModal) return;
    try {
      if (deleteModal.type === 'client') await api.permanentDeleteClient(deleteModal.id);
      else if (deleteModal.type === 'project') await api.permanentDeleteProject(deleteModal.id);
      else await api.permanentDeleteSubproject(deleteModal.id);
      setDeleteModal(null);
      showToast('Permanent verwijderd', 'success');
      loadData();
    } catch (err) {
      showToast('Fout bij permanent verwijderen', 'error');
      console.error('Fout bij permanent verwijderen:', err);
    }
  };

  const handleRateSave = async () => {
    const num = parseFloat(rateText.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      showToast('Ongeldig uurtarief', 'error');
      setRateText(String(uurtarief));
      setEditingRate(false);
      return;
    }
    try {
      await api.updateUurtarief(num);
      setUurtarief(num);
      showToast('Uurtarief bijgewerkt', 'success');
    } catch (err) {
      showToast('Fout bij opslaan uurtarief', 'error');
    }
    setEditingRate(false);
  };

  const formatNum = (n: number) => n === 0 ? '' : n % 1 === 0 ? n.toString() : parseFloat(n.toFixed(2)).toString();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center flex-1">
          <div className="text-gray-500 text-lg">Laden...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Month navigation */}
      <div className="no-print bg-white border-b px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigeerMaand(-1)} className="px-3 py-1.5 rounded text-lg hover:opacity-70" style={{ color: '#0061FF' }}>&larr;</button>
        <span className="font-semibold text-gray-800 min-w-[200px] text-center text-lg">
          {getMaandNaam(maand)} {jaar}
        </span>
        <button onClick={() => navigeerMaand(1)} className="px-3 py-1.5 rounded text-lg hover:opacity-70" style={{ color: '#0061FF' }}>&rarr;</button>
        <button
          onClick={() => { setJaar(now.getFullYear()); setMaand(now.getMonth()); }}
          className="ml-2 px-3 py-1.5 text-sm rounded hover:opacity-80 text-white"
          style={{ backgroundColor: '#0061FF' }}
        >
          Vandaag
        </button>

        {/* Hourly rate */}
        <div className="ml-4 flex items-center gap-1.5 text-sm text-gray-500">
          <span>€</span>
          {editingRate ? (
            <input
              type="text"
              value={rateText}
              onChange={e => setRateText(e.target.value)}
              onBlur={handleRateSave}
              onKeyDown={e => { if (e.key === 'Enter') handleRateSave(); if (e.key === 'Escape') { setRateText(String(uurtarief)); setEditingRate(false); } }}
              className="w-16 border rounded px-1.5 py-0.5 text-sm text-center focus:outline-none focus:ring-1"
              style={{ borderColor: '#0061FF' }}
              autoFocus
            />
          ) : (
            <span
              className="cursor-pointer hover:underline tabular-nums"
              onClick={() => { setRateText(String(uurtarief)); setEditingRate(true); }}
              title="Klik om uurtarief te wijzigen"
            >
              {uurtarief}
            </span>
          )}
          <span>/uur</span>
        </div>

        <div className="ml-auto">
          <button
            onClick={() => setAddModal({ type: 'client' })}
            className="px-4 py-2 text-base text-white rounded hover:opacity-80"
            style={{ backgroundColor: '#0061FF' }}
          >
            + Client
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="sticky left-0 top-0 z-30 bg-gray-100 text-left px-3 py-2 border-b border-r min-w-[320px] font-semibold text-gray-700">
                Datum
              </th>
              {dagen.map(dag => {
                const isToday = dag.getFullYear() === now.getFullYear() && dag.getMonth() === now.getMonth() && dag.getDate() === now.getDate();
                return (
                  <th
                    key={dag.getDate()}
                    ref={isToday ? todayRef : undefined}
                    className={`sticky top-0 z-20 px-1.5 py-2 border-b text-center min-w-[58px] font-medium ${
                      isWeekend(dag) ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-700'
                    }${isToday ? ' ring-2 ring-inset' : ''}`}
                    style={isToday ? { boxShadow: 'inset 0 0 0 2px #0061FF' } : undefined}
                  >
                    <div>{dag.getDate()}</div>
                    <div className="text-xs">{getDagNaam(dag)}</div>
                  </th>
                );
              })}
              <th className="sticky right-0 top-0 z-30 px-3 py-2 border-b border-l text-center min-w-[72px] font-semibold text-gray-700 bg-gray-100">
                Totaal
              </th>
            </tr>
          </thead>
          <tbody>
            {hierarchy.length === 0 && (
              <tr>
                <td colSpan={dagen.length + 2} className="text-center py-8 text-gray-400">
                  Geen clients gevonden. Voeg een client toe om te beginnen.
                </td>
              </tr>
            )}
            {hierarchy.map(client => {
              const clientKey = `c_${client.id}`;
              const clientCollapsed = collapsed[clientKey];
              const clientTotal = getClientTotal(client);

              return (
                <ClientRows
                  key={client.id}
                  client={client}
                  clientCollapsed={clientCollapsed}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  dagen={dagen}
                  entries={entries}
                  clientTotal={clientTotal}
                  getSubprojectTotal={getSubprojectTotal}
                  getProjectTotal={getProjectTotal}
                  handleSaveEntry={handleSaveEntry}
                  formatNum={formatNum}
                  setAddModal={setAddModal}
                  setEditModal={setEditModal}
                  handleDeactivate={handleDeactivate}
                  handleReactivate={handleReactivate}
                  setDeleteModal={setDeleteModal}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {addModal && (
        <AddModal
          type={addModal.type}
          onSave={handleAdd}
          onClose={() => setAddModal(null)}
        />
      )}
      {editModal && (
        <EditNameModal
          type={editModal.type}
          currentName={editModal.naam}
          onSave={handleEdit}
          onClose={() => setEditModal(null)}
        />
      )}
      {deleteModal && (
        <DeleteConfirmModal
          type={deleteModal.type}
          naam={deleteModal.naam}
          onConfirm={handlePermanentDelete}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </Layout>
  );
}
