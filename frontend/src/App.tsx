import { useState, useEffect, useCallback, useRef } from 'react';
import type { ClientWithProjects, TimeEntry } from './types';
import * as api from './api';
import { getDagenInMaand, getDagNaam, isWeekend, formatDatum, formatMaand, getMaandNaam, parseDecimal } from './utils';
import { useNavigate } from 'react-router-dom';
import AddModal from './components/AddModal';
import EditNameModal from './components/EditNameModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';

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



  // Add modal state
  const [addModal, setAddModal] = useState<{ type: 'client' | 'project' | 'subproject'; parentId?: number } | null>(null);
  // Edit modal state
  const [editModal, setEditModal] = useState<{ type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null>(null);
  // Delete confirm modal state
  const [deleteModal, setDeleteModal] = useState<{ type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null>(null);

  const navigate = useNavigate();

  const maandStr = formatMaand(jaar, maand);
  const dagen = getDagenInMaand(jaar, maand);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const clients = await api.getClients();
      const clientsWithProjects: ClientWithProjects[] = [];

      for (const client of clients) {
        const projects = await api.getProjects(client.id);
        const projectsWithSub = [];
        for (const project of projects) {
          const subprojects = await api.getSubprojects(project.id);
          projectsWithSub.push({ ...project, subprojects });
        }
        clientsWithProjects.push({ ...client, projects: projectsWithSub });
      }

      const timeEntries = await api.getTimeEntries(maandStr);
      const map: EntryMap = {};
      for (const te of timeEntries) {
        map[entryKey(te.subprojectId, te.datum)] = te;
      }

      setHierarchy(clientsWithProjects);
      setEntries(map);
    } catch (err) {
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
      // Scroll so today's column is roughly centered
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
      loadData();
    } catch (err) {
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
      loadData();
    } catch (err) {
      console.error('Fout bij bewerken:', err);
    }
  };

  const handleDeactivate = async (type: 'client' | 'project' | 'subproject', id: number) => {
    if (!confirm('Weet je zeker dat je dit wilt deactiveren?')) return;
    try {
      if (type === 'client') await api.deleteClient(id);
      else if (type === 'project') await api.deleteProject(id);
      else await api.deleteSubproject(id);
      loadData();
    } catch (err) {
      console.error('Fout bij deactiveren:', err);
    }
  };

  const handleReactivate = async (type: 'client' | 'project' | 'subproject', id: number) => {
    try {
      if (type === 'client') await api.updateClient(id, { actief: 1 } as any);
      else if (type === 'project') await api.updateProject(id, { actief: 1 } as any);
      else await api.updateSubproject(id, { actief: 1 } as any);
      loadData();
    } catch (err) {
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
      loadData();
    } catch (err) {
      console.error('Fout bij permanent verwijderen:', err);
    }
  };

  const formatNum = (n: number) => n === 0 ? '' : n % 1 === 0 ? n.toString() : parseFloat(n.toFixed(2)).toString();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500 text-lg">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Brand accent bar */}
      <div className="h-1" style={{ backgroundColor: '#0061FF' }} />

      {/* Header */}
      <header className="bg-white shadow-sm border-b no-print">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="FlowFee logo" className="h-8 w-8" />
            <h1 className="text-2xl font-bold" style={{ color: '#0061FF' }}>FlowFee</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/rapport')}
              className="px-4 py-2 text-base rounded hover:opacity-80 text-white"
              style={{ backgroundColor: '#0061FF' }}
            >
              Rapporten
            </button>
            <button
              onClick={() => navigate('/omzet')}
              className="px-4 py-2 text-base rounded hover:opacity-80 text-white"
              style={{ backgroundColor: '#0061FF' }}
            >
              Omzet
            </button>
          </div>
        </div>
      </header>

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
      <div className="overflow-x-auto" ref={scrollContainerRef}>
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="sticky left-0 z-10 bg-gray-100 text-left px-3 py-2 border-b border-r min-w-[320px] font-semibold text-gray-700">
                Datum
              </th>
              {dagen.map(dag => {
                const isToday = dag.getFullYear() === now.getFullYear() && dag.getMonth() === now.getMonth() && dag.getDate() === now.getDate();
                return (
                  <th
                    key={dag.getDate()}
                    ref={isToday ? todayRef : undefined}
                    className={`px-1.5 py-2 border-b text-center min-w-[58px] font-medium ${
                      isWeekend(dag) ? 'bg-gray-200 text-gray-500' : 'text-gray-700'
                    }${isToday ? ' ring-2 ring-inset' : ''}`}
                    style={isToday ? { boxShadow: 'inset 0 0 0 2px #0061FF' } : undefined}
                  >
                    <div>{dag.getDate()}</div>
                    <div className="text-xs">{getDagNaam(dag)}</div>
                  </th>
                );
              })}
              <th className="sticky right-0 z-10 px-3 py-2 border-b border-l text-center min-w-[72px] font-semibold text-gray-700 bg-gray-100">
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
    </div>
  );
}

