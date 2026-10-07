import type { MotionValue } from "motion/react";

/**
 * What stands over the sea and should appear in it. The home page's card
 * registers itself here while it floats above the water; the sea reads it
 * each frame, so the reflection leaves with the card.
 */
export interface ReflectionSubject {
  /** The card's painted face. */
  canvas: HTMLCanvasElement;
  /** Its current rotation in degrees. */
  rotate: MotionValue<number>;
}

let subject: ReflectionSubject | null = null;

export const setReflectionSubject = (next: ReflectionSubject | null) => {
  subject = next;
};

export const getReflectionSubject = () => subject;
