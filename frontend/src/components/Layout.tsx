import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Printer, Archive, Calendar, BarChart3, Cloud, Settings, Sun, Moon, ChevronLeft, ChevronRight, Keyboard, Github, GripVertical, ArrowUpCircle, type LucideIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface NavItem {
  id: string;
  to: string;
  icon: LucideIcon;
  label: string;
}

export const defaultNavItems: NavItem[] = [
  { id: 'printers', to: '/', icon: Printer, label: 'Printers' },
  { id: 'archives', to: '/archives', icon: Archive, label: 'Archives' },
  { id: 'queue', to: '/queue', icon: Calendar, label: 'Queue' },
  { id: 'stats', to: '/stats', icon: BarChart3, label: 'Statistics' },
  { id: 'profiles', to: '/profiles', icon: Cloud, label: 'Profiles' },
  { id: 'settings', to: '/settings', icon: Settings, label: 'Settings' },
];

// Get ordered nav items from localStorage
function getOrderedNavItems(): NavItem[] {
  const stored = localStorage.getItem('sidebarOrder');
  if (stored) {
    try {
      const order: string[] = JSON.parse(stored);
      const itemMap = new Map(defaultNavItems.map(item => [item.id, item]));
      const ordered: NavItem[] = [];
      for (const id of order) {
        const item = itemMap.get(id);
        if (item) {
          ordered.push(item);
          itemMap.delete(id);
        }
      }
      // Add any new items that weren't in the stored order
      for (const item of itemMap.values()) {
        ordered.push(item);
      }
      return ordered;
    } catch {
      return defaultNavItems;
    }
  }
  return defaultNavItems;
}

// Save nav item order to localStorage
function saveNavOrder(items: NavItem[]) {
  localStorage.setItem('sidebarOrder', JSON.stringify(items.map(i => i.id)));
}

// Get default view from localStorage
export function getDefaultView(): string {
  return localStorage.getItem('defaultView') || '/';
}

// Save default view to localStorage
export function setDefaultView(path: string) {
  localStorage.setItem('defaultView', path);
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const stored = localStorage.getItem('sidebarExpanded');
    return stored !== 'false';
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navItems, setNavItems] = useState<NavItem[]>(getOrderedNavItems);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const hasRedirected = useRef(false);

  // Check for updates
  const { data: versionInfo } = useQuery({
    queryKey: ['version'],
    queryFn: api.getVersion,
    staleTime: Infinity,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: updateCheck } = useQuery({
    queryKey: ['updateCheck'],
    queryFn: api.checkForUpdates,
    enabled: settings?.check_updates !== false,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 60 * 60 * 1000, // Check every hour
  });

  // Redirect to default view on initial load
  useEffect(() => {
    if (!hasRedirected.current && location.pathname === '/') {
      const defaultView = getDefaultView();
      if (defaultView !== '/') {
        hasRedirected.current = true;
        navigate(defaultView, { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    localStorage.setItem('sidebarExpanded', String(sidebarExpanded));
  }, [sidebarExpanded]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...navItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    setNavItems(newItems);
    saveNavOrder(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Global keyboard shortcuts for navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    // Ignore if typing in an input/textarea
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Number keys for navigation (1-6) - follows sidebar order
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= navItems.length) {
        e.preventDefault();
        navigate(navItems[keyNum - 1].to);
        return;
      }

      switch (e.key) {
        case '?':
          e.preventDefault();
          setShowShortcuts(true);
          break;
        case 'Escape':
          setShowShortcuts(false);
          break;
      }
    }
  }, [navigate, navItems]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`${sidebarExpanded ? 'w-64' : 'w-16'} bg-bambu-dark-secondary border-r border-bambu-dark-tertiary flex flex-col fixed inset-y-0 left-0 z-30 transition-all duration-300`}
      >
        {/* Logo */}
        <div className={`border-b border-bambu-dark-tertiary flex items-center justify-center ${sidebarExpanded ? 'p-4' : 'p-2'}`}>
          <img
            src={theme === 'dark' ? '/img/bambusy_logo_dark.png' : '/img/bambusy_logo_light.png'}
            alt="Bambusy"
            className={sidebarExpanded ? 'h-16 w-auto' : 'h-8 w-8 object-cover object-left'}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-2">
            {navItems.map(({ id, to, icon: Icon, label }, index) => (
              <li
                key={id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative ${
                  draggedIndex === index ? 'opacity-50' : ''
                } ${
                  dragOverIndex === index && draggedIndex !== index
                    ? 'before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-bambu-green'
                    : ''
                }`}
              >
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center ${sidebarExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-lg transition-colors group ${
                      isActive
                        ? 'bg-bambu-green text-white'
                        : 'text-bambu-gray-light hover:bg-bambu-dark-tertiary hover:text-white'
                    }`
                  }
                  title={!sidebarExpanded ? label : undefined}
                >
                  {sidebarExpanded && (
                    <GripVertical className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing -ml-1" />
                  )}
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarExpanded && <span>{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="p-2 mx-2 mb-2 rounded-lg hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray-light hover:text-white flex items-center justify-center"
          title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarExpanded ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </button>

        {/* Footer */}
        <div className="p-2 border-t border-bambu-dark-tertiary">
          {sidebarExpanded ? (
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-bambu-gray">v{versionInfo?.version || '...'}</span>
                {updateCheck?.update_available && (
                  <button
                    onClick={() => navigate('/settings')}
                    className="flex items-center gap-1 text-xs text-bambu-green hover:text-bambu-green/80 transition-colors"
                    title={`Update available: v${updateCheck.latest_version}`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>Update</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <a
                  href="https://github.com/maziggy/bambusy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray-light hover:text-white"
                  title="View on GitHub"
                >
                  <Github className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="p-2 rounded-lg hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray-light hover:text-white"
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray-light hover:text-white"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {updateCheck?.update_available && (
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 rounded-lg hover:bg-bambu-dark-tertiary transition-colors text-bambu-green hover:text-bambu-green/80"
                  title={`Update available: v${updateCheck.latest_version}`}
                >
                  <ArrowUpCircle className="w-5 h-5" />
                </button>
              )}
              <a
                href="https://github.com/maziggy/bambusy"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray-light hover:text-white"
                title="View on GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <button
                onClick={() => setShowShortcuts(true)}
                className="p-2 rounded-lg hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray-light hover:text-white"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="w-5 h-5" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray-light hover:text-white"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 bg-bambu-dark overflow-auto ${sidebarExpanded ? 'ml-64' : 'ml-16'} transition-all duration-300`}>
        <Outlet />
      </main>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} navItems={navItems} />}
    </div>
  );
}
