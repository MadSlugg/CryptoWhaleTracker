import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface HighRiskAlertProps {
  count: number;
}

export function HighRiskAlert({ count }: HighRiskAlertProps) {
  return (
    <Alert 
      className="border-leverage-extreme bg-leverage-extreme/10" 
      data-testid="alert-high-risk"
    >
      <AlertTriangle className="h-4 w-4 text-leverage-extreme" />
      <AlertDescription className="ml-2">
        <span className="font-bold text-leverage-extreme">High Risk Alert: </span>
        <span className="text-foreground">
          {count} position{count !== 1 ? 's' : ''} detected with 25x+ leverage
        </span>
      </AlertDescription>
    </Alert>
  );
}
