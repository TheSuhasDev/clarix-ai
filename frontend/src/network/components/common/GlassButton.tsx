import React from 'react';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'pill' | 'glow' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  active?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'pill',
  size = 'md',
  icon,
  active = false,
  children,
  className = '',
  style,
  ...props
}) => {
  const getPadding = () => {
    switch (size) {
      case 'sm':
        return '6px 12px';
      case 'lg':
        return '12px 24px';
      case 'md':
      default:
        return '8px 18px';
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return '12px';
      case 'lg':
        return '15px';
      case 'md':
      default:
        return '13.5px';
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    if (variant === 'primary' || active) {
      return {
        background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: '0 6px 20px rgba(23, 107, 255, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.5)',
      };
    }

    if (variant === 'glow') {
      return {
        background: 'rgba(255, 255, 255, 0.85)',
        color: '#176BFF',
        border: '1px solid rgba(23, 107, 255, 0.35)',
        boxShadow: '0 4px 18px rgba(23, 107, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
      };
    }

    if (variant === 'danger') {
      return {
        background: 'linear-gradient(135deg, #F04455 0%, #FF6B7A 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.35)',
        boxShadow: '0 6px 20px rgba(240, 68, 85, 0.28)',
      };
    }

    return {
      background: 'rgba(255, 255, 255, 0.65)',
      color: '#14243B',
      border: '1px solid rgba(255, 255, 255, 0.8)',
      boxShadow: '0 2px 10px rgba(23, 107, 255, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
    };
  };

  return (
    <button
      className={`glass-button ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: '9999px',
        padding: getPadding(),
        fontSize: getFontSize(),
        fontWeight: 600,
        cursor: 'pointer',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        outline: 'none',
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
};
