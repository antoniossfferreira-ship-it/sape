
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('GLOBAL_APP_ERROR:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-destructive/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-destructive/10 p-3 rounded-full">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Ocorreu um Erro</CardTitle>
          <CardDescription>
            Não foi possível carregar esta parte do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground bg-muted/30 p-4 rounded-md mx-6 mb-6 font-mono break-all">
          {error.message || "Erro inesperado em tempo de execução."}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => reset()} variant="default" className="flex-1 gap-2">
            <RefreshCw className="h-4 w-4" /> Tentar Novamente
          </Button>
          <Button asChild variant="outline" className="flex-1 gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" /> Ir para Início
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
