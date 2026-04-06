export interface Client {
  id: number;
  naam: string;
  actief: number;
}

export interface Project {
  id: number;
  clientId: number;
  naam: string;
  actief: number;
}

export interface Subproject {
  id: number;
  projectId: number;
  naam: string;
  actief: number;
}

export interface TimeEntry {
  id: number;
  subprojectId: number;
  datum: string;
  werkelijkeUren: number;
  gefactureerdeUren: number;
  projectId?: number;
  clientId?: number;
}

export interface ReportData {
  client: { id: number; naam: string };
  maand: string;
  projecten: {
    id: number;
    naam: string;
    subprojecten: { id: number; naam: string; totaal: number }[];
    totaal: number;
  }[];
  totaal: number;
}

// Hierarchical data for the grid
export interface ClientWithProjects extends Client {
  projects: ProjectWithSubprojects[];
}

export interface ProjectWithSubprojects extends Project {
  subprojects: Subproject[];
}

export interface RevenueClient {
  id: number;
  naam: string;
  maanden: Record<string, number>;
  totaalUren: number;
}

export interface RevenueData {
  jaar: number;
  clients: RevenueClient[];
  totaalUren: number;
}
