// The five roles (D2, TECH-SPEC §8). Structure, not people: the sync seeds them once; names are edited in Settings →
// Organization & access → Roles (P3-5), never overwritten by a later sync.
import type { RoleKey } from './define-module';

export const ROLE_SEED: readonly { key: RoleKey; name_en: string; name_ar: string; sort: number; is_admin: boolean }[] =
  [
    { key: 'admin', name_en: 'Admin', name_ar: 'مسؤول النظام', sort: 10, is_admin: true },
    { key: 'head', name_en: 'Head of department', name_ar: 'رئيس الإدارة', sort: 20, is_admin: false },
    { key: 'manager', name_en: 'Manager', name_ar: 'مدير', sort: 30, is_admin: false },
    { key: 'member', name_en: 'Team member', name_ar: 'عضو الفريق', sort: 40, is_admin: false },
    { key: 'viewer', name_en: 'Viewer', name_ar: 'مشاهد', sort: 50, is_admin: false },
  ];
