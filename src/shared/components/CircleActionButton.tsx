import React from "react";
import { ArrowRight } from "lucide-react";

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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="group grid size-16 place-items-center rounded-full border border-white/45 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.16),rgba(255,255,255,0.03)_60%)] text-white backdrop-blur-md shadow-[0_0_40px_rgba(255,200,170,0.12)] transition-[border-color,box-shadow,transform,opacity] duration-500 hover:scale-105 hover:border-white/80 hover:shadow-[0_0_60px_rgba(255,200,170,0.28)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:size-[72px]"
    >
      {icon ?? <ArrowRight size={20} strokeWidth={1} className="transition-transform duration-500 group-hover:translate-x-0.5" />}
    </button>
    <span aria-hidden="true" className={`pl-[0.42em] text-[11px] font-light tracking-[0.42em] ${disabled ? "text-white/30" : "text-white/80"}`}>
      {label}
    </span>
  </div>
);

export default CircleActionButton;
