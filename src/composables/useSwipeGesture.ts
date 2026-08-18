import { watch, onUnmounted, type Ref } from 'vue';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  maxVerticalOffset?: number;
  edgeOnly?: boolean; // Only trigger swipe right if startX is near left edge
  edgeWidth?: number; // Max distance from screen left edge (default 80px)
  stopPropagation?: boolean; // Stop touch event propagation to parent elements
  edgeDeadZone?: number; // Distance in px from physical screen edge reserved for native browser back/forward swipes
}

function isInsideHorizontallyScrolledContainer(target: HTMLElement | null): boolean {
  let curr = target;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const overflowX = window.getComputedStyle(curr).overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
      curr.scrollWidth > curr.clientWidth
    ) {
      if (curr.scrollLeft > 0) {
        return true;
      }
    }
    curr = curr.parentElement;
  }
  return false;
}

export function useSwipeGesture(
  targetRef: Ref<HTMLElement | null> | null,
  options: SwipeOptions
) {
  const threshold = options.threshold || 50;
  const maxVerticalOffset = options.maxVerticalOffset || 80;
  const edgeWidth = options.edgeWidth || 80;
  const edgeDeadZone = options.edgeDeadZone ?? 25;

  let startX = 0;
  let startY = 0;

  function handleTouchStart(e: TouchEvent) {
    if ((e as any)._swipeHandled) return;
    if (e.touches.length !== 1) return;
    if (options.stopPropagation) {
      e.stopPropagation();
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }

  function handleTouchEnd(e: TouchEvent) {
    if ((e as any)._swipeHandled) return;
    if (e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - startX;
    const deltaY = e.changedTouches[0].clientY - startY;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

    // Ignore if vertical movement exceeds max vertical offset
    if (Math.abs(deltaY) > maxVerticalOffset) return;

    // Swipe Left (Close action / Forward navigation)
    if (deltaX < -threshold) {
      // Reserve the extreme right edge for native browser swipe-forward gestures
      if (startX > windowWidth - edgeDeadZone) {
        return;
      }

      (e as any)._swipeHandled = true;
      if (options.stopPropagation) e.stopPropagation();
      options.onSwipeLeft?.();
    }
    // Swipe Right (Open action / Back navigation)
    else if (deltaX > threshold) {
      // Reserve the extreme left edge for native browser swipe-back gestures
      if (startX < edgeDeadZone) {
        return;
      }

      if (options.edgeOnly && startX > edgeWidth) {
        return;
      }

      // Check if swiping inside a horizontally scrollable container that has not reached the left edge
      const targetEl = e.target as HTMLElement | null;
      if (isInsideHorizontallyScrolledContainer(targetEl)) {
        return;
      }

      (e as any)._swipeHandled = true;
      if (options.stopPropagation) e.stopPropagation();
      options.onSwipeRight?.();
    }
  }

  let activeEl: HTMLElement | null = null;

  function attachEvents(el: HTMLElement) {
    detachEvents();
    activeEl = el;
    const passiveOpt = options.stopPropagation ? false : true;
    activeEl.addEventListener('touchstart', handleTouchStart, { passive: passiveOpt });
    activeEl.addEventListener('touchend', handleTouchEnd, { passive: passiveOpt });
  }

  function detachEvents() {
    if (activeEl) {
      activeEl.removeEventListener('touchstart', handleTouchStart);
      activeEl.removeEventListener('touchend', handleTouchEnd);
      activeEl = null;
    }
  }

  if (targetRef) {
    watch(
      () => targetRef.value,
      (newEl) => {
        if (newEl) {
          attachEvents(newEl);
        } else {
          detachEvents();
        }
      },
      { immediate: true }
    );
  } else {
    if (typeof document !== 'undefined') {
      attachEvents(document.body);
    }
  }

  onUnmounted(() => {
    detachEvents();
  });
}
