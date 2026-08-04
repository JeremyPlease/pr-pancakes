import React, { useState } from 'react';
import styled from 'styled-components';
import dayjs from 'dayjs';

const DateRangeContainer = styled.div`
  background-color: #161b22;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const DateRangeHeader = styled.h3`
  color: #f0c46c;
  margin-bottom: 16px;
  font-size: 1.2rem;
`;

const PresetsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`;

const PresetButton = styled.button`
  background-color: ${props => props.$active ? '#f0c46c' : '#21262d'};
  color: ${props => props.$active ? '#0d1117' : '#c9d1d9'};
  border: 1px solid ${props => props.$active ? '#f0c46c' : '#30363d'};
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.$active ? '#f8d68e' : '#30363d'};
    border-color: ${props => props.$active ? '#f8d68e' : '#8b949e'};
  }
`;

const CustomDateContainer = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
`;

const DateInput = styled.input`
  background-color: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #f0c46c;
    box-shadow: 0 0 0 2px rgba(240, 196, 108, 0.2);
  }
`;

const Label = styled.label`
  color: #8b949e;
  font-size: 14px;
  font-weight: 500;
`;

const PRESETS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: 'last7', label: 'Last 7 Days', days: 7 },
  { key: 'last30', label: 'Last 30 Days', days: 30 },
  { key: 'thisMonth', label: 'This Month', isThisMonth: true },
  { key: 'thisQuarter', label: 'This Quarter', isThisQuarter: true },
  { key: 'thisYear', label: 'This Year', isThisYear: true },
  { key: 'lastYear', label: 'Last Year', isLastYear: true },
  { key: 'custom', label: 'Custom', isCustom: true }
];

const DateRangePicker = ({ value, onChange, timezone }) => {
  const [activePreset, setActivePreset] = useState('last30');
  const [customStart, setCustomStart] = useState(value.start.format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(value.end.format('YYYY-MM-DD'));

  // Update custom date inputs when value changes from parent
  React.useEffect(() => {
    setCustomStart(value.start.format('YYYY-MM-DD'));
    setCustomEnd(value.end.format('YYYY-MM-DD'));
  }, [value.start, value.end]);

  // Detect which preset matches the current date range
  React.useEffect(() => {
    const now = dayjs().tz(timezone);
    const start = value.start;
    const end = value.end;

    // Check if current range matches any preset
    for (const preset of PRESETS) {
      if (preset.isCustom) continue;

      let expectedStart, expectedEnd;

      if (preset.days !== undefined) {
        if (preset.days === 0) {
          expectedStart = now.startOf('day');
          expectedEnd = now.endOf('day');
        } else {
          expectedStart = now.subtract(preset.days, 'days').startOf('day');
          expectedEnd = now.endOf('day');
        }
      } else if (preset.isThisMonth) {
        expectedStart = now.startOf('month');
        expectedEnd = now.endOf('month');
      } else if (preset.isThisQuarter) {
        const quarter = Math.floor(now.month() / 3);
        expectedStart = now.month(quarter * 3).startOf('month');
        expectedEnd = now.month(quarter * 3 + 2).endOf('month');
      } else if (preset.isThisYear) {
        expectedStart = now.startOf('year');
        expectedEnd = now.endOf('year');
      } else if (preset.isLastYear) {
        expectedStart = now.subtract(1, 'year').startOf('year');
        expectedEnd = now.subtract(1, 'year').endOf('year');
      }

      // Check if current range matches this preset (within 1 hour tolerance)
      if (expectedStart && expectedEnd) {
        const startMatches = Math.abs(start.diff(expectedStart)) < 3600000; // 1 hour
        const endMatches = Math.abs(end.diff(expectedEnd)) < 3600000; // 1 hour

        if (startMatches && endMatches) {
          setActivePreset(preset.key);
          return;
        }
      }
    }

    // If no preset matches, set to custom
    setActivePreset('custom');
  }, [value.start, value.end, timezone]);

  const handlePresetClick = (preset) => {
    setActivePreset(preset.key);

    if (preset.isCustom) {
      return;
    }

    let start, end;
    const now = dayjs().tz(timezone);

    if (preset.days !== undefined) {
      if (preset.days === 0) {
        // Today
        start = now.startOf('day');
        end = now.endOf('day');
      } else {
        // Last N days
        start = now.subtract(preset.days, 'days').startOf('day');
        end = now.endOf('day');
      }
    } else if (preset.isThisMonth) {
      start = now.startOf('month');
      end = now.endOf('month');
    } else if (preset.isThisQuarter) {
      const currentQuarter = Math.floor(now.month() / 3);
      start = now.month(currentQuarter * 3).startOf('month');
      end = now.month(currentQuarter * 3 + 2).endOf('month');
    } else if (preset.isThisYear) {
      start = now.startOf('year');
      end = now.endOf('year');
    } else if (preset.isLastYear) {
      start = now.subtract(1, 'year').startOf('year');
      end = now.subtract(1, 'year').endOf('year');
    }

    if (start && end) {
      onChange({ start, end });
    }
  };

  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setCustomStart(newStart);

    if (newStart && customEnd) {
      const start = dayjs(newStart).tz(timezone).startOf('day');
      const end = dayjs(customEnd).tz(timezone).endOf('day');

      if (start.isValid() && end.isValid() && start.isBefore(end)) {
        onChange({ start, end });
      }
    }
  };

  const handleEndDateChange = (e) => {
    const newEnd = e.target.value;
    setCustomEnd(newEnd);

    if (customStart && newEnd) {
      const start = dayjs(customStart).tz(timezone).startOf('day');
      const end = dayjs(newEnd).tz(timezone).endOf('day');

      if (start.isValid() && end.isValid() && start.isBefore(end)) {
        onChange({ start, end });
      }
    }
  };

  const getCurrentRangeText = () => {
    const start = value.start.tz(timezone);
    const end = value.end.tz(timezone);

    if (start.isSame(end, 'day')) {
      return start.format('MMM D, YYYY');
    }

    if (start.isSame(end, 'year')) {
      return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
    }

    return `${start.format('MMM D, YYYY')} - ${end.format('MMM D, YYYY')}`;
  };

  return (
    <DateRangeContainer>
      <DateRangeHeader>
        📅 Date Range: {getCurrentRangeText()}
      </DateRangeHeader>

      <PresetsContainer>
        {PRESETS.map(preset => (
          <PresetButton
            key={preset.key}
            $active={activePreset === preset.key}
            onClick={() => handlePresetClick(preset)}
          >
            {preset.label}
          </PresetButton>
        ))}
      </PresetsContainer>

      {activePreset === 'custom' && (
        <CustomDateContainer>
          <div>
            <Label>Start Date:</Label>
            <DateInput
              type="date"
              value={customStart}
              onChange={handleStartDateChange}
            />
          </div>
          <div>
            <Label>End Date:</Label>
            <DateInput
              type="date"
              value={customEnd}
              onChange={handleEndDateChange}
            />
          </div>
        </CustomDateContainer>
      )}
    </DateRangeContainer>
  );
};

export default DateRangePicker;
