import type { ClientWithProjects, TimeEntry } from '../types';
import { formatDatum, isWeekend } from '../utils';
import CellInput from './CellInput';

type EntryMap = Record<string, TimeEntry>;

export default function SubprojectRows({
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
