import type { Action } from '../game/Input';
import type { Input } from '../game/Input';

export interface TouchControlsOptions {
  onPause?: () => void;
}

/**
 * Every action a pad button may bind to. Derived from `Action` rather than
 * spelled out at the call site, so adding a button cannot silently no-op on a
 * stale allowlist.
 */
const TOUCH_ACTIONS: readonly Action[] = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'sprint',
];

function isTouchAction(value: string | null): value is Action {
  return value !== null && (TOUCH_ACTIONS as readonly string[]).includes(value);
}

/**
 * On-screen virtual controls for phones/tablets.
 * Multi-touch safe: left/right + jump can be held together.
 */
export class TouchControls {
  readonly root: HTMLElement;
  private readonly input: Input;
  private readonly onPause?: () => void;
  private readonly pointerActions = new Map<number, Action>();
  private joystickPointer: number | null = null;
  private joystickElement: HTMLElement | null = null;
  private visible = false;
  private forceShow = false;

  constructor(parent: HTMLElement, input: Input, options: TouchControlsOptions = {}) {
    this.input = input;
    this.onPause = options.onPause;

    this.root = document.createElement('div');
    this.root.className = 'hop-touch';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `
      <button type="button" class="hop-touch-pause" data-pause aria-label="Pause">❚❚</button>
      <div class="hop-touch-left" aria-label="Move">
        <div class="hop-joystick" data-joystick role="group" aria-label="Drag to move">
          <div class="hop-joystick-knob"></div>
        </div>
      </div>
      <div class="hop-touch-right" aria-label="Actions">
        <button type="button" class="hop-touch-btn hop-touch-sprint" data-action="sprint" aria-label="Sprint">RUN</button>
        <button type="button" class="hop-touch-btn hop-touch-jump" data-action="jump" aria-label="Jump">JUMP</button>
      </div>
    `;

    // Prevent browser gestures / text selection / context menu on the pad
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('pointerdown', this.onPointerDown);
    this.root.addEventListener('pointermove', this.onPointerMove);
    this.root.addEventListener('pointerup', this.onPointerUp);
    this.root.addEventListener('pointercancel', this.onPointerUp);
    this.root.addEventListener('pointerleave', this.onPointerLeave);
    this.root.addEventListener('lostpointercapture', this.onLostCapture);

    parent.appendChild(this.root);

    // First real touch on the page → prefer showing pads (hybrid laptops)
    window.addEventListener('touchstart', this.onAnyTouch, { passive: true, once: true });
    window.addEventListener('resize', this.onResize);
    this.refreshVisibility();
  }

  /** True when device likely needs on-screen controls. */
  static prefersTouch(): boolean {
    if (typeof window === 'undefined') return false;
    if ('ontouchstart' in window) return true;
    if (navigator.maxTouchPoints > 0) return true;
    try {
      if (window.matchMedia('(pointer: coarse)').matches) return true;
      if (window.matchMedia('(hover: none)').matches) return true;
    } catch {
      /* ignore */
    }
    // Narrow screens on LAN phones often report fine pointer incorrectly
    return window.innerWidth <= 900;
  }

  setPlaying(playing: boolean): void {
    this.visible = playing;
    this.refreshVisibility();
    if (!playing) this.releaseAll();
  }

  /** Force show/hide (debug); normally driven by setPlaying + prefersTouch. */
  setForceShow(force: boolean): void {
    this.forceShow = force;
    this.refreshVisibility();
  }

  private refreshVisibility(): void {
    const show = this.visible && (this.forceShow || TouchControls.prefersTouch());
    this.root.classList.toggle('is-visible', show);
    this.root.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (!show) this.releaseAll();
  }

  private onAnyTouch = (): void => {
    this.forceShow = true;
    this.refreshVisibility();
  };

  private onResize = (): void => {
    this.refreshVisibility();
  };

  private actionFromTarget(target: EventTarget | null): Action | 'pause' | null {
    const el = (target as HTMLElement | null)?.closest?.('[data-action], [data-pause]') as
      | HTMLElement
      | null;
    if (!el) return null;
    if (el.hasAttribute('data-pause')) return 'pause';
    const a = el.getAttribute('data-action');
    return isTouchAction(a) ? a : null;
  }

