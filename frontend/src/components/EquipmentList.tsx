import React from 'react';
import { Equipment } from '../types';
import { cn, getCategoryColor, getCategoryIcon, getConfidenceColor, truncate } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChevronDown, ChevronUp, Eye, AlertTriangle } from 'lucide-react';

interface EquipmentListProps {
  equipment: Equipment[];
  onSelect?: (eq: Equipment) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export function EquipmentList({ equipment, onSelect }: EquipmentListProps) {
  const [sortBy, setSortBy] = React.useState<'tag' | 'type' | 'category' | 'confidence'>('tag');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = React.useState<string>('all');

  // Sort equipment
  const sortedEquipment = [...equipment].sort((a, b) => {
    let aVal: any, bVal: any;
    
    switch (sortBy) {
      case 'tag':
        aVal = a.tag.toLowerCase();
        bVal = b.tag.toLowerCase();
        break;
      case 'type':
        aVal = a.type.toLowerCase();
        bVal = b.type.toLowerCase();
        break;
      case 'category':
        aVal = a.category.toLowerCase();
        bVal = b.category.toLowerCase();
        break;
      case 'confidence':
        aVal = a.confidence;
        bVal = b.confidence;
        break;
      default:
        aVal = a.tag;
        bVal = b.tag;
    }
    
    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Filter by category
  const filteredEquipment = filterCategory === 'all' 
    ? sortedEquipment 
    : sortedEquipment.filter(e => e.category === filterCategory);

  // Get unique categories
  const categories = [...new Set(equipment.map(e => e.category))];

  // Stats for charts
  const categoryStats = categories.map(cat => ({
    name: cat,
    count: equipment.filter(e => e.category === cat).length,
  })).sort((a, b) => b.count - a.count);

  const confidenceStats = [
    { name: 'High (≥0.8)', count: equipment.filter(e => e.confidence >= 0.8).length },
    { name: 'Med (0.5-0.8)', count: equipment.filter(e => e.confidence >= 0.5 && e.confidence < 0.8).length },
    { name: 'Low (<0.5)', count: equipment.filter(e => e.confidence < 0.5).length },
  ];

  const toggleExpanded = (tag: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(tag)) {
      newExpanded.delete(tag);
    } else {
      newExpanded.add(tag);
    }
    setExpanded(newExpanded);
  };

  if (equipment.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No equipment found in this document</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Category Distribution */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Equipment by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Confidence Distribution */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Extraction Confidence</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={confidenceStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {confidenceStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Filter:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories ({equipment.length})</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat} ({equipment.filter(e => e.category === cat).length})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="tag">Tag</option>
            <option value="type">Type</option>
            <option value="category">Category</option>
            <option value="confidence">Confidence</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Equipment List */}
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        {filteredEquipment.map((eq) => (
          <div key={eq.tag} className="p-4">
            {/* Header */}
            <div 
              className="flex items-start justify-between cursor-pointer"
              onClick={() => toggleExpanded(eq.tag)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getCategoryIcon(eq.category)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-gray-900">{eq.tag}</span>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      getCategoryColor(eq.category)
                    )}>
                      {eq.type}
                    </span>
                    {eq.confidence < 0.5 && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3" />
                        Low confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Page {eq.page_number} • {eq.confidence.toFixed(2)} confidence
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {eq.sizes.length > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {eq.sizes.map(s => s.value).join(', ')}
                  </span>
                )}
                {expanded.has(eq.tag) ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {expanded.has(eq.tag) && (
              <div className="mt-4 pl-11 space-y-3">
                {eq.sizes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Sizes</h4>
                    <div className="flex flex-wrap gap-2">
                      {eq.sizes.map((s, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-sm">
                          {s.type}: <strong className="ml-1">{s.value}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {eq.specs_references.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Spec References</h4>
                    <div className="flex flex-wrap gap-2">
                      {eq.specs_references.map((spec, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Raw Context</h4>
                  <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                    {truncate(eq.raw_text, 500)}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="text-center text-sm text-gray-600">
        Showing {filteredEquipment.length} of {equipment.length} equipment items
        {filterCategory !== 'all' && ` (filtered by ${filterCategory})`}
      </div>
    </div>
  );
}

export default EquipmentList;
