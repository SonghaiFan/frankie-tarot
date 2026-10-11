import type { ComponentPropsWithoutRef } from "react";

/**
 * A native button with a glass surface inspired by the supplied Bencho reference.
 * Narrow inner-edge lighting adds thickness around a clear, unpainted center.
 * This CSS treatment blurs the live backdrop; it does not reproduce the demo's
 * photograph-based shader refraction or require a separate image texture.
 */
export function GlassBubble({
  children,
  className = "",
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button type={type} className={`glass-bubble ${className}`} {...props}>
      <span className="glass-bubble-content">{children}</span>
    </button>
  );
}
