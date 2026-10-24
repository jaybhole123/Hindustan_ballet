import React, { useState, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon } from 'lucide-react';

export default function ImagePreviewModal({ isOpen, onClose, imageUrl, title }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.3, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.3, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + 0.15, 4));
    } else {
      setZoom(prev => Math.max(prev - 0.15, 0.5));
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(5px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          width: '95vw',
          maxWidth: '1200px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Title and Zoom Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ImageIcon size={20} color="#4f46e5" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
              {title || 'Uploaded Report Image'}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Zoom Out Button */}
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <ZoomOut size={16} /> Zoom Out
            </button>

            {/* Current Zoom % Indicator */}
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', minWidth: '48px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>

            {/* Zoom In Button */}
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In (+)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <ZoomIn size={16} /> Zoom In
            </button>

            {/* Reset Zoom Button */}
            <button
              type="button"
              onClick={handleReset}
              title="Reset Zoom"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={14} /> Reset
            </button>

            <div style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 4px' }} />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              style={{
                background: '#fee2e2',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Viewport for Dragging & Zooming */}
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#090d16',
            cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
            position: 'relative',
            userSelect: 'none'
          }}
        >
          <img
            src={imageUrl}
            alt="Report Preview"
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              maxWidth: '85%',
              maxHeight: '85%',
              objectFit: 'contain',
              borderRadius: '4px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '12px',
            right: '16px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#94a3b8',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            pointerEvents: 'none'
          }}>
            Scroll to zoom • Drag to pan
          </div>
        </div>
      </div>
    </div>
  );
}
