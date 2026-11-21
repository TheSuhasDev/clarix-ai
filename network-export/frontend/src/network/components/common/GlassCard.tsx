import React from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'floating' | 'interactive' | 'highlight';
  glow?: 'blue' | 'cyan' | 'violet' | 'green' | 'none';
  specular?: boolean;
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'primary',
  glow = 'none',
  specular = true,
  children,
  className = '',
  style,
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'secondary':
        return 'glass-secondary';
      case 'floating':
        return 'glass-floating';
      case 'interactive':
        return 'glass-interactive';
      case 'highlight':
        return 'glass-highlight';
      case 'primary':
      default:
        return 'glass-primary';
    }
  };

  const getGlowStyle = (): React.CSSProperties => {
    switch (glow) {
      case 'blue':
        return { boxShadow: '0 12px 40px rgba(23, 107, 255, 0.16)' };
      case 'cyan':
        return { boxShadow: '0 12px 40px rgba(0, 217, 245, 0.18)' };
      case 'violet':
        return { boxShadow: '0 12px 40px rgba(129, 116, 255, 0.18)' };
      case 'green':
        return { boxShadow: '0 12px 40px rgba(22, 199, 132, 0.18)' };
      default:
        return {};
    }
  };

  return (
    <div
      className={`${getVariantClass()} ${specular ? 'specular-rim' : ''} ${className}`}
      style={{
        ...getGlowStyle(),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
