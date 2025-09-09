'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/app/components/ui/botton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    image?: string;
  } | null;
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const isAuthenticated = !!user;

  return (
    <header className="border-b bg-white sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-slate-800">
          ALX Polly
        </Link>
        
        <nav className="hidden md:flex items-center space-x-6">
          {isAuthenticated ? (
            <>
              <Link 
                href="/polls" 
                className={`text-slate-600 hover:text-slate-900 ${pathname === '/polls' ? 'font-medium text-slate-900' : ''}`}
              >
                My Polls
              </Link>
              <Link 
                href="/create" 
                className={`text-slate-600 hover:text-slate-900 ${pathname === '/create' ? 'font-medium text-slate-900' : ''}`}
              >
                Create Poll
              </Link>
            </>
          ) : (
            <>
              <Link 
                href="/login" 
                className={`text-slate-600 hover:text-slate-900 ${pathname === '/login' ? 'font-medium text-slate-900' : ''}`}
              >
                Login
              </Link>
              <Link 
                href="/register" 
                className={`text-slate-600 hover:text-slate-900 ${pathname === '/register' ? 'font-medium text-slate-900' : ''}`}
              >
                Register
              </Link>
            </>
          )}
        </nav>
        
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <Button asChild variant="outline" className="hidden md:inline-flex">
                <Link href="/create">Create Poll</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      {user.image ? (
                        <AvatarImage src={user.image} alt={user.name} />
                      ) : (
                        <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                      )}
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/profile" className="w-full">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/settings" className="w-full">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/login" className="w-full">Logout</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild>
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}