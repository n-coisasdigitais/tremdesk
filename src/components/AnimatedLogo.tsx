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

    const timer = setTimeout(() => {
      setAnimationPhase('complete');
      onAnimationComplete?.();
    }, 2000);

    return () => clearTimeout(timer);
  }, [showAnimation, onAnimationComplete]);

  const sizeConfig = {
    sm: { svg: 32, text: 'text-lg', container: 'h-8' },
    md: { svg: 44, text: 'text-xl', container: 'h-10' },
    lg: { svg: 64, text: 'text-3xl', container: 'h-16' },
  };

  const config = sizeConfig[size];

  return (
    <div className={`flex items-center gap-3 ${config.container}`}>
      {/* Animated SVG Train - Modern locomotive with wagons */}
      <div className="relative flex-shrink-0">
        <svg
          width={config.svg}
          height={config.svg}
          viewBox="0 0 80 60"
          fill="none"
          className="train-svg text-primary"
        >
          {/* Locomotive Body */}
          <path
            d="M4 20 L4 44 L32 44 L32 20 L24 12 L12 12 L4 20 Z"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '0s' }}
          />
          
          {/* Cabin Windows */}
          <rect
            x="8"
            y="16"
            width="7"
            height="8"
            rx="1"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.2s' }}
          />
          <rect
            x="21"
            y="16"
            width="7"
            height="8"
            rx="1"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.25s' }}
          />
          
          {/* Headlights */}
          <circle
            cx="12"
            cy="34"
            r="4"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.3s' }}
          />
          <circle
            cx="24"
            cy="34"
            r="4"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.35s' }}
          />

          {/* Wagons in perspective - getting smaller as they go back */}
          {/* Wagon 1 */}
          <path
            d="M34 24 L34 44 L50 44 L52 26 L34 24 Z"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '0.4s' }}
          />
          <rect
            x="36"
            y="28"
            width="4"
            height="10"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.45s' }}
          />
          <rect
            x="42"
            y="28"
            width="4"
            height="10"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.5s' }}
          />
          
          {/* Wagon 2 */}
          <path
            d="M52 26 L52 44 L64 44 L66 28 L52 26 Z"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '0.55s' }}
          />
          <rect
            x="54"
            y="30"
            width="3"
            height="8"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.6s' }}
          />
          <rect
            x="59"
            y="30"
            width="3"
            height="8"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.65s' }}
          />
          
          {/* Wagon 3 (smaller) */}
          <path
            d="M66 28 L66 44 L76 44 L78 30 L66 28 Z"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '0.7s' }}
          />
          <rect
            x="68"
            y="32"
            width="3"
            height="6"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.75s' }}
          />
          <rect
            x="73"
            y="32"
            width="2"
            height="6"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="hsl(var(--background))"
            style={{ animationDelay: '0.8s' }}
          />
          
          {/* Platform base under locomotive */}
          <rect
            x="2"
            y="44"
            width="32"
            height="4"
            className={`${animationPhase === 'drawing' ? 'animate-train-draw' : ''}`}
            fill="currentColor"
            style={{ animationDelay: '0.85s' }}
          />
          
          {/* Track - Main rail */}
          <path
            d="M0 52 L42 52 L78 48"
            className={`${animationPhase === 'drawing' ? 'animate-track-draw' : ''}`}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            style={{ animationDelay: '0.9s' }}
          />
          
          {/* Track perspective line */}
          <path
            d="M0 56 L38 56 L72 52"
            className={`${animationPhase === 'drawing' ? 'animate-track-draw' : ''}`}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            style={{ animationDelay: '1s' }}
          />
        </svg>
      </div>

      {/* Text */}
      <div className={`font-bold tracking-tight ${config.text}`}>
        <span 
          className={`inline-block whitespace-nowrap text-card-foreground ${animationPhase === 'drawing' ? 'animate-text-fade-in' : ''}`}
          style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}
        >
          Trem Desk
        </span>
      </div>
    </div>
  );
}

// Static version for places where animation isn't needed
export function StaticLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeConfig = {
    sm: { svg: 28, text: 'text-lg' },
    md: { svg: 36, text: 'text-xl' },
    lg: { svg: 52, text: 'text-3xl' },
  };

  const config = sizeConfig[size];

  return (
    <div className="flex items-center gap-2">
      <svg
        width={config.svg}
        height={config.svg}
        viewBox="0 0 80 60"
        fill="none"
        className="text-primary"
      >
        {/* Locomotive Body */}
        <path
          d="M4 20 L4 44 L32 44 L32 20 L24 12 L12 12 L4 20 Z"
          fill="currentColor"
        />
        
        {/* Cabin Windows */}
        <rect x="8" y="16" width="7" height="8" rx="1" fill="hsl(var(--background))" />
        <rect x="21" y="16" width="7" height="8" rx="1" fill="hsl(var(--background))" />
        
        {/* Headlights */}
        <circle cx="12" cy="34" r="4" fill="hsl(var(--background))" />
        <circle cx="24" cy="34" r="4" fill="hsl(var(--background))" />

        {/* Wagon 1 */}
        <path d="M34 24 L34 44 L50 44 L52 26 L34 24 Z" fill="currentColor" />
        <rect x="36" y="28" width="4" height="10" fill="hsl(var(--background))" />
        <rect x="42" y="28" width="4" height="10" fill="hsl(var(--background))" />
        
        {/* Wagon 2 */}
        <path d="M52 26 L52 44 L64 44 L66 28 L52 26 Z" fill="currentColor" />
        <rect x="54" y="30" width="3" height="8" fill="hsl(var(--background))" />
        <rect x="59" y="30" width="3" height="8" fill="hsl(var(--background))" />
        
        {/* Wagon 3 */}
        <path d="M66 28 L66 44 L76 44 L78 30 L66 28 Z" fill="currentColor" />
        <rect x="68" y="32" width="3" height="6" fill="hsl(var(--background))" />
        <rect x="73" y="32" width="2" height="6" fill="hsl(var(--background))" />
        
        {/* Platform */}
        <rect x="2" y="44" width="32" height="4" fill="currentColor" />
        
        {/* Tracks */}
        <path d="M0 52 L42 52 L78 48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M0 56 L38 56 L72 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <span className={`font-bold tracking-tight text-foreground ${config.text}`}>Trem Desk</span>
    </div>
  );
}
