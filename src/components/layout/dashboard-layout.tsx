"use client";

import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  useAuth,
  useUser,
  useDoc,
  useMemoFirebase,
  useFirestore,
} from "@/firebase";
import { signOut } from "firebase/auth";
import { doc } from "firebase/firestore";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  FileCheck,
  GraduationCap,
  ClipboardCheck,
  Loader2,
  Terminal,
  Menu,
} from "lucide-react";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect } from "react";

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

function MobileHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <Button variant="ghost" size="icon" onClick={toggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-white">
          <Image
            src="/logo-uneb.png"
            alt="Logo da UNEB"
            fill
            className="object-contain p-1"
            priority
          />
        </div>

        <span className="truncate font-semibold text-primary">SAPE</span>
      </div>
    </div>
  );
}

function SidebarNavLink({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigate = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={
          isActive
            ? "bg-primary text-white hover:bg-primary hover:text-white"
            : "text-slate-700 hover:bg-slate-100 hover:text-primary"
        }
      >
        <Link
          href={href}
          className="flex items-center gap-2"
          onClick={handleNavigate}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarLogoutButton({ onLogout }: { onLogout: () => Promise<void> }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = async () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    await onLogout();
  };

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={handleClick}
    >
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const shouldShowSidebar = pathname !== "/dashboard";

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/auth");
    }
  }, [user, isUserLoading, router]);

  const userDocRef = useMemoFirebase(() => {
    if (isUserLoading || !user || !db) return null;
    return doc(db, "users", user.uid);
  }, [user, db, isUserLoading]);

  const { data: profile } = useDoc(userDocRef);

  const handleLogout = async () => {
    try {
      router.replace("/auth");
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  const navItems = [
    { name: "Início", href: "/dashboard", icon: LayoutDashboard },
    { name: "Contexto de Trabalho", href: "/dashboard/context", icon: Settings },
    {
      name: "Autoavaliação",
      href: "/dashboard/assessment",
      icon: ClipboardCheck,
    },
    {
      name: "Recomendações",
      href: "/dashboard/recommendations",
      icon: GraduationCap,
    },
    {
      name: "Cursos Realizados",
      href: "/dashboard/completed",
      icon: FileCheck,
    },
    { name: "Diagnóstico", href: "/dashboard/diagnostic", icon: Terminal },
  ];

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const sidebarContent = (
    <Sidebar className="[&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-slate-200 [&_[data-sidebar=sidebar]]:bg-white [&_[data-sidebar=sidebar]]:text-slate-900">
      <SidebarContent className="bg-white p-4 text-slate-900">
        <div className="mb-6 flex items-start gap-3 px-2">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white">
            <Image
              src="/logo-uneb.png"
              alt="Logo da UNEB"
              fill
              className="object-contain p-1"
              priority
            />
          </div>

          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-lg font-bold text-primary">
              SAPE
            </span>
            <span className="text-xs text-slate-500">
              Sistema de Aprendizagem Personalizada
            </span>
          </div>
        </div>

        <div className="mb-4 border-b border-slate-200 px-2 pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-primary/20">
              <AvatarFallback className="bg-primary text-white">
                {profile?.nome?.charAt(0) ||
                  user.email?.charAt(0).toUpperCase() ||
                  "U"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {profile?.nome || "Usuário"}
              </p>
              <p className="truncate text-xs text-slate-500">
                {profile?.cargo || ""}
              </p>
              {profile?.matricula && (
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                  Matrícula: {profile.matricula}
                </p>
              )}
            </div>
          </div>
        </div>

        <SidebarMenu className="mt-2">
          {navItems.map((item) => (
            <SidebarNavLink
              key={item.name}
              href={item.href}
              icon={item.icon}
              label={item.name}
              isActive={pathname === item.href}
            />
          ))}
        </SidebarMenu>

        <div className="mt-auto border-t border-slate-200 pt-4">
          <SidebarLogoutButton onLogout={handleLogout} />
        </div>
      </SidebarContent>
    </Sidebar>
  );

  if (!shouldShowSidebar) {
    return (
      <SidebarProvider>
        <div className="min-h-screen bg-background">
          <main className="p-6 md:p-10">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {sidebarContent}

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader />

          <main className="flex-1 overflow-auto p-6 md:p-10">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}