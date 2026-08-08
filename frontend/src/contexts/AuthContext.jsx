import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState
} from "react";

import apiClient from "../api/apiClient";

const AuthContext = createContext(null);

function getStoredUser() {
    const storedUser =
        localStorage.getItem("auth_user");

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch {
        localStorage.removeItem("auth_user");
        return null;
    }
}

export function AuthProvider({
    children
}) {
    const [user, setUser] = useState(
        getStoredUser
    );

    const [accessToken, setAccessToken] =
        useState(
            () =>
                localStorage.getItem(
                    "access_token"
                )
        );

    const [
        isAuthChecking,
        setIsAuthChecking
    ] = useState(true);

    const saveAuthSession = ({
        token,
        authenticatedUser = null
    }) => {
        localStorage.setItem(
            "access_token",
            token
        );

        setAccessToken(token);

        if (authenticatedUser) {
            localStorage.setItem(
                "auth_user",
                JSON.stringify(
                    authenticatedUser
                )
            );

            setUser(authenticatedUser);
        }

        setIsAuthChecking(false);
    };

    const clearAuthSession = () => {
        localStorage.removeItem(
            "access_token"
        );

        localStorage.removeItem(
            "refresh_token"
        );

        localStorage.removeItem(
            "auth_user"
        );

        setAccessToken(null);
        setUser(null);
        setIsAuthChecking(false);
    };
    const logout = async () => {
    const refreshToken =
        localStorage.getItem(
            "refresh_token"
        );

    try {
        if (refreshToken) {
            await apiClient.post(
                "/auth/logout",
                {
                    refreshToken
                }
            );
        }
    } finally {
        clearAuthSession();
    }
};

    useEffect(() => {
        let isMounted = true;

        const validateSession =
            async () => {
                const token =
                    localStorage.getItem(
                        "access_token"
                    );

                if (!token) {
                    if (isMounted) {
                        setAccessToken(null);
                        setUser(null);
                        setIsAuthChecking(false);
                    }

                    return;
                }

                try {
                    const response =
                        await apiClient.get(
                            "/auth/profile"
                        );

                    const authenticatedUser =
                        response.data?.user;

                    if (!authenticatedUser) {
                        throw new Error(
                            "Authenticated user was not returned."
                        );
                    }

                    localStorage.setItem(
                        "auth_user",
                        JSON.stringify(
                            authenticatedUser
                        )
                    );

                    if (isMounted) {
    setAccessToken(
        localStorage.getItem(
            "access_token"
        )
    );

    setUser(
        authenticatedUser
    );
}
                } catch {
                    localStorage.removeItem(
                        "access_token"
                    );

                    localStorage.removeItem(
                        "refresh_token"
                    );

                    localStorage.removeItem(
                        "auth_user"
                    );

                    if (isMounted) {
                        setAccessToken(null);
                        setUser(null);
                    }
                } finally {
                    if (isMounted) {
                        setIsAuthChecking(false);
                    }
                }
            };

        validateSession();

        return () => {
            isMounted = false;
        };
    }, []);

    const value = useMemo(
        () => ({
            user,
            accessToken,
            isAuthChecking,

            isAuthenticated:
                Boolean(
                    accessToken &&
                    user
                ),

            saveAuthSession,
            clearAuthSession,
            logout
        }),
        [
            user,
            accessToken,
            isAuthChecking
        ]
    );

    return (
        <AuthContext.Provider
            value={value}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context =
        useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider."
        );
    }

    return context;
}

export default AuthContext;