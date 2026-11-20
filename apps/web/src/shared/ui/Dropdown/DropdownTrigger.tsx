import type { ButtonHTMLAttributes } from 'react';
import { useDropdownContext } from './useDropdownContext';
import styles from './Dropdown.module.css';

export type DropdownTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function DropdownTrigger({
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: DropdownTriggerProps) {
  const { isOpen, open, close, triggerRef, idPrefix } = useDropdownContext();

  return (
    <button
      ref={triggerRef}
      type={type}
      id={`${idPrefix}-trigger`}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={`${idPrefix}-menu`}
      className={[styles.trigger, className].filter(Boolean).join(' ')}
      onClick={(event) => {
        onClick?.(event);
        if (isOpen) close();
        else open();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
