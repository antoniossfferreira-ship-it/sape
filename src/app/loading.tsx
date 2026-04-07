import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="rounded-full bg-primary/10 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
      <p className="animate-pulse font-medium text-muted-foreground">
        SAPE - Carregando...
      </p>
    </div>
  );
}