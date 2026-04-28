import type { ClientWithProjects, TimeEntry } from '../types';
import { formatDatum, isWeekend } from '../utils';
import ProjectRows from './ProjectRows';

type EntryMap = Record<string, TimeEntry>;

export default function ClientRows({
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
