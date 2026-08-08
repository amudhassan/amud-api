import axios from "axios";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:3000/api";

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json"
    }
});

const refreshClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json"
    }
});

let refreshPromise = null;

const clearStoredAuth = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth_user");
};

apiClient.interceptors.request.use(
    (config) => {
        const accessToken =
            localStorage.getItem(
                "access_token"
            );

        if (accessToken) {
            config.headers.Authorization =
                `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) =>
        Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest =
            error.config;

        const status =
            error.response?.status;

        const responseMessage =
            error.response?.data?.message;

        const accessTokenRejected =
            status === 401 ||
            (
                status === 403 &&
                (
                    responseMessage ===
                        "Invalid or expired token" ||
                    responseMessage ===
                        "Invalid or expired token."
                )
            );

        const requestUrl =
            originalRequest?.url || "";

        const skipRefresh =
            requestUrl.includes(
                "/auth/login"
            ) ||
            requestUrl.includes(
                "/auth/forgot-password"
            ) ||
            requestUrl.includes(
                "/auth/reset-password"
            ) ||
            requestUrl.includes(
                "/auth/refresh-token"
            );

        if (
            !accessTokenRejected ||
            !originalRequest ||
            originalRequest._retry ||
            skipRefresh
        ) {
            return Promise.reject(
                error
            );
        }

        const refreshToken =
            localStorage.getItem(
                "refresh_token"
            );

        if (!refreshToken) {
            clearStoredAuth();

            return Promise.reject(
                error
            );
        }

        originalRequest._retry = true;

        try {
            if (!refreshPromise) {
                refreshPromise =
                    refreshClient
                        .post(
                            "/auth/refresh-token",
                            {
                                refreshToken
                            }
                        )
                        .then(
                            (response) => {
                                const {
                                    accessToken:
                                        newAccessToken,
                                    refreshToken:
                                        newRefreshToken
                                } = response.data;

                                if (
                                    !newAccessToken ||
                                    !newRefreshToken
                                ) {
                                    throw new Error(
                                        "Refresh response did not contain both tokens."
                                    );
                                }

                                localStorage.setItem(
                                    "access_token",
                                    newAccessToken
                                );

                                localStorage.setItem(
                                    "refresh_token",
                                    newRefreshToken
                                );

                                return newAccessToken;
                            }
                        )
                        .catch(
                            (
                                refreshError
                            ) => {
                                clearStoredAuth();

                                throw refreshError;
                            }
                        )
                        .finally(() => {
                            refreshPromise =
                                null;
                        });
            }

            const newAccessToken =
                await refreshPromise;

            originalRequest.headers =
                originalRequest.headers ||
                {};

            originalRequest.headers.Authorization =
                `Bearer ${newAccessToken}`;

            return apiClient(
                originalRequest
            );
        } catch (refreshError) {
            return Promise.reject(
                refreshError
            );
        }
    }
);

export default apiClient;
