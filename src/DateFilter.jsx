import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatDisplayDate, getTodayIso, offsetDate } from './dateHistory';

export default function DateFilter({ selectedDate, onDateChange, availableDates = [] }) {
  const dateInputRef = useRef(null);

  const handlePrev = () => {
    onDateChange(offsetDate(selectedDate || getTodayIso(), -1));
  };

  const handleNext = () => {
    onDateChange(offsetDate(selectedDate || getTodayIso(), 1));
  };

  const handleToday = () => {
    onDateChange(getTodayIso());
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

  const display = formatDisplayDate(selectedDate || getTodayIso());
  const hasData = availableDates.includes(selectedDate);

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
          background: '#f1f5f9',
          border: 'none',
          borderRadius: '6px',
          color: '#4f46e5',
          fontWeight: '600',
          fontSize: '13px',
          cursor: 'pointer'
        }}
      >
        Today
      </button>

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
