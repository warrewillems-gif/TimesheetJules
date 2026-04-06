const MAAND_NAMEN = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

const DAG_NAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

export function getMaandNaam(maand: number): string {
  return MAAND_NAMEN[maand];
}

export function getDagNaam(date: Date): string {
  return DAG_NAMEN[date.getDay()];
}

export function getDagenInMaand(jaar: number, maand: number): Date[] {
  const dagen: Date[] = [];
  const aantalDagen = new Date(jaar, maand + 1, 0).getDate();
  for (let d = 1; d <= aantalDagen; d++) {
    dagen.push(new Date(jaar, maand, d));
  }
  return dagen;
}

export function isWeekend(date: Date): boolean {
  const dag = date.getDay();
  return dag === 0 || dag === 6;
}

export function formatDatum(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatMaand(jaar: number, maand: number): string {
  return `${jaar}-${String(maand + 1).padStart(2, '0')}`;
}

export function parseDecimal(value: string): number {
  const cleaned = value.replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
