"use client";

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { api, setUnauthorizedHandler } from "@/lib/api";

interface AuthContextValue {
    authenticated: boolean;
    passwordConfigured: boolean;
    ready: boolean;
    login: (password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [authenticated, setAuthenticated] = useState(false);
    const [passwordConfigured, setPasswordConfigured] = useState(true);
    const [ready, setReady] = useState(false);

    // 会话失效时由 api 客户端回调，直接关门，无需各组件传递回调
    useEffect(() => {
        setUnauthorizedHandler(() => setAuthenticated(false));
        return () => setUnauthorizedHandler(null);
    }, []);

    useEffect(() => {
        api.me()
            .then((state) => {
                setAuthenticated(state.authenticated);
                setPasswordConfigured(state.passwordConfigured);
            })
            .catch(() => setAuthenticated(false))
            .finally(() => setReady(true));
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            authenticated,
            passwordConfigured,
            ready,
            login: async (password) => {
                await api.login(password);
                setAuthenticated(true);
            },
            logout: async () => {
                await api.logout().catch(() => undefined);
                setAuthenticated(false);
            },
        }),
        [authenticated, passwordConfigured, ready],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth 必须在 <AuthProvider> 内使用");
    return context;
}
