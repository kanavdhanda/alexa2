import { useAppStore } from '../../store/store';
import type { ActivePanel } from '../../types';

const TABS: { id: ActivePanel; label: string; icon: React.ReactNode }[] = [
  {
    id: 'anticipations',
    label: 'AI',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: 'alexa',
    label: 'Alexa',
    icon: (
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center"
        style={{
          background: 'conic-gradient(from 0deg, #005580, #00A8E0, #00CAFF, #0080B0, #005580)',
        }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#1A1A1A]" />
      </div>
    ),
  },
  {
    id: 'library',
    label: 'Library',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    id: 'inspector',
    label: 'Inspect',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    id: 'store',
    label: 'Store',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    ),
  },
  {
    id: 'backend',
    label: 'API',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
];

export function PanelTabs() {
  const { ui, setActivePanel, notifications } = useAppStore();
  const hasSelected = !!ui.selectedObjectId;
  const unreadNotifs = notifications.length;

  return (
    <div className="flex bg-[#1A1A1A] border-b border-[#383838] shrink-0">
      {TABS.map((tab) => {
        const isActive = ui.activePanel === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-all ${
              isActive
                ? 'text-[#00A8E0] bg-[#121212]'
                : 'text-[#8A8A8A] hover:text-white hover:bg-[#242424]'
            }`}
          >
            <span className={isActive ? 'text-[#00A8E0]' : 'text-[#8A8A8A]'}>{tab.icon}</span>
            <span className="uppercase tracking-wider">{tab.label}</span>

            {/* Active underline */}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#00A8E0] rounded-t" />
            )}

            {/* Badge: notification count on Alexa tab */}
            {tab.id === 'alexa' && unreadNotifs > 0 && !isActive && (
              <span className="absolute top-1.5 right-3 w-3.5 h-3.5 bg-[#F44336] rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}

            {/* Badge: selection indicator on Inspector tab */}
            {tab.id === 'inspector' && hasSelected && !isActive && (
              <span className="absolute top-1.5 right-3 w-2 h-2 bg-[#00A8E0] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
