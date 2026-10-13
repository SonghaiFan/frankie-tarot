import React from "react";
import { ArrowRight } from "lucide-react";
import { GlassBubble } from "./GlassBubble";

interface CircleActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

/** The app's primary action: the home page's round glass button, with its label beneath. */
const CircleActionButton: React.FC<CircleActionButtonProps> = ({ label, onClick, disabled = false, icon, className = "" }) => (
  <div className={`flex flex-col items-center gap-4 ${className}`}>
    <GlassBubble
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="group size-16 text-white md:size-[72px]"
    >
      {icon ?? <ArrowRight size={20} strokeWidth={1} className="transition-transform duration-500 group-hover:translate-x-0.5" />}
    </GlassBubble>
    <span aria-hidden="true" className={`pl-[0.42em] text-[11px] font-light tracking-[0.42em] ${disabled ? "text-white/30" : "text-white/80"}`}>
      {label}
    </span>
  </div>
);

export default CircleActionButton;
