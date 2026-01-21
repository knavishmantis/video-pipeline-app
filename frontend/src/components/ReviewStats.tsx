import { useEffect, useState } from 'react';
import { analyzedShortsApi, ReviewStats } from '../services/api';

export function ReviewStatsWidget() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await analyzedShortsApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 min-w-[200px]">
        <div className="text-xs text-gray-500">Loading stats...</div>
      </div>
    );
  }

  if (!stats || (stats.allTime.count === 0 && stats.last30.count === 0 && stats.last10.count === 0)) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 min-w-[200px]">
        <div className="text-xs text-gray-500">No reviews yet</div>
      </div>
    );
  }

  const formatError = (error: number) => {
    return error.toFixed(1);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 min-w-[280px]">
      <div className="text-xs font-semibold text-gray-700 mb-2">Review Accuracy</div>
      <div className="space-y-2 text-xs mb-3 pb-3 border-b border-gray-100">
        {stats.last10.count > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Last 10:</span>
            <span className="font-medium">{formatError(stats.last10.avg_error)}% avg</span>
          </div>
        )}
        {stats.last30.count > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Last 30:</span>
            <span className="font-medium">{formatError(stats.last30.avg_error)}% avg</span>
          </div>
        )}
        {stats.allTime.count > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-700 font-medium">All Time:</span>
            <span className="font-semibold text-gray-900">{formatError(stats.allTime.avg_error)}% avg</span>
          </div>
        )}
      </div>
      <div className="text-xs">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Progress:</span>
          <span className="font-semibold text-gray-900">
            {stats.reviewed} / {stats.total}
          </span>
        </div>
        {stats.total > 0 && (
          <div className="mt-1">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${(stats.reviewed / stats.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

