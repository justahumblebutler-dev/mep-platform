import React, { useState } from 'react';
import { Equipment } from '../types';
import { cn } from '../lib/utils';

interface EquivalencyMatch {
  original: string;
  matched: string;
  isEquivalent: boolean;
  differences: {
    spec: string;
    original: string;
    matched: string;
    status: 'critical' | 'warning' | 'good';
  }[];
  matchScore: number;
}

interface ComparisonUIProps {
  equipment: Equipment;
  matches: EquivalencyMatch[];
  myCompany?: string;
}

export function ComparisonUI({ equipment, matches, myCompany = "Daikin IEC" }: ComparisonUIProps) {
  const [selectedMatch, setSelectedMatch] = useState<EquivalencyMatch | null>(
    matches[0] || null
  );
  
  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No equivalent equipment found
      </div>
    );
  }
  
  const getStatusColor = (status: 'critical' | 'warning' | 'good') => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'good':
        return 'bg-green-100 text-green-800 border-green-300';
    }
  };
  
  const getStatusIcon = (status: 'critical' | 'warning' | 'good') => {
    switch (status) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'good':
        return '🟢';
    }
  };
  
  const isMyCompanyMatch = (match: EquivalencyMatch) => {
    return match.matched.toLowerCase().includes(myCompany.toLowerCase());
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h2 className="text-white font-semibold text-lg">
          🔄 Equivalency Search: {equipment.tag}
        </h2>
        <p className="text-blue-100 text-sm mt-1">
          Found {matches.length} potential equivalent(s)
        </p>
      </div>
      
      {/* Match Selection */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {matches.map((match, index) => (
            <button
              key={index}
              onClick={() => setSelectedMatch(match)}
              className={cn(
                "flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                selectedMatch?.original === match.original &&
                  selectedMatch?.matched === match.matched
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <div className="flex items-center gap-2">
                <span>{match.matched}</span>
                {isMyCompanyMatch(match) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    🎯 Your Line
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(match.matchScore * 100).toFixed(0)}% match
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Comparison Table */}
      {selectedMatch && (
        <div className="p-6">
          {/* Score Banner */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {selectedMatch.matched}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedMatch.isEquivalent ? (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    ✅ Direct Equivalent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-yellow-600">
                    ⚠️ Review Required
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {(selectedMatch.matchScore * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-500">Match Score</div>
            </div>
          </div>
          
          {/* My Company Highlight */}
          {isMyCompanyMatch(selectedMatch) && (
            <div className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <div>
                  <div className="font-semibold text-purple-900">
                    This is YOUR company's equipment!
                  </div>
                  <div className="text-sm text-purple-700">
                    Highlight this in your quote to show value over the specified brand
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Spec Comparison */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Specification
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Original: {equipment.tag}
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Matched: {selectedMatch.matched}
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {selectedMatch.differences.map((diff, index) => (
                  <tr
                    key={index}
                    className={cn(
                      "transition-colors",
                      diff.status === 'critical' && "bg-red-50",
                      diff.status === 'warning' && "bg-yellow-50"
                    )}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {diff.spec}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {diff.original}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center font-medium">
                      {diff.matched}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          getStatusColor(diff.status)
                        )}
                      >
                        {getStatusIcon(diff.status)} {diff.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <button
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              onClick={() => {
                // Export comparison
                const csv = generateCSV(selectedMatch, equipment);
                downloadFile(csv, `equivalency-${equipment.tag}.csv`);
              }}
            >
              📥 Export Comparison
            </button>
            
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                View Full Specs
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Generate Quote
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Summary Footer */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Showing {matches.length} of {matches.length} matches
          </span>
          <span className="text-gray-500">
            My Company: {myCompany}
          </span>
        </div>
      </div>
    </div>
  );
}

function generateCSV(match: EquivalencyMatch, equipment: Equipment): string {
  const headers = ['Specification', 'Original', 'Matched', 'Status', 'Notes'];
  const rows = match.differences.map(diff => [
    diff.spec,
    diff.original,
    diff.matched,
    diff.status,
    '',
  ]);
  
  const allRows = [headers, ...rows];
  return allRows.map(row => row.join(',')).join('\n');
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default ComparisonUI;
