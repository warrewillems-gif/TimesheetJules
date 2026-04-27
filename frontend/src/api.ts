import type { Client, Project, Subproject, TimeEntry, ReportData, RevenueData, Cost, CostSummary } from './types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Onbekende fout' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Clients
export const getClients = () => request<Client[]>('/clients');
export const createClient = (naam: string) =>
  request<Client>('/clients', { method: 'POST', body: JSON.stringify({ naam }) });
export const updateClient = (id: number, data: Partial<Client>) =>
  request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteClient = (id: number) =>
  request(`/clients/${id}`, { method: 'DELETE' });
export const permanentDeleteClient = (id: number) =>
  request(`/clients/${id}/permanent`, { method: 'DELETE' });

// Projects
export const getProjects = (clientId: number) =>
  request<Project[]>(`/clients/${clientId}/projects`);
export const createProject = (clientId: number, naam: string) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify({ clientId, naam }) });
export const updateProject = (id: number, data: Partial<Project>) =>
  request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id: number) =>
  request(`/projects/${id}`, { method: 'DELETE' });
export const permanentDeleteProject = (id: number) =>
  request(`/projects/${id}/permanent`, { method: 'DELETE' });

// Subprojects
export const getSubprojects = (projectId: number) =>
  request<Subproject[]>(`/projects/${projectId}/subprojects`);
export const createSubproject = (projectId: number, naam: string) =>
  request<Subproject>('/subprojects', { method: 'POST', body: JSON.stringify({ projectId, naam }) });
export const updateSubproject = (id: number, data: Partial<Subproject>) =>
  request<Subproject>(`/subprojects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSubproject = (id: number) =>
  request(`/subprojects/${id}`, { method: 'DELETE' });
export const permanentDeleteSubproject = (id: number) =>
  request(`/subprojects/${id}/permanent`, { method: 'DELETE' });

// Time entries
export const getTimeEntries = (maand: string) =>
  request<TimeEntry[]>(`/time-entries?maand=${maand}`);
export const upsertTimeEntry = (data: {
  subprojectId: number;
  datum: string;
  werkelijkeUren: number;
  gefactureerdeUren: number;
}) => request<TimeEntry>('/time-entries', { method: 'PUT', body: JSON.stringify(data) });

// Reports
export const getReport = (clientId: number, maand: string) =>
  request<ReportData>(`/reports/client/${clientId}?maand=${maand}`);
export const getRevenue = (jaar: number) =>
  request<RevenueData>(`/reports/revenue?jaar=${jaar}`);

// Costs
export const getCosts = (jaar?: number) =>
  request<Cost[]>(jaar ? `/costs?jaar=${jaar}` : '/costs');
export const createCost = (data: { omschrijving: string; bedrag: number; type: 'eenmalig' | 'maandelijks'; datum: string }) =>
  request<Cost>('/costs', { method: 'POST', body: JSON.stringify(data) });
export const updateCost = (id: number, data: Partial<Cost>) =>
  request<Cost>(`/costs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCost = (id: number) =>
  request(`/costs/${id}`, { method: 'DELETE' });
export const getCostSummary = (jaar: number) =>
  request<CostSummary>(`/costs/summary/${jaar}`);
