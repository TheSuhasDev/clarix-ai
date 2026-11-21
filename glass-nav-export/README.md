# Glass Navigation System — Component Export

A standalone, high-fidelity **frosted glass navigation suite** extracted from Clarix AI. This package contains the floating **Glass Sidebar** with collapsible accordion sub-navigation, the floating **Glass Pill Nav** for headers and landing pages, their SVG brand mark, and the complete design token system.

---

## 1. Exported Files & Descriptions

### Core Components (`components/` & `styles/`)
| File | Role & Description |
|---|---|
| `components/navigation/Sidebar.tsx` | **Floating Glass Sidebar**: Desktop navigation bar with collapsible state (240px expanded down to 76px icon-only rail), animated sliding glass highlight pill (`hlRef`), auto-expanding nested accordion groups (e.g. `/network/*` with sub-items), tooltips, and keyboard accessibility. |
| `components/navigation/Sidebar.module.css` | **Sidebar Styles**: Scoped CSS Module providing multi-layered frosted glass (`backdrop-filter: blur(28px) saturate(180%)`), delicate border gradients, glow shadows, sliding active indicator animations, and responsive layout. |
| `components/navigation/PillNav.tsx` | **Floating Glass Pill Nav**: Horizontal glass header pill bar with brand icon, navigation links, and animated status pill indicators. |
| `components/navigation/PillNav.module.css` | **Pill Nav Styles**: Scoped CSS Module styling horizontal glass container, pill tabs, status glow dots, and hover/active pill fills. |
| `components/navigation/navItems.ts` | **Navigation Configuration**: Type definitions (`SidebarItem`, `SidebarSection`), route paths, icons, section groupings, and dynamic hooks (`useSidebarSections`). |
| `components/common/ClarixMark.tsx` | **Brand Vector Logo**: Scalable inline SVG glyph with radial gradients and neon accents, utilized by both the sidebar and pill nav headers. |
| `styles/tokens.css` | **Glass Design Tokens**: CSS custom properties for glassmorphism backgrounds, borders, glows, shadows, typography, and status badges (Light & Dark themes). |

### Reference Implementations (`reference/`)
*These files are included for reading and reference to demonstrate how the navigation components wire into real pages and state providers:*
| File | Context & Reference Purpose |
|---|---|
| `reference/ConsoleContext.tsx` | Context provider managing sidebar collapse toggle state (`sidebarCollapsed`, `setSidebarCollapsed`) and badge counts. |
| `reference/AppShell.tsx` | Primary app layout shell illustrating how `<Sidebar />` is mounted alongside `<TopBar />` and `<Outlet />`. |
| `reference/Layout.module.css` | Layout CSS Module demonstrating content margin offset via the `--sidebar-w` variable (240px vs 76px). |
| `reference/Landing.tsx` | Landing page implementation mounting `<PillNav />` in `<header>` and `<Sidebar />` on the side. |
| `reference/landing.css` | Stylesheet demonstrating landing page layout with the floating glass navigation. |

---

## 2. Required NPM Dependencies

Ensure your React + Vite + TypeScript project has the following packages installed:

```bash
npm install react-router-dom lucide-react
```

| Package | Minimum Version | Usage |
|---|---|---|
| `react` | `^18.0.0` or `^19.0.0` | React core hooks (`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`) |
| `react-dom` | `^18.0.0` or `^19.0.0` | DOM rendering & portals (`createPortal` for tooltips) |
| `react-router-dom` | `^6.0.0` | Client-side routing (`Link`, `useLocation`, `useNavigate`) |
| `lucide-react` | `^0.460.0` | Modern UI icon set used throughout the navigation items |

---

## 3. Design Tokens & CSS Custom Properties

The components rely on CSS variables defined in `styles/tokens.css`. They provide seamless transitions between light and dark backgrounds.

### Glass Tokens (`--glass-*`)
| Variable | Description / Purpose | Light Theme Default | Dark Theme Default |
|---|---|---|---|
| `--glass-bg` | Container surface gradient | `linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))` | `rgba(255,255,255,0.07)` |
| `--glass-border` | Subtle translucent edge | `rgba(255, 255, 255, 0.55)` | `rgba(255, 255, 255, 0.20)` |
| `--glass-hover` | Row hover highlight fill | `rgba(255, 255, 255, 0.35)` | `rgba(255, 255, 255, 0.10)` |
| `--glass-active` | Active item background fill | `rgba(255, 255, 255, 0.55)` | `rgba(255, 255, 255, 0.20)` |
| `--glass-border-active` | Active item edge border | `rgba(255, 255, 255, 0.80)` | `rgba(255, 255, 255, 0.35)` |
| `--glass-text` | Primary navigation label color | `#0f2a3d` | `#eaf5f0` |
| `--glass-text-muted` | Secondary icon & label color | `#3b566a` | `#9bb5aa` |
| `--glass-text-active` | Selected item text color | `#071225` | `#ffffff` |
| `--glass-glow` | Brand accent neon color | `#10cfe0` | `#34d399` |
| `--glass-glow-shadow` | Accent glow shadow color | `rgba(16, 207, 224, 0.65)` | `rgba(52, 211, 153, 0.65)` |
| `--glass-shadow` | Outer drop & inner edge shadow | `0 18px 50px rgba(15,42,61,0.18), inset 0 1px 0 rgba(255,255,255,0.60)` | `0 18px 50px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.12)` |
| `--glass-hl-shadow` | Sliding pill active box shadow | `0 6px 20px rgba(15,42,61,0.08), inset 0 1px 0 rgba(255,255,255,0.80)` | `0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)` |

