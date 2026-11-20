import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useDropdownContext } from './useDropdownContext';
import styles from './Dropdown.module.css';

export interface DropdownItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  destructive?: boolean;
}

export function DropdownItem({
  icon,
  destructive = false,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: DropdownItemProps) {
  const { close } = useDropdownContext();

  return (
    <button
      type={type}
      role="menuitem"
      tabIndex={-1}
      className={[styles.item, destructive ? styles.itemDestructive : null, className]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => {
        onClick?.(event);
        close();
      }}
      {...rest}
    >
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      {children}
    </button>
  );
}
