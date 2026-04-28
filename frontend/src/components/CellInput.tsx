import { useState, useEffect, useRef } from 'react';
import { parseDecimal } from '../utils';

export default function CellInput({
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
          style={{ backgroundColor: '#e8f0ff', borderColor: '#0061FF', minWidth: '46px' }}
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
