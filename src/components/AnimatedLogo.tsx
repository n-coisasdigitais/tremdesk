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
      {/* Animated SVG Train Icon - Boxy/Square Style */}
      <div className="relative flex-shrink-0">
        <svg
          width={config.svg}
          height={config.svg}
          viewBox="0 0 48 48"
          fill="none"
          className="train-svg"
        >
          {/* Main cabin body - square */}
          <rect
            x="6"
            y="14"
            width="24"
            height="18"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="none"
            style={{ animationDelay: '0s' }}
          />
          
          {/* Front engine block - square */}
          <rect
            x="30"
            y="18"
            width="12"
            height="14"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="none"
            style={{ animationDelay: '0.15s' }}
          />
          
          {/* Chimney - square */}
          <rect
            x="12"
            y="4"
            width="6"
            height="10"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="none"
            style={{ animationDelay: '0.25s' }}
          />
          
          {/* Animated Smoke puffs */}
          <g className="smoke-animation">
            <rect
              x="13"
              y="-2"
              width="4"
              height="4"
              rx="0.5"
              className="smoke-puff smoke-puff-1"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <rect
              x="10"
              y="-5"
              width="3"
              height="3"
              rx="0.5"
              className="smoke-puff smoke-puff-2"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <rect
              x="17"
              y="-6"
              width="3.5"
              height="3.5"
              rx="0.5"
              className="smoke-puff smoke-puff-3"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </g>
          
          {/* Window 1 - square */}
          <rect
            x="10"
            y="18"
            width="6"
            height="6"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '0.5s' }}
          />
          
          {/* Window 2 - square */}
          <rect
            x="20"
            y="18"
            width="6"
            height="6"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '0.6s' }}
          />
          
          {/* Front headlight - square */}
          <rect
            x="34"
            y="21"
            width="4"
            height="4"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '0.7s' }}
          />
          
          {/* Base line / track */}
          <path
            d="M2 38H46"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
            style={{ animationDelay: '0.85s' }}
          />
          
          {/* Wheel 1 - square-ish (slightly rounded) */}
          <rect
            x="10"
            y="32"
            width="8"
            height="8"
            rx="2"
            className={`train-path wheel ${animationPhase === 'drawing' ? 'animate-draw-circle' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '1s' }}
          />
          
          {/* Wheel 2 - square-ish */}
          <rect
            x="32"
            y="32"
            width="8"
            height="8"
            rx="2"
            className={`train-path wheel ${animationPhase === 'drawing' ? 'animate-draw-circle' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ animationDelay: '1.1s' }}
          />
          
          {/* Wheel 1 center */}
          <rect
            x="12"
            y="34"
            width="4"
            height="4"
            className={`train-fill ${animationPhase === 'drawing' ? 'animate-fade-in-delayed' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '1.2s' }}
          />
          
          {/* Wheel 2 center */}
          <rect
            x="34"
            y="34"
            width="4"
            height="4"
            className={`train-fill ${animationPhase === 'drawing' ? 'animate-fade-in-delayed' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '1.3s' }}
          />
          
          {/* Cowcatcher - angular */}
          <path
            d="M42 32H46V38H42"
            className={`train-path ${animationPhase === 'drawing' ? 'animate-draw-line' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            fill="none"
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
        {/* Main cabin body - square */}
        <rect
          x="6"
          y="14"
          width="24"
          height="18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Front engine block - square */}
        <rect
          x="30"
          y="18"
          width="12"
          height="14"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Chimney - square */}
        <rect
          x="12"
          y="4"
          width="6"
          height="10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Smoke puffs - square */}
        <rect x="13" cy="0" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <rect x="9" y="-3" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1" fill="none" />
        
        {/* Windows - square */}
        <rect x="10" y="18" width="6" height="6" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="20" y="18" width="6" height="6" stroke="currentColor" strokeWidth="2" fill="none" />
        
        {/* Front headlight */}
        <rect x="34" y="21" width="4" height="4" stroke="currentColor" strokeWidth="2" fill="none" />
        
        {/* Base line */}
        <path d="M2 38H46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
        
        {/* Wheels - square-ish */}
        <rect x="10" y="32" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="32" y="32" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        
        {/* Wheel centers */}
        <rect x="12" y="34" width="4" height="4" fill="currentColor" />
        <rect x="34" y="34" width="4" height="4" fill="currentColor" />
        
        {/* Cowcatcher */}
        <path
          d="M42 32H46V38H42"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill="none"
        />
      </svg>
      <span className={`font-bold tracking-tight ${config.text}`}>Trem Desk</span>
    </div>
  );
}
