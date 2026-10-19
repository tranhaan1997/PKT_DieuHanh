import React from 'react';
import {
  Dashboard, CellTower, Build, CalendarMonth, Assignment, TravelExplore, Calculate, ManageHistory, Apps,
  SettingsInputAntennaOutlined, PeopleOutlined, ManageSearch, ListAltOutlined, SettingsOutlined, MenuBookOutlined,
  AssessmentOutlined, HistoryOutlined, ManageHistoryOutlined, CalculateOutlined,
} from '@mui/icons-material';

/**
 * Navigation config — single source cho sidebar (desktop), bottom nav và bảng "Thêm" (mobile).
 */

export interface NavItem { label: string; path: string; icon: React.ReactNode; exact?: boolean; adminOnly?: boolean; roles?: string[]; }
export interface NavGroup { label: string; adminOnly?: boolean; items: NavItem[]; }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'TỔNG QUAN',
    items: [
      { label: 'Dashboard', path: '/', icon: <Dashboard />, exact: true },
    ],
  },
  {
    label: 'DANH MỤC',
    items: [
      { label: 'Danh mục TTKV', path: '/admin/ttkvs', icon: <SettingsInputAntennaOutlined />, roles: ['ADMIN', 'SUPERVISOR'] },
      { label: 'Danh mục trạm', path: '/sites', icon: <CellTower /> },
      { label: 'Giải pháp', path: '/solutions', icon: <Build /> },
    ],
  },
  {
    label: 'VẬT TƯ',
    items: [
      { label: 'Phiếu vật tư', path: '/manager-orders', icon: <ListAltOutlined /> },
    ],
  },
  {
    label: 'QUẢN LÝ',
    items: [
      { label: 'Tra cứu trạm', path: '/lookup', icon: <ManageSearch /> },
      { label: 'Phiếu thi công', path: '/work-orders', icon: <Assignment /> },
      { label: 'Kỳ thực hiện', path: '/periods', icon: <CalendarMonth /> },
    ],
  },
  {
    label: 'CÔNG CỤ',
    items: [
      { label: 'Tính toán kỹ thuật', path: '/calculators', icon: <CalculateOutlined /> },
    ],
  },
  {
    label: 'BÁO CÁO',
    items: [
      { label: 'Báo cáo', path: '/reports', icon: <AssessmentOutlined />, roles: ['ADMIN', 'SUPERVISOR', 'VIEWER'] },
    ],
  },
  {
    label: 'QUẢN TRỊ',
    adminOnly: true,
    items: [
      { label: 'Người dùng', path: '/users', icon: <PeopleOutlined />, adminOnly: true },
      { label: 'Cài đặt hệ thống', path: '/admin/settings', icon: <SettingsOutlined />, adminOnly: true },
    ],
  },
];

export const TECH_NAV_GROUPS: NavGroup[] = [
  {
    label: 'CÔNG VIỆC',
    items: [
      { label: 'Tra cứu trạm', path: '/lookup', icon: <ManageSearch /> },
      { label: 'Tính toán kỹ thuật', path: '/calculators', icon: <CalculateOutlined /> },
    ],
  },
];

/* Trang phụ — desktop truy cập qua menu avatar, mobile qua bảng "Thêm" */
export const EXTRA_GROUP: NavGroup = {
  label: 'KHÁC',
  items: [
    { label: 'Lịch sử thao tác', path: '/activity-history', icon: <ManageHistoryOutlined /> },
    { label: 'Hướng dẫn', path: '/guide', icon: <MenuBookOutlined />, roles: ['ADMIN', 'SUPERVISOR'] },
    { label: 'Lịch sử đồng bộ', path: '/sync-history', icon: <HistoryOutlined />, roles: ['ADMIN', 'SUPERVISOR'] },
  ],
};

export const allNav: NavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...TECH_NAV_GROUPS.flatMap((g) => g.items),
].filter((item, idx, arr) => arr.findIndex((i) => i.path === item.path) === idx);

export const canSee = (item: NavItem, role?: string) =>
  (!item.adminOnly || role === 'ADMIN') && (!item.roles || item.roles.includes(role ?? ''));

/** Groups visible for a role, with hidden items removed and empty groups dropped. */
export function visibleGroups(groups: NavGroup[], role?: string): NavGroup[] {
  return groups
    .filter((g) => !g.adminOnly || role === 'ADMIN')
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(i, role)) }))
    .filter((g) => g.items.length > 0);
}

export const isPathActive = (path: string, pathname: string, exact = path === '/') =>
  exact ? pathname === path : pathname.startsWith(path);

/* ─── Mobile bottom nav ─────────────────────────────────────────── */
export const MORE_PATH = '#more';

export interface MobileTab { label: string; path: string; icon: React.ReactNode; focal?: boolean }

const TAB_ICON = { fontSize: 22 } as const;

const STAFF_TABS: MobileTab[] = [
  { label: 'Dashboard', path: '/',           icon: <Dashboard sx={TAB_ICON} /> },
  { label: 'Phiếu TC',  path: '/work-orders', icon: <Assignment sx={TAB_ICON} /> },
  { label: 'Tra cứu',   path: '/lookup',      icon: <TravelExplore sx={{ fontSize: 26 }} />, focal: true },
  { label: 'Trạm',      path: '/sites',       icon: <CellTower sx={TAB_ICON} /> },
  { label: 'Thêm',      path: MORE_PATH,      icon: <Apps sx={TAB_ICON} /> },
];

const TECH_TABS: MobileTab[] = [
  { label: 'Tính toán', path: '/calculators',      icon: <Calculate sx={TAB_ICON} /> },
  { label: 'Tra cứu',   path: '/lookup',           icon: <TravelExplore sx={{ fontSize: 26 }} />, focal: true },
  { label: 'Lịch sử',   path: '/activity-history', icon: <ManageHistory sx={TAB_ICON} /> },
];

export const mobileTabsFor = (role?: string) => (role === 'TECHNICIAN' ? TECH_TABS : STAFF_TABS);

/* Sidebar groups chỉ có 1–2 mục — gộp lại để bảng "Thêm" gọn, không phải cuộn */
const SHEET_SECTION: Record<string, string> = {
  'DANH MỤC': 'QUẢN LÝ',
  'VẬT TƯ': 'QUẢN LÝ',
  'CÔNG CỤ': 'CÔNG CỤ · BÁO CÁO',
  'BÁO CÁO': 'CÔNG CỤ · BÁO CÁO',
};

/** Groups shown in the "Thêm" sheet: everything the role can see that is not already a tab. */
export function moreGroupsFor(role?: string): NavGroup[] {
  const tabPaths = new Set(mobileTabsFor(role).map((t) => t.path));
  const base = role === 'TECHNICIAN' ? TECH_NAV_GROUPS : NAV_GROUPS;
  const sections: NavGroup[] = [];
  for (const g of visibleGroups([...base, EXTRA_GROUP], role)) {
    const items = g.items.filter((i) => !tabPaths.has(i.path));
    if (items.length === 0) continue;
    const label = SHEET_SECTION[g.label] ?? g.label;
    const existing = sections.find((s) => s.label === label);
    if (existing) existing.items.push(...items);
    else sections.push({ label, items });
  }
  return sections;
}
