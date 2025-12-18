import React from 'react';
import { formatDurationMs } from '../../lib/uiUtils';

export interface DayAggregateData {
  totalFactoryTime: number;
  totalExecutionTime: number;
  totalOtherStepsTime: number;
  totalPassCount: number;
  executionPercentage: number;
  formattedDate: string;
  totalBluePoints: number;
  symptomCounts: Map<string, number>;
  causeCounts: Map<string, number>;
}

interface DaySummaryHeaderProps {
  data: DayAggregateData;
  colSpan?: number;
}

export const DaySummaryHeader: React.FC<DaySummaryHeaderProps> = ({ data, colSpan = 11 }) => {
  const {
    totalFactoryTime,
    totalExecutionTime,
    totalOtherStepsTime,
    totalPassCount,
    executionPercentage,
    formattedDate,
    symptomCounts,
    causeCounts
  } = data;

  return (
    <tr className="day-summary-header">
      <td colSpan={colSpan}>
        <div className="day-summary-content">
          <div className="day-summary-date">{formattedDate}</div>
          <div className="day-summary-stats">
            <div className="day-summary-item">
              <span className="day-summary-label">Total Passes</span>
              <span className="day-summary-value">{totalPassCount}</span>
            </div>
            <div className="day-summary-item">
              <span className="day-summary-label">Total Time</span>
              <span className="day-summary-value">{formatDurationMs(totalFactoryTime)}</span>
            </div>
            <div className="day-summary-item">
              <span className="day-summary-label">Executing Time</span>
              <span className="day-summary-value">{formatDurationMs(totalExecutionTime)}</span>
            </div>
            <div className="day-summary-item">
              <span className="day-summary-label">Other Steps Time</span>
              <span className="day-summary-value">{formatDurationMs(totalOtherStepsTime)}</span>
            </div>
            <div className="day-summary-item">
              <span className="day-summary-label">Execution %</span>
              <span className="day-summary-value">{executionPercentage.toFixed(1)}%</span>
            </div>
            <div className="day-summary-item diagnosis-item">
              <span className="day-summary-label">Symptoms</span>
              <span className="day-summary-value diagnosis-list" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                {symptomCounts.size > 0 ? (
                  Array.from(symptomCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([symptom, count]) => (
                      <div key={symptom}>
                        {symptom}: {count}
                      </div>
                    ))
                ) : (
                  <span>—</span>
                )}
              </span>
            </div>
            <div className="day-summary-item diagnosis-item">
              <span className="day-summary-label">Causes</span>
              <span className="day-summary-value diagnosis-list" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                {causeCounts.size > 0 ? (
                  Array.from(causeCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([cause, count]) => (
                      <div key={cause}>
                        {cause}: {count}
                      </div>
                    ))
                ) : (
                  <span>—</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};

export default DaySummaryHeader;
