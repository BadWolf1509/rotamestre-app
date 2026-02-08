/**
 * usePipDrag - Drag interaction hook for PiP map (web)
 *
 * Handles mouse and touch drag events, snap-to-edge behavior,
 * and swipe-to-close gesture for the Picture-in-Picture map overlay.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

import { EDGE_PADDING, PIP_WIDTH, PIP_HEIGHT, SWIPE_DOWN_THRESHOLD } from './constants';

interface UsePipDragOptions {
  isExpanded: boolean;
  viewport: { width: number; height: number };
  positionRef: React.MutableRefObject<{ x: number; y: number }>;
  setPosition: (pos: { x: number; y: number }) => void;
  onClose: () => void;
  savePosition: (pos: { x: number; y: number }) => void;
}

export function usePipDrag({
  isExpanded,
  viewport,
  positionRef,
  setPosition,
  onClose,
  savePosition,
}: UsePipDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });

  // Snap to nearest edge
  const snapToEdge = useCallback(() => {
    const { x, y } = positionRef.current;
    const centerX = x + PIP_WIDTH / 2;
    const snapX = centerX < viewport.width / 2
      ? EDGE_PADDING
      : viewport.width - PIP_WIDTH - EDGE_PADDING;

    const minY = EDGE_PADDING;
    const maxY = viewport.height - PIP_HEIGHT - EDGE_PADDING - 60;
    const snapY = Math.max(minY, Math.min(maxY, y));

    positionRef.current = { x: snapX, y: snapY };
    setPosition({ x: snapX, y: snapY });
    savePosition({ x: snapX, y: snapY });
  }, [viewport, positionRef, setPosition, savePosition]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isExpanded) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
    dragStartPosRef.current = { ...positionRef.current };
  }, [isExpanded, positionRef]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || isExpanded) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    positionRef.current = { x: newX, y: newY };
    setPosition({ x: newX, y: newY });
  }, [isDragging, isExpanded, positionRef, setPosition]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Detect swipe down
    const deltaY = positionRef.current.y - dragStartPosRef.current.y;
    if (deltaY > SWIPE_DOWN_THRESHOLD) {
      onClose();
      return;
    }

    snapToEdge();
  }, [isDragging, positionRef, snapToEdge, onClose]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isExpanded) return;
    e.stopPropagation();
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartRef.current = {
      x: touch.clientX - positionRef.current.x,
      y: touch.clientY - positionRef.current.y,
    };
    dragStartPosRef.current = { ...positionRef.current };
  }, [isExpanded, positionRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || isExpanded) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStartRef.current.x;
    const newY = touch.clientY - dragStartRef.current.y;
    positionRef.current = { x: newX, y: newY };
    setPosition({ x: newX, y: newY });
  }, [isDragging, isExpanded, positionRef, setPosition]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaY = positionRef.current.y - dragStartPosRef.current.y;
    if (deltaY > SWIPE_DOWN_THRESHOLD) {
      onClose();
      return;
    }
    snapToEdge();
  }, [isDragging, positionRef, snapToEdge, onClose]);

  // Global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return {
    isDragging,
    handleMouseDown,
    handleTouchStart,
    snapToEdge,
  };
}
