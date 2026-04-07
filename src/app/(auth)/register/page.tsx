"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CARGOS } from '@/app/lib/mock-data';

const NIVEIS_FORMACAO = [
  'Ensino Médio',
  'Graduação',
  'Especialização',
  'Mestrado',
  'Doutorado'
];

function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    matricula: '',
    email: '',
    password: '',
    role: '',
    educationLevel: '',
    educationArea: '',
    tenure: ''
  });

  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedData = {
      name: formData.name.trim(),
      matricula: formData.matricula.trim(),
      email: formData.email.trim(),
      password: formData.password,
      role: formData.role,
      educationLevel: formData.educationLevel,
      educationArea: formData.educationArea.trim(),
      tenure: formData.tenure.trim()
    };

    if (
      !normalizedData.name ||
      !normalizedData.matricula ||
      !normalizedData.email ||
      !normalizedData.password ||
      !normalizedData.role ||
      !normalizedData.educationLevel ||
      !normalizedData.educationArea ||
      !normalizedData.tenure
    ) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos antes de continuar.',
        variant: 'destructive'
      });
      return;
    }

    if (!isValidEmail(normalizedData.email)) {
      toast({
        title: 'E-mail inválido',
        description: 'Informe um e-mail institucional válido.',
        variant: 'destructive'
      });
      return;
    }

    if (normalizedData.password.length < 6) {
      toast({
        title: 'Senha inválida',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive'
      });
      return;
    }

    if (Number(normalizedData.tenure) < 0) {
      toast({
        title: 'Tempo de UNEB inválido',
        description: 'Informe um valor igual ou maior que zero.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      console.log('REGISTER_ATTEMPT', {
        email: normalizedData.email,
        passwordLength: normalizedData.password.length,
        role: normalizedData.role,
        educationLevel: normalizedData.educationLevel
      });

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedData.email,
        normalizedData.password
      );

      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        name: normalizedData.name,
        matricula: normalizedData.matricula,
        email: normalizedData.email,
        cargo: normalizedData.role,
        formacao: normalizedData.educationLevel,
        formacaoNivel: normalizedData.educationLevel,
        areaFormacao: normalizedData.educationArea,
        tempoUNEB: normalizedData.tenure,
        createdAt: new Date().toISOString()
      });

      toast({
        title: 'Sucesso!',
        description: 'Sua conta foi criada com sucesso.'
      });

      router.push('/dashboard/context');
    } catch (error: any) {
      console.error('REGISTER_ERROR_CODE:', error?.code);
      console.error('REGISTER_ERROR_MESSAGE:', error?.message);
      console.error('REGISTER_ERROR_FULL:', error);

      let errorMessage = 'Não foi possível criar sua conta.';

      switch (error?.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Este e-mail já está cadastrado.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'O e-mail informado é inválido.';
          break;
        case 'auth/weak-password':
          errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'O cadastro por e-mail e senha não está habilitado no Firebase Authentication.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Falha de conexão. Verifique sua internet e tente novamente.';
          break;
        default:
          errorMessage = error?.message || 'Não foi possível criar sua conta.';
      }

      toast({
        title: 'Erro no cadastro',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background py-10 px-4">
      <Card className="w-full max-w-xl shadow-lg border-primary/10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold font-headline text-primary">
            Crie sua conta
          </CardTitle>
          <CardDescription>
            Cadastre seus dados institucionais da UNEB
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleRegister}>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                required
                value={formData.matricula}
                onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail Institucional</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v })}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS.map((cargo) => (
                    <SelectItem key={cargo} value={cargo}>
                      {cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="educationLevel">Nível de Formação</Label>
              <Select
                value={formData.educationLevel}
                onValueChange={(v) => setFormData({ ...formData, educationLevel: v })}
              >
                <SelectTrigger id="educationLevel">
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  {NIVEIS_FORMACAO.map((nivel) => (
                    <SelectItem key={nivel} value={nivel}>
                      {nivel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="educationArea">Área de Formação</Label>
              <Input
                id="educationArea"
                placeholder="Ex: Educação"
                required
                value={formData.educationArea}
                onChange={(e) => setFormData({ ...formData, educationArea: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenure">Tempo de UNEB (anos)</Label>
              <Input
                id="tenure"
                type="number"
                min="0"
                required
                value={formData.tenure}
                onChange={(e) => setFormData({ ...formData, tenure: e.target.value })}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Entre aqui
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}