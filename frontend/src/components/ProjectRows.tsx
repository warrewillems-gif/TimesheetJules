import type { ClientWithProjects, TimeEntry } from '../types';
import { formatDatum, isWeekend } from '../utils';
import SubprojectRows from './SubprojectRows';

type EntryMap = Record<string, TimeEntry>;

export default function ProjectRows({
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
      <tr className={`border-b ${inactive ? 'opacity-40' : 'bg-indigo-50 hover:bg-indigo-100'}`}>
        <td className={`sticky left-0 z-10 px-3 py-2 border-r font-semibold text-gray-700 ${inactive ? 'bg-gray-50' : 'bg-indigo-50'}`}>
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
