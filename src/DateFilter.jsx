import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatDisplayDate, getTodayIso, offsetDate } from './dateHistory';

export default function DateFilter({ selectedDate, onDateChange, availableDates = [], isOverall = false, onToggleOverall = null }) {
  const dateInputRef = useRef(null);

  const handlePrev = () => {
    if (isOverall && onToggleOverall) onToggleOverall(false);
    onDateChange(offsetDate(selectedDate || getTodayIso(), -1));
  };

  const handleNext = () => {
    if (isOverall && onToggleOverall) onToggleOverall(false);
    onDateChange(offsetDate(selectedDate || getTodayIso(), 1));
  };

  const handleToday = () => {
    if (isOverall && onToggleOverall) onToggleOverall(false);
    const todayIso = getTodayIso();
    // If today exists in available dates, go to today
    if (availableDates.includes(todayIso)) {
      onDateChange(todayIso);
      return;
    }
    // If today has no records, check if there are available dates and pick the latest one, else fallback to today
    if (availableDates.length > 0) {
      const sorted = [...availableDates].sort().reverse();
      onDateChange(sorted[0]);
    } else {
      onDateChange(todayIso);
    }
  };

  const handleOverall = () => {
    if (onToggleOverall) {
      onToggleOverall(!isOverall);
    }
  };

  const openCalendar = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  const display = isOverall ? 'All Time (Overall)' : formatDisplayDate(selectedDate || getTodayIso());
  const hasData = isOverall || availableDates.includes(selectedDate);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '4px 6px',
      gap: '6px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      position: 'relative'
    }}>
      {/* Prev Day Button */}
      <button
        type="button"
        onClick={handlePrev}
        title="Previous Day"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          padding: 0,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          color: '#475569',
          cursor: 'pointer'
        }}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Today Button */}
      <button
        type="button"
        onClick={handleToday}
        style={{
          padding: '4px 10px',
          background: (!isOverall) ? '#e0e7ff' : '#f1f5f9',
          border: 'none',
          borderRadius: '6px',
          color: (!isOverall) ? '#4338ca' : '#475569',
          fontWeight: '600',
          fontSize: '13px',
          cursor: 'pointer'
        }}
      >
        Today
      </button>

      {/* Overall Filter Button (if enabled) */}
      {onToggleOverall && (
        <button
          type="button"
          onClick={handleOverall}
          title="Show Overall Summary (All dates combined)"
          style={{
            padding: '4px 10px',
            background: isOverall ? '#4f46e5' : '#f1f5f9',
            border: 'none',
            borderRadius: '6px',
            color: isOverall ? '#ffffff' : '#4f46e5',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Overall
        </button>
      )}

      {/* Next Day Button */}
      <button
        type="button"
        onClick={handleNext}
        title="Next Day"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          padding: 0,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          color: '#475569',
          cursor: 'pointer'
        }}
      >
        <ChevronRight size={16} />
      </button>

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '0 4px' }} />

      {/* Date Display and Picker trigger */}
      <div
        onClick={openCalendar}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '6px',
          userSelect: 'none'
        }}
        title="Click to select date from calendar"
      >
        <Calendar size={16} color="#6366f1" />
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
          {display}
        </span>
        {hasData && (
          <span
            title="Data available for this date"
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'inline-block'
            }}
          />
        )}
      </div>

      {/* Hidden native date input */}
      <input
        ref={dateInputRef}
        type="date"
        value={selectedDate || ''}
        onChange={e => onDateChange(e.target.value)}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 0,
          height: 0,
          bottom: 0,
          left: 0
        }}
      />
    </div>
  );
}
