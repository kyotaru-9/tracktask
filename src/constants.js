// ── Roles ────────────────────────────────────────────────────────────
export const ROLES = {
  MAYOR: "Mayor",
  CITY_ADMIN: "City Administrator",
  CITY_ENRO: "City ENRO",
  SWM_SECRETARY: "SWM Secretary",
  DIVISION: "Division",
  HR: "HR",
};

export const ROLE_LABELS = {
  "Mayor": "City Mayor",
  "City Administrator": "City Administrator",
  "City ENRO": "City ENRO",
  "SWM Secretary": "SWM Secretary",
  "Division": "Division",
  "HR": "Human Resources",
};

// The six sections under the City ENRO
export const DIVISIONS = [
  { id: "admin", name: "Administrative and Permitting Division" },
  { id: "envi", name: "Environmental Information, Research and Development Division" },
  { id: "greening", name: "City Greening and Forestry Management Division" },
  { id: "natres", name: "Natural Resources Management and Safety Division" },
  { id: "pollution", name: "Pollution Control and Management Division" },
  { id: "septage", name: "Septage Treatment and Management Division" },
];

export const DIVISION_NAMES = DIVISIONS.map((d) => d.name);

// Offices the Mayor can place in the approval route (after themselves)
export const ROUTE_OPTIONS = [
  ROLES.CITY_ADMIN,
  ROLES.CITY_ENRO,
  ROLES.SWM_SECRETARY,
  ...DIVISION_NAMES,
];

export function routeOptionLabel(option) {
  return DIVISION_NAMES.includes(option) ? `Division — ${option}` : option;
}

// Default preset: Mayor → City Administrator → City ENRO → one Division
export const DEFAULT_ROUTE = [
  ROLES.CITY_ADMIN,
  ROLES.CITY_ENRO,
  DIVISION_NAMES[0],
];

// ── Document metadata ────────────────────────────────────────────────
export const DOC_TYPES = ["Budget", "Permit", "Report", "Memo", "Resolution", "Other"];
export const URGENCY_LEVELS = ["Low", "Normal", "High", "Critical"];

// ── Document statuses ────────────────────────────────────────────────
export const DOC_STATUS = {
  PROCESSING: "processing",
  RETURNING: "returning",
  DONE: "done",
  REJECTED: "rejected",
};
