import { useState, useEffect } from 'react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
  onAnimationComplete?: () => void;
}

export function AnimatedLogo({ size = 'md', showAnimation = true, onAnimationComplete }: AnimatedLogoProps) {
  const [animationPhase, setAnimationPhase] = useState<'drawing' | 'complete'>(
    showAnimation ? 'drawing' : 'complete'
  );

  useEffect(() => {
    if (!showAnimation) {
      setAnimationPhase('complete');
      return;
    }

    // Animation completes after drawing
    const timer = setTimeout(() => {
      setAnimationPhase('complete');
      onAnimationComplete?.();
    }, 2200);

    return () => clearTimeout(timer);
  }, [showAnimation, onAnimationComplete]);

  const sizeConfig = {
    sm: { svg: 28, text: 'text-lg', container: 'h-8' },
    md: { svg: 36, text: 'text-xl', container: 'h-10' },
    lg: { svg: 52, text: 'text-3xl', container: 'h-16' },
  };

  const config = sizeConfig[size];

  return (
    <div className={`flex items-center gap-3 ${config.container}`}>
      {/* Animated SVG Train Icon */}
      <div className="relative flex-shrink-0">
        <svg
          width={config.svg}
          height={config.svg}
          viewBox="0 0 48 48"
          fill="none"
          className="train-svg"
        >
          {/* Main body */}
          <path
            d="M8 32V18C8 14 11 12 14 12H34C37 12 40 14 40 18V32"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animationDelay: '0s' }}
          />
          
          {/* Roof curve */}
          <path
            d="M12 12C12 12 18 8 24 8C30 8 36 12 36 12"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animationDelay: '0.15s' }}
          />
          
          {/* Chimney */}
          <path
            d="M16 8V4"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ animationDelay: '0.25s' }}
          />
          
          {/* Animated Smoke puffs */}
          <g className="smoke-animation">
            <circle
              cx="16"
              cy="1"
              r="1.5"
              className="smoke-puff smoke-puff-1"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="14"
              cy="0"
              r="1"
              className="smoke-puff smoke-puff-2"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="18"
              cy="-1"
              r="1.2"
              className="smoke-puff smoke-puff-3"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </g>
          
          {/* Windows */}
          <rect
            x="14"
            y="18"
            width="6"
            height="6"
            rx="1"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '0.5s' }}
          />
          <rect
            x="28"
            y="18"
            width="6"
            height="6"
            rx="1"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '0.6s' }}
          />
          
          {/* Front panel detail */}
          <path
            d="M22 20V26"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ animationDelay: '0.7s' }}
          />
          <path
            d="M26 20V26"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ animationDelay: '0.75s' }}
          />
          
          {/* Base line */}
          <path
            d="M4 36H44"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ animationDelay: '0.85s' }}
          />
          
          {/* Wheels */}
          <circle
            cx="14"
            cy="36"
            r="4"
            className={`train-path wheel ${animationPhase === 'drawing' ? 'animate-draw-circle' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '1s' }}
          />
          <circle
            cx="34"
            cy="36"
            r="4"
            className={`train-path wheel ${animationPhase === 'drawing' ? 'animate-draw-circle' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '1.1s' }}
          />
          
          {/* Wheel centers */}
          <circle
            cx="14"
            cy="36"
            r="1.5"
            className={`train-fill ${animationPhase === 'drawing' ? 'animate-fade-in-delayed' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '1.2s' }}
          />
          <circle
            cx="34"
            cy="36"
            r="1.5"
            className={`train-fill ${animationPhase === 'drawing' ? 'animate-fade-in-delayed' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '1.3s' }}
          />
          
          {/* Cowcatcher */}
          <path
            d="M40 32L44 36L40 36"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animationDelay: '0.9s' }}
          />
        </svg>
      </div>

      {/* Text */}
      <div className={`font-bold tracking-tight ${config.text}`}>
        <span className="inline-block whitespace-nowrap">
          Trem Desk
        </span>
      </div>
    </div>
  );
}

// Static version for places where animation isn't needed
export function StaticLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeConfig = {
    sm: { svg: 24, text: 'text-lg' },
    md: { svg: 28, text: 'text-xl' },
    lg: { svg: 40, text: 'text-3xl' },
  };

  const config = sizeConfig[size];

  return (
    <div className="flex items-center gap-2">
      <svg
        width={config.svg}
        height={config.svg}
        viewBox="0 0 48 48"
        fill="none"
        className="text-primary"
      >
        {/* Main body */}
        <path
          d="M8 32V18C8 14 11 12 14 12H34C37 12 40 14 40 18V32"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Roof curve */}
        <path
          d="M12 12C12 12 18 8 24 8C30 8 36 12 36 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Chimney */}
        <path
          d="M16 8V4"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        
        {/* Smoke puffs */}
        <circle cx="16" cy="2" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        
        {/* Windows */}
        <rect x="14" y="18" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="28" y="18" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
        
        {/* Front panel detail */}
        <path d="M22 20V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 20V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        
        {/* Base line */}
        <path d="M4 36H44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Wheels */}
        <circle cx="14" cy="36" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="34" cy="36" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
        
        {/* Wheel centers */}
        <circle cx="14" cy="36" r="1.5" fill="currentColor" />
        <circle cx="34" cy="36" r="1.5" fill="currentColor" />
        
        {/* Cowcatcher */}
        <path
          d="M40 32L44 36L40 36"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`font-bold tracking-tight ${config.text}`}>Trem Desk</span>
    </div>
  );
}
