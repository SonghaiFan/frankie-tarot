import React from "react";

interface SelectionTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isSelected: boolean;
}

const SelectionTile: React.FC<SelectionTileProps> = ({
  isSelected,
  className = "",
  type = "button",
  ...props
}) => (
  <button
    {...props}
    type={type}
    aria-pressed={isSelected}
    className={`group relative border text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
      isSelected
        ? "border-white/60 bg-white/5 text-white"
        : "border-white/10 text-neutral-400 hover:border-white/30"
    } ${className}`}
  />
);

export default SelectionTile;
