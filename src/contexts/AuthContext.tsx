import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: 'admin' | 'diretor' | 'coordenacao' | 'atendimento';
    privileges: string[];
    unit_id: string;
    is_active: boolean;
}

interface Unit {
    id: string;
    name: string;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    units: Unit[];
    activeUnitId: string | null;
    setActiveUnitId: (id: string) => void;
    isLoading: boolean;
    signOut: () => Promise<void>;
    logAction: (action: string, entity: string, entityId?: string, details?: any) => Promise<void>;
    hasPrivilege: (priv: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 8 hours in milliseconds
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [units, setUnits] = useState<Unit[]>([]);
    const [activeUnitId, setActiveUnitIdState] = useState<string | null>(
        () => localStorage.getItem('activeUnitId')
    );

    const setActiveUnitId = (id: string) => {
        localStorage.setItem('activeUnitId', id);
        setActiveUnitIdState(id);
    };
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const signOut = async () => {
        await logAction('user_logout', 'auth');
        await supabase.auth.signOut();
        navigate('/login');
    };

    const logAction = async (action: string, entity: string, entityId?: string, details?: any) => {
        if (!user || (!profile && action !== 'login_success')) return;
        try {
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                user_name: profile?.full_name || user.email,
                action,
                entity,
                entity_id: entityId,
                details,
            });
        } catch (err) {
            console.error('Failed to log action:', err);
        }
    };

    useEffect(() => {
        // Initial session fetch - refresh first to ensure JWT claims are current
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) {
                // Refresh to get latest JWT claims from the hook
                const { data: refreshData } = await supabase.auth.refreshSession();
                const freshSession = refreshData?.session || session;
                setSession(freshSession);
                setUser(freshSession.user);
                fetchProfileAndUnits(freshSession.user.id);
            } else {
                setSession(null);
                setUser(null);
                setIsLoading(false);
            }
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (event === 'SIGNED_IN') {
                if (session) fetchProfileAndUnits(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                setProfile(null);
                setUnits([]);
                setActiveUnitIdState(null);
                setIsLoading(false);
            } else if (event === 'TOKEN_REFRESHED') {
                // Keep session alive
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    // Activity timeout logic
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const resetTimeout = () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (session) {
                timeoutId = setTimeout(() => {
                    toast.error('Sua sessão expirou. Faça login novamente.');
                    signOut();
                }, SESSION_TIMEOUT);
            }
        };

        // Events to track activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

        if (session) {
            resetTimeout();
            events.forEach((event) => window.addEventListener(event, resetTimeout));
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach((event) => window.removeEventListener(event, resetTimeout));
        };
    }, [session, signOut]);

    const fetchProfileAndUnits = async (userId: string) => {
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            // If no profile exists, try to create from invite data
            if (profileError && profileError.code === 'PGRST116') {
                const created = await createProfileFromInvite(userId);
                if (!created) {
                    toast.error('Perfil não encontrado. Verifique se o convite foi aceito.');
                    await supabase.auth.signOut();
                    return;
                }
                // Retry fetching the newly created profile
                // Force JWT refresh so the hook injects user_role and user_unit_ids
                await supabase.auth.refreshSession();
                return fetchProfileAndUnits(userId);
            }

            if (profileError) throw profileError;

            if (!profileData.is_active) {
                toast.error('Sua conta foi desativada.');
                await supabase.auth.signOut();
                return;
            }

            setProfile(profileData);

            // Fetch units depending on role.
            if (profileData.role === 'admin') {
                const { data: adminUnits } = await supabase.from('units').select('*').order('sort_order');
                setUnits(adminUnits || []);
                if (adminUnits && adminUnits.length > 0) {
                    const saved = localStorage.getItem('activeUnitId');
                    const validSaved = saved && adminUnits.some((u: any) => u.id === saved);
                    setActiveUnitId(validSaved ? saved : adminUnits[0].id);
                }
            } else {
                const { data: userUnits } = await supabase
                    .from('user_units')
                    .select('unit_id, units(id, name)')
                    .eq('user_id', userId);

                if (userUnits) {
                    const mappedUnits = userUnits.map((uu: any) => uu.units);
                    setUnits(mappedUnits);
                    if (mappedUnits.length > 0) {
                        const saved = localStorage.getItem('activeUnitId');
                        const validSaved = saved && mappedUnits.some((u: any) => u.id === saved);
                        setActiveUnitId(validSaved ? saved : mappedUnits[0].id);
                    }
                }
            }

        } catch (error) {
            console.error('Error fetching profile:', error);
            toast.error('Erro ao carregar perfil do usuário.');
        } finally {
            setIsLoading(false);
        }
    };

    const createProfileFromInvite = async (userId: string): Promise<boolean> => {
        try {
            // Get user metadata (full_name, invite_token_id set during signUp)
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const fullName = user.user_metadata?.full_name;
            const email = user.email;

            if (!email) return false;

            // Find the used invite token for this email
            const { data: inviteToken, error: inviteError } = await supabase
                .from('invite_tokens')
                .select('*')
                .eq('email', email)
                .eq('status', 'used')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (inviteError || !inviteToken) return false;

            // Create or update profile silently ignoring unique constraint (409)
            const { error: profileInsertError } = await supabase.from('profiles').upsert({
                id: userId,
                full_name: fullName || inviteToken.full_name || email,
                email: email,
                role: inviteToken.role,
                privileges: [],
                unit_id: inviteToken.unit_id,
                is_active: true
            }, { onConflict: 'id' });

            if (profileInsertError) {
                console.error('Profile insert error:', profileInsertError);
                return false;
            }

            // Create user_units
            await supabase.from('user_units').upsert({
                user_id: userId,
                unit_id: inviteToken.unit_id
            }, { onConflict: 'user_id,unit_id' });

            // Audit log
            await supabase.from('audit_logs').insert({
                user_id: userId,
                user_name: fullName || inviteToken.full_name || email,
                action: 'user_invite_completed',
                entity: 'auth',
                details: { email, role: inviteToken.role }
            });

            return true;
        } catch (err) {
            console.error('Error creating profile from invite:', err);
            return false;
        }
    };

    const hasPrivilege = (priv: string): boolean => {
        if (!profile) return false;
        return profile.role === priv || (profile.privileges || []).includes(priv);
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                profile,
                units,
                activeUnitId,
                setActiveUnitId,
                isLoading,
                signOut,
                logAction,
                hasPrivilege
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
