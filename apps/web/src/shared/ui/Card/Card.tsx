import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  /** Adds hover elevation for cards that act as a click target. */
  interactive?: boolean;
}

export function Card({ padding = 'md', interactive = false, className, ...rest }: CardProps) {
  const classes = [
    styles.card,
    styles[`padding-${padding}`],
    interactive ? styles.interactive : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes} {...rest} />;
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.header, className].filter(Boolean).join(' ')} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={[styles.title, className].filter(Boolean).join(' ')} {...rest} />;
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={[styles.description, className].filter(Boolean).join(' ')} {...rest} />;
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.content, className].filter(Boolean).join(' ')} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.footer, className].filter(Boolean).join(' ')} {...rest} />;
}
