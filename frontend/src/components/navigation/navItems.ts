import { useMemo } from 'react';
import {
  Activity,
  Bot,
  Cpu,
  Database,
  FileCheck,
  FileText,
  Fingerprint,
  GitFork,
  HeartPulse,
  Layers,
  LayoutGrid,
  Settings,
  Shield,
  ShieldAlert,
  Terminal,
  UserCheck,
  WifiOff,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useConsole } from '../../state/ConsoleContext';
import type { SidebarItem, SidebarSection } from './Sidebar';

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
    label: 'Console',
    items: [
      { path: '/overview', label: 'Overview', icon: LayoutGrid },
      { path: '/agent', label: 'AI Agent', icon: Bot },
      { path: '/rag', label: 'Local RAG', icon: Database },
    ],
  },
  {
    label: 'Security',
    items: [
      { path: '/policies', label: 'Policy Engine', icon: FileCheck },
      {
        path: '/approvals',
        label: 'Human Approval',
        icon: UserCheck,
        badge: { kind: 'count', source: 'approvals', tone: 'amber' },
      },
      {
        path: '/prompt-injection',
        label: 'Prompt Injection',
        icon: ShieldAlert,
        badge: { kind: 'count', source: 'threats', tone: 'red' },
      },
      {
        path: '/air-gap',
        label: 'Air-Gap Monitor',
        icon: WifiOff,
        badge: { kind: 'text', text: 'ISOLATED', tone: 'green' }, // green when isolated
      },
      {
        path: '/network',
        label: 'Network Monitor',
        icon: Activity,
      },
      { path: '/tool-permissions', label: 'Tool Permissions', icon: Wrench },
      { path: '/taint', label: 'Data Taint', icon: GitFork },
      { path: '/security-monitor', label: 'Security Harness', icon: Shield },
    ],
  },
  {
    label: 'Proof',
    items: [
      { path: '/audit', label: 'Audit Logs', icon: FileText },
      { path: '/integrity', label: 'SHA-256 Integrity', icon: Fingerprint },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { path: '/local-tools', label: 'Local Tools', icon: Terminal },
      {
        path: '/ollama',
        label: 'Ollama Engine',
        icon: Cpu,
        badge: { kind: 'text', text: 'ONLINE', tone: 'green' },
      },
      { path: '/architecture', label: 'Architecture', icon: Layers },
      { path: '/health', label: 'System Health', icon: HeartPulse },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const SIDEBAR_SETTINGS_ITEM: SidebarItem = {
  key: 'settings',
  label: 'Settings',
  icon: Settings,
  href: '/settings',
};

export type { SidebarBadge, SidebarItem, SidebarSection } from './Sidebar';

export function useSidebarSections(): SidebarSection[] {
  const { counts } = useConsole();

  return useMemo(
    () => [
      {
        label: 'Console',
        items: [
          { key: 'overview', label: 'Overview', icon: LayoutGrid, href: '/overview' },
          { key: 'agent', label: 'AI Agent', icon: Bot, href: '/agent' },
          { key: 'rag', label: 'Local RAG', icon: Database, href: '/rag' },
        ],
      },
      {
        label: 'Security',
        items: [
          { key: 'policies', label: 'Policy Engine', icon: FileCheck, href: '/policies' },
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
            key: 'prompt-injection',
            label: 'Prompt Injection',
            icon: ShieldAlert,
            href: '/prompt-injection',
            badge:
              counts.threats > 0
                ? { text: String(counts.threats), tone: 'danger' }
                : undefined,
          },
          {
            key: 'air-gap',
            label: 'Air-Gap Monitor',
            icon: WifiOff,
            href: '/air-gap',
            badge: { text: 'ISOLATED', tone: 'success' }, // green when isolated
          },
          {
            key: 'network',
            label: 'Network Monitor',
            icon: Activity,
            href: '/network',
          },
          {
            key: 'tool-permissions',
            label: 'Tool Permissions',
            icon: Wrench,
            href: '/tool-permissions',
          },
          { key: 'taint', label: 'Data Taint', icon: GitFork, href: '/taint' },
          {
            key: 'security-monitor',
            label: 'Security Harness',
            icon: Shield,
            href: '/security-monitor',
          },
        ],
      },
      {
        label: 'Proof',
        items: [
          { key: 'audit', label: 'Audit Logs', icon: FileText, href: '/audit' },
          { key: 'integrity', label: 'SHA-256 Integrity', icon: Fingerprint, href: '/integrity' },
        ],
      },
      {
        label: 'Advanced',
        items: [
          { key: 'local-tools', label: 'Local Tools', icon: Terminal, href: '/local-tools' },
          {
            key: 'ollama',
            label: 'Ollama Engine',
            icon: Cpu,
            href: '/ollama',
            badge: { text: 'ONLINE', tone: 'success' },
          },
          { key: 'architecture', label: 'Architecture', icon: Layers, href: '/architecture' },
          { key: 'health', label: 'System Health', icon: HeartPulse, href: '/health' },
        ],
      },
    ],
    [counts.pendingApprovals, counts.threats]
  );
}
