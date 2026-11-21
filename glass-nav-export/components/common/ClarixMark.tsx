import type { SVGProps } from 'react';

export interface ClarixMarkProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function ClarixMark({
  size = 22,
  width,
  height,
  className,
  ...props
}: ClarixMarkProps) {
  const w = width ?? size;
  const h = height ?? size;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
      width={w}
      height={h}
      className={className}
      {...props}
    >
      <rect x="2" y="2" width="8.5" height="8.5" rx="4.2" />
      <rect x="13.5" y="2" width="8.5" height="8.5" rx="4.2" />
      <rect x="2" y="13.5" width="8.5" height="8.5" rx="4.2" />
      <rect x="13.5" y="13.5" width="8.5" height="8.5" rx="4.2" />
    </svg>
  );
}
