import { cloneElement, useId, useState } from 'react';
import type { FocusEvent, MouseEvent, ReactElement, ReactNode } from 'react';
import { useEscapeKey } from '../../hooks';
import styles from './Tooltip.module.css';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipTriggerProps {
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  'aria-describedby'?: string;
}

export interface TooltipProps {
  content: ReactNode;
  /** A single interactive element — it receives the hover/focus handlers and `aria-describedby`. */
  children: ReactElement<TooltipTriggerProps>;
  placement?: TooltipPlacement;
}

export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  const show = (): void => setIsVisible(true);
  const hide = (): void => setIsVisible(false);

  useEscapeKey(hide, isVisible);

  const trigger = cloneElement(children, {
    'aria-describedby': isVisible ? tooltipId : undefined,
    onMouseEnter: (event: MouseEvent) => {
      children.props.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: MouseEvent) => {
      children.props.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: FocusEvent) => {
      children.props.onFocus?.(event);
      show();
    },
    onBlur: (event: FocusEvent) => {
      children.props.onBlur?.(event);
      hide();
    },
  });

  return (
    <span className={styles.wrapper}>
      {trigger}
      {isVisible && (
        <span
          role="tooltip"
          id={tooltipId}
          className={[styles.tooltip, styles[placement]].join(' ')}
        >
          {content}
        </span>
      )}
    </span>
  );
}
