import { useMemo } from 'react';
import {
  ActivitySquare,
  AlertOctagon,
  Bot,
  Cpu,
  Database,
  FileCheck,
  FileText,
  Fingerprint,
  GitFork,
  HeartPulse,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Network,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
  UserCheck,
  WifiOff,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useConsole } from '../../state/ConsoleContext';

export type NavBadge =
  | { kind: 'count'; source: 'threats'; tone: 'red' }
  | { kind: 'count'; source: 'approvals'; tone: 'amber' }
  | { kind: 'text'; text: string; tone: 'red' | 'green' };

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: NavBadge;
  children?: NavItem[];
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { path: '/overview', label: 'Overview', icon: LayoutGrid },
      { path: '/agent', label: 'AI Agent', icon: Bot },
      { path: '/security-monitor', label: 'Security Harness', icon: Shield },
      {
        path: '/prompt-injection',
        label: 'Prompt Injection',
        icon: ShieldAlert,
        badge: { kind: 'count', source: 'threats', tone: 'red' },
      },
      { path: '/taint', label: 'Data Taint', icon: GitFork },
      { path: '/policies', label: 'Policy Engine', icon: FileCheck },
      { path: '/tool-permissions', label: 'Tool Permissions', icon: Wrench },
      {
        path: '/approvals',
        label: 'Human Approval',
        icon: UserCheck,
        badge: { kind: 'count', source: 'approvals', tone: 'amber' },
      },
      {
        path: '/air-gap',
        label: 'Air-Gap Monitor',
        icon: WifiOff,
        badge: { kind: 'text', text: 'ISOLATED', tone: 'red' },
      },
      {
        path: '/network',
        label: 'Network',
        icon: Network,
        children: [
          { path: '/network/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/network/topology', label: 'Network Topology', icon: Network },
          { path: '/network/devices', label: 'Devices', icon: Server },
          { path: '/network/incidents', label: 'Incidents', icon: AlertOctagon },
          { path: '/network/investigation', label: 'AI Investigation', icon: Sparkles },
          { path: '/network/diagnostics', label: 'Diagnostics', icon: ActivitySquare },
          { path: '/network/settings', label: 'Network Settings', icon: Settings },
        ],
      },
      { path: '/rag', label: 'Local RAG', icon: Database },
      {
        path: '/ollama',
        label: 'Ollama Engine',
        icon: Cpu,
        badge: { kind: 'text', text: 'ONLINE', tone: 'green' },
      },
    ],
  },
  {
    label: 'Runtime & evidence',
    items: [
      { path: '/local-tools', label: 'Local Tools', icon: Terminal },
      { path: '/audit', label: 'Audit Logs', icon: FileText },
      { path: '/integrity', label: 'SHA-256 Integrity', icon: Fingerprint },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/architecture', label: 'Architecture', icon: Layers },
      { path: '/health', label: 'System Health', icon: HeartPulse },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((item) => [item, ...(item.children ?? [])])
);

export type { SidebarBadge, SidebarItem, SidebarSection } from './Sidebar';
import type { SidebarItem, SidebarSection } from './Sidebar';

export function useSidebarSections(): SidebarSection[] {
  const { counts } = useConsole();

  return useMemo(
    () => [
      {
        label: 'Workspace',
        items: [
          { key: 'overview', label: 'Overview', icon: LayoutGrid, href: '/overview' },
          { key: 'agent', label: 'AI Agent', icon: Bot, href: '/agent' },
          {
            key: 'security-monitor',
            label: 'Security Harness',
            icon: Shield,
            href: '/security-monitor',
          },
          {
            key: 'prompt-injection',
            label: 'Prompt Injection',
            icon: ShieldAlert,
            href: '/prompt-injection',
            badge:
              counts.threats > 0
                ? { text: String(counts.threats), tone: 'danger' }
                : undefined,
          },
          { key: 'taint', label: 'Data Taint', icon: GitFork, href: '/taint' },
          { key: 'policies', label: 'Policy Engine', icon: FileCheck, href: '/policies' },
          {
            key: 'tool-permissions',
            label: 'Tool Permissions',
            icon: Wrench,
            href: '/tool-permissions',
          },
          {
            key: 'approvals',
            label: 'Human Approval',
            icon: UserCheck,
            href: '/approvals',
            badge:
              counts.pendingApprovals > 0
                ? { text: String(counts.pendingApprovals), tone: 'warning' }
                : undefined,
          },
          {
            key: 'air-gap',
            label: 'Air-Gap Monitor',
            icon: WifiOff,
            href: '/air-gap',
            badge: { text: 'ISOLATED', tone: 'danger' },
          },
          {
            key: 'network',
            label: 'Network',
            icon: Network,
            href: '/network',
            children: [
              {
                key: 'network-dashboard',
                label: 'Dashboard',
                icon: LayoutDashboard,
                href: '/network/dashboard',
              },
              {
                key: 'network-topology',
                label: 'Network Topology',
                icon: Network,
                href: '/network/topology',
              },
              {
                key: 'network-devices',
                label: 'Devices',
                icon: Server,
                href: '/network/devices',
              },
              {
                key: 'network-incidents',
                label: 'Incidents',
                icon: AlertOctagon,
                href: '/network/incidents',
              },
              {
                key: 'network-investigation',
                label: 'AI Investigation',
                icon: Sparkles,
                href: '/network/investigation',
              },
              {
                key: 'network-diagnostics',
                label: 'Diagnostics',
                icon: ActivitySquare,
                href: '/network/diagnostics',
              },
              {
                key: 'network-settings',
                label: 'Network Settings',
                icon: Settings,
                href: '/network/settings',
              },
            ],
          },
          { key: 'rag', label: 'Local RAG', icon: Database, href: '/rag' },
          {
            key: 'ollama',
            label: 'Ollama Engine',
            icon: Cpu,
            href: '/ollama',
            badge: { text: 'ONLINE', tone: 'success' },
          },
        ],
      },
      {
        label: 'Runtime & evidence',
        items: [
          {
            key: 'local-tools',
            label: 'Local Tools',
            icon: Terminal,
            href: '/local-tools',
          },
          { key: 'audit', label: 'Audit Logs', icon: FileText, href: '/audit' },
          {
            key: 'integrity',
            label: 'SHA-256 Integrity',
            icon: Fingerprint,
            href: '/integrity',
          },
        ],
      },
      {
        label: 'System',
        items: [
          {
            key: 'architecture',
            label: 'Architecture',
            icon: Layers,
            href: '/architecture',
          },
          { key: 'health', label: 'System Health', icon: HeartPulse, href: '/health' },
        ],
      },
    ],
    [counts.threats, counts.pendingApprovals]
  );
}

export const SIDEBAR_SETTINGS_ITEM: SidebarItem = {
  key: 'settings',
  label: 'Settings',
  icon: Settings,
  href: '/settings',
};
