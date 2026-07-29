import { useState, useEffect } from "react";
import trainIcon from "@/assets/train-icon.png";

interface AnimatedLogoProps {
  size?: "sm" | "md" | "lg";
  showAnimation?: boolean;
  onAnimationComplete?: () => void;
}

export function AnimatedLogo({ size = "md", showAnimation = true, onAnimationComplete }: AnimatedLogoProps) {
  const [animationPhase, setAnimationPhase] = useState<"initial" | "icon" | "text" | "complete">(
    showAnimation ? "initial" : "complete",
  );

  useEffect(() => {
    if (!showAnimation) {
      setAnimationPhase("complete");
      return;
    }

    // Start icon animation immediately
    const iconTimer = setTimeout(() => setAnimationPhase("icon"), 100);

    // Show text after icon
    const textTimer = setTimeout(() => setAnimationPhase("text"), 600);

    // Complete animation
    const completeTimer = setTimeout(() => {
      setAnimationPhase("complete");
      onAnimationComplete?.();
    }, 1500);

    return () => {
      clearTimeout(iconTimer);
      clearTimeout(textTimer);
      clearTimeout(completeTimer);
    };
  }, [showAnimation, onAnimationComplete]);

  const sizeConfig = {
    sm: { icon: 28, text: "text-lg", container: "h-8", gap: "gap-2" },
    md: { icon: 40, text: "text-xl", container: "h-10", gap: "gap-3" },
    lg: { icon: 56, text: "text-3xl", container: "h-16", gap: "gap-4" },
  };

  const config = sizeConfig[size];

  const isIconVisible = animationPhase !== "initial";
  const isTextVisible = animationPhase === "text" || animationPhase === "complete";

  return (
    <div className={`flex items-center ${config.gap} ${config.container}`}>
      {/* Train Icon */}
      <div
        className={`relative flex-shrink-0 transition-all duration-500 ease-out ${
          isIconVisible ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-75 -translate-x-4"
        }`}
      >
        <img src={trainIcon} alt="Rita Projetos" width={config.icon} height={config.icon} className="object-contain" />
      </div>

      {/* Text */}
      <div className={`font-bold tracking-tight ${config.text}`}>
        <span
          className={`inline-block whitespace-nowrap text-foreground transition-all duration-500 ease-out ${
            isTextVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
          }`}
        >
          Rita Projetos
        </span>
      </div>
    </div>
  );
}

// Static version for places where animation isn't needed
export function StaticLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeConfig = {
    sm: { icon: 24, text: "text-lg", gap: "gap-2" },
    md: { icon: 32, text: "text-xl", gap: "gap-2" },
    lg: { icon: 48, text: "text-3xl", gap: "gap-3" },
  };

  const config = sizeConfig[size];

  return (
    <div className={`flex items-center ${config.gap}`}>
      <img src={trainIcon} alt="Rita Projetos" width={config.icon} height={config.icon} className="object-contain" />
      <span className={`font-bold tracking-tight text-foreground ${config.text}`}>Rita Projetos</span>
    </div>
  );
}