  private onPointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    const stick = target?.closest?.('[data-joystick]') as HTMLElement | null;
    if (stick) {
      e.preventDefault();
      e.stopPropagation();
      this.joystickPointer = e.pointerId;
      this.joystickElement = stick;
      stick.setPointerCapture?.(e.pointerId);
      this.updateJoystick(e.clientX);
      return;
    }
    const action = this.actionFromTarget(e.target);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();

    if (action === 'pause') {
      this.onPause?.();
      return;
    }

    const btn = (e.target as HTMLElement).closest('.hop-touch-btn') as HTMLElement | null;
    btn?.classList.add('is-active');
    btn?.setPointerCapture?.(e.pointerId);

    this.pointerActions.set(e.pointerId, action);
    this.input.setAction(action, true);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.joystickPointer === e.pointerId) {
      this.joystickPointer = null;
      this.joystickElement?.classList.remove('is-active');
      this.joystickElement?.querySelector('.hop-joystick-knob')?.setAttribute('style', '');
      this.joystickElement = null;
      this.input.setAction('left', false);
      this.input.setAction('right', false);
    }
    this.releasePointer(e.pointerId, e.target);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.joystickPointer !== e.pointerId) return;
    e.preventDefault();
    this.updateJoystick(e.clientX);
  };

  private updateJoystick(clientX: number): void {
    const stick = this.joystickElement;
    if (!stick) return;
    const rect = stick.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const dx = Math.max(-1, Math.min(1, (clientX - center) / (rect.width * 0.34)));
    const knob = stick.querySelector('.hop-joystick-knob') as HTMLElement | null;
    if (knob) knob.style.transform = `translateX(${dx * 28}px)`;
    stick.classList.add('is-active');
    this.input.setAction('left', dx < -0.18);
    this.input.setAction('right', dx > 0.18);
  }

  private onPointerLeave = (e: PointerEvent): void => {
    // Only release if we were tracking this pointer on a button
    if (!this.pointerActions.has(e.pointerId)) return;
    this.releasePointer(e.pointerId, e.target);
  };

  private onLostCapture = (e: PointerEvent): void => {
    if (this.joystickPointer === e.pointerId) {
      this.joystickPointer = null;
      this.joystickElement?.querySelector('.hop-joystick-knob')?.setAttribute('style', '');
      this.joystickElement?.classList.remove('is-active');
      this.joystickElement = null;
      this.input.setAction('left', false);
      this.input.setAction('right', false);
    }
    this.releasePointer(e.pointerId, e.target);
  };

  private releasePointer(pointerId: number, target: EventTarget | null): void {
    const action = this.pointerActions.get(pointerId);
    if (!action) return;
    this.pointerActions.delete(pointerId);

    const btn = (target as HTMLElement | null)?.closest?.('.hop-touch-btn') as HTMLElement | null;
    btn?.classList.remove('is-active');

    // Keep action held if another finger is still on the same action
    let stillHeld = false;
    for (const a of this.pointerActions.values()) {
      if (a === action) {
        stillHeld = true;
        break;
      }
    }
    if (!stillHeld) this.input.setAction(action, false);
  }

  private releaseAll(): void {
    for (const action of this.pointerActions.values()) {
      this.input.setAction(action, false);
    }
    this.pointerActions.clear();
    this.joystickPointer = null;
    this.joystickElement?.querySelector('.hop-joystick-knob')?.setAttribute('style', '');
    this.joystickElement?.classList.remove('is-active');
    this.joystickElement = null;
    this.root.querySelectorAll('.hop-touch-btn.is-active').forEach((el) => {
      el.classList.remove('is-active');
    });
    // Belt and braces: clear every bindable action so none can stick held when
    // the pads hide mid-press (pause, level change, losing the pointer).
    for (const action of TOUCH_ACTIONS) {
      this.input.setAction(action, false);
    }
  }

  dispose(): void {
    this.releaseAll();
    window.removeEventListener('touchstart', this.onAnyTouch);
    window.removeEventListener('resize', this.onResize);
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerup', this.onPointerUp);
    this.root.removeEventListener('pointercancel', this.onPointerUp);
    this.root.removeEventListener('pointerleave', this.onPointerLeave);
    this.root.removeEventListener('lostpointercapture', this.onLostCapture);
    this.root.remove();
  }
}
