import React from 'react';

type IconProps = {
  name: string;
  className?: string;
  label?: string;
};

/**
 * Material Symbols wrapper.
 *
 * Material Symbols render via ligatures, so the element's text content is the
 * literal icon name ("check_circle"). Screen readers announce that text unless
 * it is hidden. Icons are therefore hidden from assistive tech by default.
 *
 * Decorative (next to visible text):  Icon name="sync" />
 * Meaningful standalone icon:         Icon name="sync" label="Refreshing" />
 */
export function Icon({ name, className = '', label }: IconProps) {
  const baseClass = "material-symbols-outlined";
  if (label) {
    return (
      <span
        className={`${baseClass} ${className}`}
        role="img"
        aria-label={label}
      >
        {name}
      </span>
    );
  }

  return (
    <span className={`${baseClass} ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

export default Icon;
