import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Timesheet', path: '/' },
  { label: 'Rapporten', path: '/rapport' },
  { label: 'Omzet', path: '/omzet' },
  { label: 'Kosten', path: '/kosten' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Brand accent bar */}
      <div className="h-1" style={{ backgroundColor: '#0061FF' }} />

      {/* Header */}
      <header className="bg-white shadow-sm border-b no-print">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <img src="/logo.svg" alt="FlowFee logo" className="h-8 w-8" />
            <h1 className="text-2xl font-bold" style={{ color: '#0061FF' }}>FlowFee</h1>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`px-4 py-2 text-base rounded transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={active ? { backgroundColor: '#0061FF' } : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
