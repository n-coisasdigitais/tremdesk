import { useState, useEffect } from 'react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
  onAnimationComplete?: () => void;
}

export function AnimatedLogo({ size = 'md', showAnimation = true, onAnimationComplete }: AnimatedLogoProps) {
  const [animationPhase, setAnimationPhase] = useState<'train' | 'text' | 'complete'>(
    showAnimation ? 'train' : 'complete'
  );

  useEffect(() => {
    if (!showAnimation) {
      setAnimationPhase('complete');
      return;
    }

    // Train animation duration
    const trainTimer = setTimeout(() => {
      setAnimationPhase('text');
    }, 1500);

    // Text reveal animation
    const textTimer = setTimeout(() => {
      setAnimationPhase('complete');
      onAnimationComplete?.();
    }, 2500);

    return () => {
      clearTimeout(trainTimer);
      clearTimeout(textTimer);
    };
  }, [showAnimation, onAnimationComplete]);

  const sizeClasses = {
    sm: { container: 'h-8', train: 'w-6 h-6', text: 'text-lg' },
    md: { container: 'h-10', train: 'w-8 h-8', text: 'text-xl' },
    lg: { container: 'h-16', train: 'w-12 h-12', text: 'text-3xl' },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-2 overflow-hidden ${currentSize.container}`}>
      {/* Train with smoke animation */}
      <div className="relative">
        <div
          className={`relative transition-transform duration-1000 ease-out ${
            animationPhase === 'train' ? 'animate-train-move' : ''
          }`}
        >
          {/* Smoke particles */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <div className={`smoke-container ${animationPhase !== 'complete' ? 'animate-smoke' : ''}`}>
              <span className="smoke-particle smoke-1">💨</span>
              <span className="smoke-particle smoke-2">💨</span>
              <span className="smoke-particle smoke-3">💨</span>
            </div>
          </div>
          
          {/* Train emoji/icon */}
          <span className={`${currentSize.train} flex items-center justify-center`}>
            🚂
          </span>
        </div>
      </div>

      {/* Text reveal */}
      <div
        className={`font-bold tracking-tight overflow-hidden transition-all duration-500 ${currentSize.text} ${
          animationPhase === 'train' 
            ? 'w-0 opacity-0' 
            : 'w-auto opacity-100'
        }`}
      >
        <span className={`inline-block ${animationPhase === 'text' ? 'animate-text-reveal' : ''}`}>
          Trem Desk
        </span>
      </div>
    </div>
  );
}

// Static version for places where animation isn't needed
export function StaticLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: { train: 'text-lg', text: 'text-lg' },
    md: { train: 'text-xl', text: 'text-xl' },
    lg: { train: 'text-3xl', text: 'text-3xl' },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      <span className={currentSize.train}>🚂</span>
      <span className={`font-bold tracking-tight ${currentSize.text}`}>Trem Desk</span>
    </div>
  );
}