// Extracted row rendering for clients
function ClientRows({
  client, clientCollapsed, collapsed, toggleCollapse,
  dagen, entries, clientTotal,
  getSubprojectTotal, getProjectTotal, handleSaveEntry,
  formatNum, setAddModal, setEditModal, handleDeactivate,
  handleReactivate, setDeleteModal,
}: {
  client: ClientWithProjects;
  clientCollapsed: boolean;
  collapsed: Record<string, boolean>;
  toggleCollapse: (key: string) => void;
  dagen: Date[];
  entries: EntryMap;
  clientTotal: number;
  getSubprojectTotal: (id: number, field: 'werkelijkeUren' | 'gefactureerdeUren') => number;
  getProjectTotal: (ids: number[]) => number;
  handleSaveEntry: (subprojectId: number, datum: string, field: 'werkelijkeUren' | 'gefactureerdeUren', value: number) => void;
  formatNum: (n: number) => string;
  setAddModal: (v: { type: 'client' | 'project' | 'subproject'; parentId?: number } | null) => void;
  setEditModal: (v: { type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null) => void;
  handleDeactivate: (type: 'client' | 'project' | 'subproject', id: number) => void;
  handleReactivate: (type: 'client' | 'project' | 'subproject', id: number) => void;
  setDeleteModal: (v: { type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null) => void;
}) {
  const clientKey = `c_${client.id}`;
  const inactive = !client.actief;

  return (
    <>
      {/* Client row */}
      <tr className={`border-b ${inactive ? 'opacity-40' : 'bg-blue-50 hover:bg-blue-100'}`}>
        <td className={`sticky left-0 z-10 px-3 py-2 border-r font-bold text-gray-800 ${inactive ? 'bg-gray-50' : 'bg-blue-50'}`}>
          <div className="flex items-center gap-1.5">
            <button onClick={() => toggleCollapse(clientKey)} className="w-5 text-gray-500 hover:text-gray-700">
              {clientCollapsed ? '▸' : '▾'}
            </button>
            <span
              className="cursor-pointer hover:underline"
              onClick={() => setEditModal({ type: 'client', id: client.id, naam: client.naam })}
            >
              {client.naam}
            </span>
            {!inactive && (
              <>
                <button
                  onClick={() => setAddModal({ type: 'project', parentId: client.id })}
                  className="ml-1 text-sm font-bold hover:opacity-70"
                  style={{ color: '#0061FF' }}
                  title="Project toevoegen"
                >+</button>
                <button
                  onClick={() => handleDeactivate('client', client.id)}
                  className="ml-1 text-orange-400 hover:text-orange-600 text-sm"
                  title="Client deactiveren"
                >⏸</button>
              </>
            )}
            {inactive && (
              <>
                <button
                  onClick={() => handleReactivate('client', client.id)}
                  className="ml-1 text-sm font-bold hover:opacity-70"
                  style={{ color: '#0061FF' }}
                  title="Client heractiveren"
                >▶</button>
                <button
                  onClick={() => setDeleteModal({ type: 'client', id: client.id, naam: client.naam })}
                  className="ml-1 text-red-400 hover:text-red-600 text-sm"
                  title="Client permanent verwijderen"
                >🗑</button>
              </>
            )}
          </div>
        </td>
        {dagen.map(dag => {
          let dayTotal = 0;
          for (const p of client.projects) {
            for (const s of p.subprojects) {
              const key = `${s.id}_${formatDatum(dag)}`;
              const entry = entries[key];
              if (entry) dayTotal += entry.gefactureerdeUren;
            }
          }
          return (
            <td key={dag.getDate()} className={`border-b px-1.5 py-2 text-center font-bold text-gray-700 ${isWeekend(dag) ? 'bg-gray-100' : ''}`}>
              {formatNum(dayTotal)}
            </td>
          );
        })}
        <td className={`sticky right-0 z-10 px-3 py-2 border-b border-l text-center font-bold text-gray-800 ${inactive ? 'bg-gray-50' : 'bg-blue-50'}`}>
          {formatNum(clientTotal)}
        </td>
      </tr>

      {!clientCollapsed && client.projects.map(project => {
        const projectKey = `p_${project.id}`;
        const projectCollapsed = collapsed[projectKey];
        const subIds = project.subprojects.map(s => s.id);
        const projectTotal = getProjectTotal(subIds);

        return (
          <ProjectRows
            key={project.id}
            project={project}
            projectCollapsed={projectCollapsed}
            clientInactive={inactive}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            dagen={dagen}
            entries={entries}
            projectTotal={projectTotal}
            getSubprojectTotal={getSubprojectTotal}
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
    </>
  );
}

// Extracted row rendering for projects
function ProjectRows({
  project, projectCollapsed, clientInactive, collapsed, toggleCollapse,
  dagen, entries, projectTotal,
  getSubprojectTotal, handleSaveEntry,
  formatNum, setAddModal, setEditModal, handleDeactivate,
  handleReactivate, setDeleteModal,
}: {
  project: ClientWithProjects['projects'][0];
  projectCollapsed: boolean;
  clientInactive: boolean;
  collapsed: Record<string, boolean>;
  toggleCollapse: (key: string) => void;
  dagen: Date[];
  entries: EntryMap;
  projectTotal: number;
  getSubprojectTotal: (id: number, field: 'werkelijkeUren' | 'gefactureerdeUren') => number;
  handleSaveEntry: (subprojectId: number, datum: string, field: 'werkelijkeUren' | 'gefactureerdeUren', value: number) => void;
  formatNum: (n: number) => string;
  setAddModal: (v: { type: 'client' | 'project' | 'subproject'; parentId?: number } | null) => void;
  setEditModal: (v: { type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null) => void;
  handleDeactivate: (type: 'client' | 'project' | 'subproject', id: number) => void;
  handleReactivate: (type: 'client' | 'project' | 'subproject', id: number) => void;
  setDeleteModal: (v: { type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null) => void;
}) {
  const projectKey = `p_${project.id}`;
  const inactive = !project.actief || clientInactive;
  const ownInactive = !project.actief;

  return (
    <>
      {/* Project row */}
      <tr className={`border-b ${inactive ? 'opacity-40' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}>
        <td className={`sticky left-0 z-10 px-3 py-2 border-r font-semibold text-gray-700 ${inactive ? 'bg-gray-50' : 'bg-indigo-50/50'}`}>
          <div className="flex items-center gap-1.5 pl-5">
            <button onClick={() => toggleCollapse(projectKey)} className="w-5 text-gray-500 hover:text-gray-700">
              {projectCollapsed ? '▸' : '▾'}
            </button>
            <span className="text-gray-400">└</span>
            <span
              className="cursor-pointer hover:underline"
              onClick={() => setEditModal({ type: 'project', id: project.id, naam: project.naam })}
            >
              {project.naam}
            </span>
            {!ownInactive && !clientInactive && (
              <>
                <button
                  onClick={() => setAddModal({ type: 'subproject', parentId: project.id })}
                  className="ml-1 text-sm font-bold hover:opacity-70"
                  style={{ color: '#0061FF' }}
                  title="Subproject toevoegen"
                >+</button>
                <button
                  onClick={() => handleDeactivate('project', project.id)}
                  className="ml-1 text-orange-400 hover:text-orange-600 text-sm"
                  title="Project deactiveren"
                >⏸</button>
              </>
            )}
            {ownInactive && (
              <>
                <button
                  onClick={() => handleReactivate('project', project.id)}
                  className="ml-1 text-sm font-bold hover:opacity-70"
                  style={{ color: '#0061FF' }}
                  title="Project heractiveren"
                >▶</button>
                <button
                  onClick={() => setDeleteModal({ type: 'project', id: project.id, naam: project.naam })}
                  className="ml-1 text-red-400 hover:text-red-600 text-sm"
                  title="Project permanent verwijderen"
                >🗑</button>
              </>
            )}
          </div>
        </td>
        {dagen.map(dag => {
          let dayTotal = 0;
          for (const s of project.subprojects) {
            const key = `${s.id}_${formatDatum(dag)}`;
            const entry = entries[key];
            if (entry) dayTotal += entry.gefactureerdeUren;
          }
          return (
            <td key={dag.getDate()} className={`border-b px-1.5 py-2 text-center font-semibold text-gray-600 ${isWeekend(dag) ? 'bg-gray-100' : ''}`}>
              {formatNum(dayTotal)}
            </td>
          );
        })}
        <td className={`sticky right-0 z-10 px-3 py-2 border-b border-l text-center font-semibold text-gray-700 ${inactive ? 'bg-gray-50' : 'bg-indigo-50'}`}>
          {formatNum(projectTotal)}
        </td>
      </tr>

      {!projectCollapsed && project.subprojects.map(sub => (
        <SubprojectRows
          key={sub.id}
          sub={sub}
          parentInactive={inactive}
          collapsed={collapsed}
          toggleCollapse={toggleCollapse}
          dagen={dagen}
          entries={entries}
          getSubprojectTotal={getSubprojectTotal}
          handleSaveEntry={handleSaveEntry}
          formatNum={formatNum}
          setEditModal={setEditModal}
          handleDeactivate={handleDeactivate}
          handleReactivate={handleReactivate}
          setDeleteModal={setDeleteModal}
        />
      ))}
    </>
  );
}

// Subproject rows with werkelijk/gefactureerd sub-rows
function SubprojectRows({
  sub, parentInactive, collapsed, toggleCollapse, dagen, entries, getSubprojectTotal, handleSaveEntry,
  formatNum, setEditModal, handleDeactivate, handleReactivate, setDeleteModal,
}: {
  sub: ClientWithProjects['projects'][0]['subprojects'][0];
  parentInactive: boolean;
  collapsed: Record<string, boolean>;
  toggleCollapse: (key: string) => void;
  dagen: Date[];
  entries: EntryMap;
  getSubprojectTotal: (id: number, field: 'werkelijkeUren' | 'gefactureerdeUren') => number;
  handleSaveEntry: (subprojectId: number, datum: string, field: 'werkelijkeUren' | 'gefactureerdeUren', value: number) => void;
  formatNum: (n: number) => string;
  setEditModal: (v: { type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null) => void;
  handleDeactivate: (type: 'client' | 'project' | 'subproject', id: number) => void;
  handleReactivate: (type: 'client' | 'project' | 'subproject', id: number) => void;
  setDeleteModal: (v: { type: 'client' | 'project' | 'subproject'; id: number; naam: string } | null) => void;
}) {
  const subKey = `s_${sub.id}`;
  const subCollapsed = collapsed[subKey];
  const werkelijkTotaal = getSubprojectTotal(sub.id, 'werkelijkeUren');
  const gefactureerdTotaal = getSubprojectTotal(sub.id, 'gefactureerdeUren');
  const inactive = !sub.actief || parentInactive;
  const ownInactive = !sub.actief;

  return (
    <>
      {/* Subproject header */}
      <tr className={`border-b ${inactive ? 'opacity-40' : 'bg-white hover:bg-gray-50'}`}>
        <td className={`sticky left-0 z-10 px-3 py-2 border-r text-gray-600 ${inactive ? 'bg-gray-50' : 'bg-white'}`} colSpan={1}>
          <div className="flex items-center gap-1.5 pl-12">
            <button onClick={() => toggleCollapse(subKey)} className="w-5 text-gray-500 hover:text-gray-700">
              {subCollapsed ? '▸' : '▾'}
            </button>
            <span className="text-gray-400">└</span>
            <span
              className="cursor-pointer hover:underline font-medium"
              onClick={() => setEditModal({ type: 'subproject', id: sub.id, naam: sub.naam })}
            >
              {sub.naam}
            </span>
            {!ownInactive && !parentInactive && (
              <button
                onClick={() => handleDeactivate('subproject', sub.id)}
                className="ml-1 text-orange-400 hover:text-orange-600 text-sm"
                title="Subproject deactiveren"
              >⏸</button>
            )}
            {ownInactive && (
              <>
                <button
                  onClick={() => handleReactivate('subproject', sub.id)}
                  className="ml-1 text-sm font-bold hover:opacity-70"
                  style={{ color: '#0061FF' }}
                  title="Subproject heractiveren"
                >▶</button>
                <button
                  onClick={() => setDeleteModal({ type: 'subproject', id: sub.id, naam: sub.naam })}
                  className="ml-1 text-red-400 hover:text-red-600 text-sm"
                  title="Subproject permanent verwijderen"
                >🗑</button>
              </>
            )}
          </div>
        </td>
        {dagen.map(dag => {
          const datum = formatDatum(dag);
          const key = `${sub.id}_${datum}`;
          const entry = entries[key];
          const dayTotal = entry ? entry.gefactureerdeUren : 0;
          return (
            <td key={dag.getDate()} className={`border-b px-1.5 py-2 text-center text-gray-500 ${isWeekend(dag) ? 'bg-gray-100' : ''}`}>
              {formatNum(dayTotal)}
            </td>
          );
        })}
        <td className={`sticky right-0 z-10 border-b border-l px-3 py-2 text-center font-medium text-gray-700 ${inactive ? 'bg-gray-50' : 'bg-white'}`}>
          {formatNum(gefactureerdTotaal)}
        </td>
      </tr>

      {!subCollapsed && <>
      {/* Werkelijke uren row */}
      <tr className="border-b bg-white">
        <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r text-xs text-gray-400 italic">
          <div className="pl-16">werkelijk</div>
        </td>
        {dagen.map(dag => {
          const datum = formatDatum(dag);
          const key = `${sub.id}_${datum}`;
          const value = entries[key]?.werkelijkeUren ?? 0;
          return (
            <CellInput
              key={dag.getDate()}
              value={value}
              isWeekend={isWeekend(dag)}
              onSave={(v) => handleSaveEntry(sub.id, datum, 'werkelijkeUren', v)}
            />
          );
        })}
        <td className="sticky right-0 z-10 bg-white px-3 py-1 border-b border-l text-center text-xs text-gray-500">
          {formatNum(werkelijkTotaal)}
        </td>
      </tr>

      {/* Gefactureerde uren row */}
      <tr className="border-b bg-white">
        <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r text-xs text-gray-400 italic">
          <div className="pl-16">gefactureerd</div>
        </td>
        {dagen.map(dag => {
          const datum = formatDatum(dag);
          const key = `${sub.id}_${datum}`;
          const value = entries[key]?.gefactureerdeUren ?? 0;
          return (
            <CellInput
              key={dag.getDate()}
              value={value}
              isWeekend={isWeekend(dag)}
              onSave={(v) => handleSaveEntry(sub.id, datum, 'gefactureerdeUren', v)}
            />
          );
        })}
        <td className="sticky right-0 z-10 bg-white px-3 py-1 border-b border-l text-center text-sm font-medium text-gray-700">
          {formatNum(gefactureerdTotaal)}
        </td>
      </tr>
      </>}
    </>
  );
}

// Inline cell editor
function CellInput({
  value, isWeekend: weekend, onSave
}: {
  value: number;
  isWeekend: boolean;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setText(value === 0 ? '' : String(value));
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const num = parseDecimal(text);
    if (num !== value) {
      onSave(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commit();
      // Move to next cell with Tab-like behavior
    } else if (e.key === 'Escape') {
      setEditing(false);
    } else if (e.key === 'Tab') {
      commit();
    }
  };

  if (editing) {
    return (
      <td className={`border-b p-0 ${weekend ? 'bg-gray-100' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full h-full px-1 py-1 text-center text-sm outline-none border rounded-sm"
          style={{ backgroundColor: '#e8f0ff', borderColor: '#0061FF' }}
          style={{ minWidth: '46px' }}
        />
      </td>
    );
  }

  return (
    <td
      className={`border-b px-1.5 py-1 text-center text-sm cursor-pointer hover:bg-[#e8f0ff] ${
        weekend ? 'bg-gray-100' : ''
      } ${value > 0 ? 'text-gray-800' : 'text-gray-300'}`}
      onClick={startEdit}
    >
      {value === 0 ? '' : value % 1 === 0 ? value.toString() : parseFloat(value.toFixed(2)).toString()}
    </td>
  );
}