### Pill Nav Tokens (`--pill-*`)
| Variable | Description / Purpose | Light Theme Default | Dark Theme Default |
|---|---|---|---|
| `--pill-bg` | Horizontal pill background | `linear-gradient(135deg, rgba(255,255,255,0.40), rgba(255,255,255,0.16))` | `rgba(255, 255, 255, 0.08)` |
| `--pill-border` | Pill container border | `rgba(255, 255, 255, 0.65)` | `rgba(255, 255, 255, 0.22)` |
| `--pill-shadow` | Floating pill depth shadow | `0 12px 36px rgba(15,42,61,0.18), inset 0 1px 0 rgba(255,255,255,0.70)` | `0 12px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)` |
| `--pill-text` | Inactive pill text color | `#0f2a3d` | `#eaf5f0` |
| `--pill-text-hover` | Active/hover pill text color | `#071225` | `#ffffff` |
| `--pill-fill` | Active pill tab fill | `rgba(255, 255, 255, 0.75)` | `rgba(255, 255, 255, 0.22)` |
| `--pill-dot` | Pill status dot color | `#2563ff` | `#34d399` |

### Badge Tokens (`--badge-*`)
| Variant | Text (`--badge-*-text`) | Background (`--badge-*-bg`) | Border (`--badge-*-border`) | Dot (`--badge-*-dot`) |
|---|---|---|---|---|
| **danger** | `#d92f59` (light) / `#ff6b95` (dark) | `rgba(255, 94, 130, 0.16)` | `rgba(255, 94, 130, 0.45)` | `#ff4d86` |
| **success** | `#008a67` (light) / `#34d399` (dark) | `rgba(58, 213, 164, 0.18)` | `rgba(58, 213, 164, 0.45)` | `#34d399` |
| **warning** | `#a85b00` (light) / `#fbbf24` (dark) | `rgba(255, 181, 73, 0.20)` | `rgba(255, 181, 73, 0.50)` | `#f59e0b` |
| **info** | `#1b4fd8` (light) / `#60a5fa` (dark) | `rgba(65, 111, 255, 0.14)` | `rgba(65, 111, 255, 0.35)` | `#38bdf8` |

---

## 4. Integration Guide (Step-by-Step)

### Step 1: Copy Components & Tokens into Your Project
Place the files into your project's `src/` directory matching the export paths:
```
your-project/src/
├── components/
│   ├── common/
│   │   └── ClarixMark.tsx
│   └── navigation/
│       ├── navItems.ts
│       ├── PillNav.module.css
│       ├── PillNav.tsx
│       ├── Sidebar.module.css
│       └── Sidebar.tsx
└── styles/
    └── tokens.css
```

### Step 2: Import `tokens.css` Globally
In your `src/main.tsx` or `src/App.tsx`:
```tsx
import './styles/tokens.css';
```

### Step 3: Configure Your Routes in `navItems.ts`
Edit `src/components/navigation/navItems.ts` to reflect your application's route structure. For example:
```ts
import { Home, Shield, Activity, Settings } from 'lucide-react';
import type { SidebarSection } from './Sidebar';

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'Core Platform',
    items: [
      { key: 'home', label: 'Overview', href: '/overview', icon: Home },
      { key: 'security', label: 'Security', href: '/security', icon: Shield },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        key: 'network',
        label: 'Network',
        href: '/network/dashboard',
        icon: Activity,
        children: [
          { key: 'net-dash', label: 'Dashboard', href: '/network/dashboard' },
          { key: 'net-topo', label: 'Topology', href: '/network/topology' },
        ],
      },
    ],
  },
];

export const SIDEBAR_SETTINGS_ITEM = {
  key: 'settings',
  label: 'Settings',
  href: '/settings',
  icon: Settings,
};
```

### Step 4: Mount `<Sidebar />` in Your App Layout Shell
Wrap your application's routes with a layout component (see `reference/AppShell.tsx`):

```tsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './components/navigation/Sidebar';
import { SIDEBAR_SECTIONS, SIDEBAR_SETTINGS_ITEM } from './components/navigation/navItems';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        // Provide --sidebar-w so page content can dynamically adjust padding
        '--sidebar-w': collapsed ? '76px' : '240px',
      } as React.CSSProperties}
    >
      <Sidebar
        sections={SIDEBAR_SECTIONS}
        settingsItem={SIDEBAR_SETTINGS_ITEM}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      <main
        style={{
          flex: 1,
          paddingLeft: 'var(--sidebar-w)',
          transition: 'padding-left 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
```

### Step 5: Mount `<PillNav />` on Headers or Landing Pages
For top bars or hero sections (see `reference/Landing.tsx`):

```tsx
import { PillNav } from './components/navigation/PillNav';

export function Header() {
  return (
    <header style={{ position: 'sticky', top: '16px', zIndex: 100, display: 'flex', justifyContent: 'center' }}>
      <PillNav />
    </header>
  );
}
```
