export const VIEWER_HEADER_NAME = "x-workforcepro-viewer-email";
export const DEMO_VIEWER_STORAGE_KEY = "workforcepro.active-viewer";

export const DEFAULT_ADMIN_EMAIL = "olivia.admin@workforcepro.dev";
export const DEFAULT_MANAGER_EMAIL = "marcus.manager@workforcepro.dev";

export const defaultDemoProfiles = [
  {
    email: DEFAULT_ADMIN_EMAIL,
    headline: "Admin access with payroll and compliance controls.",
    name: "Olivia Byrne",
    role: "ADMIN",
  },
  {
    email: DEFAULT_MANAGER_EMAIL,
    headline: "Manager access with team approvals and analytics.",
    name: "Marcus Doyle",
    role: "MANAGER",
  },
  {
    email: "aisha.employee@workforcepro.dev",
    headline: "Employee view with active shift and correction history.",
    name: "Aisha Khan",
    role: "EMPLOYEE",
  },
  {
    email: "liam.employee@workforcepro.dev",
    headline: "Employee view with overnight and bank-holiday records.",
    name: "Liam Murphy",
    role: "EMPLOYEE",
  },
  {
    email: "sofia.employee@workforcepro.dev",
    headline: "Employee view with part-time leave balance and upcoming shifts.",
    name: "Sofia Walsh",
    role: "EMPLOYEE",
  },
] as const;

export type DemoProfile = (typeof defaultDemoProfiles)[number];
