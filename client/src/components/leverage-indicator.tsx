import type { LeverageRiskLevel } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap } from "lucide-react";

interface LeverageIndicatorProps {
  leverage: number;
  riskLevel: LeverageRiskLevel;
  orderId: string;
}

const riskConfig = {
  minimal: {
    color: 'bg-leverage-minimal text-white',
    label: 'Low Risk',
    icon: null,
  },
  moderate: {
    color: 'bg-leverage-moderate text-white',
    label: 'Moderate',
    icon: Zap,
  },
  high: {
    color: 'bg-leverage-high text-white',
    label: 'High Risk',
    icon: AlertTriangle,
  },
  extreme: {
    color: 'bg-leverage-extreme text-white',
    label: 'Extreme',
    icon: AlertTriangle,
  },
};

export function LeverageIndicator({ leverage, riskLevel, orderId }: LeverageIndicatorProps) {
  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span 
          className="text-2xl font-mono font-bold"
          data-testid={`text-leverage-${orderId}`}
        >
          {leverage}x
        </span>
      </div>
      
      <Badge 
        className={`${config.color} text-xs no-default-hover-elevate no-default-active-elevate`}
        data-testid={`badge-risk-${orderId}`}
      >
        {config.label}
      </Badge>
    </div>
  );
}
