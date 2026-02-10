import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    ahu: 'bg-blue-100 text-blue-800',
    rtu: 'bg-indigo-100 text-indigo-800',
    chiller: 'bg-cyan-100 text-cyan-800',
    pump: 'bg-green-100 text-green-800',
    fan: 'bg-emerald-100 text-emerald-800',
    vav: 'bg-purple-100 text-purple-800',
    boiler: 'bg-orange-100 text-orange-800',
    cooling_tower: 'bg-teal-100 text-teal-800',
    tank: 'bg-lime-100 text-lime-800',
    valve: 'bg-yellow-100 text-yellow-800',
    plumbing_fixtures: 'bg-pink-100 text-pink-800',
    water_heater: 'bg-rose-100 text-rose-800',
    motor: 'bg-slate-100 text-slate-800',
    equipment: 'bg-gray-100 text-gray-800',
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    ahu: '❄️',
    rtu: '🏠',
    chiller: '🧊',
    pump: '⚙️',
    fan: '🌀',
    vav: '📦',
    boiler: '🔥',
    cooling_tower: '🏛️',
    tank: '🪣',
    valve: '🔘',
    plumbing_fixtures: '🚿',
    water_heater: '🚿',
    motor: '🔌',
    equipment: '📋',
  };
  return icons[category] || '📄';
}
