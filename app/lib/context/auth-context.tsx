'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { z } from 'zod';
import type { Session, User } from '@supabase/supabase-js';

// Zod schema for User (lightweight, can extend as needed)
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
});

// Zod schema for Session
const SessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().nullable(),
  user: UserSchema,
}).partial(); // Supabase may return nulls

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error fetching session:', error.message);
      }

      if (mounted) {
        const safeSession = data?.session && SessionSchema.safeParse(data.session);
        if (safeSession?.success) {
          setSession(safeSession.data as Session);
          setUser(safeSession.data.user as User);
        } else {
          setSession(null);
          setUser(null);
        }
        setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const safeSession = session && SessionSchema.safeParse(session);
        if (safeSession?.success) {
          setSession(safeSession.data as Session);
          setUser(safeSession.data.user as User);
        } else {
          setSession(null);
          setUser(null);
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error during sign out:', error.message);
      throw error;
    }
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};