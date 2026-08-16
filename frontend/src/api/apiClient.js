import axios from "axios";

const apiClient = axios.create({
    baseURL:
        import.meta.env.VITE_API_BASE_URL ||
        "http://localhost:3000/api",

    headers: {
        "Content-Type": "application/json"
    }
});

apiClient.interceptors.request.use(
    (config) => {
        const accessToken =
            localStorage.getItem("access_token");

        if (accessToken) {
            config.headers.Authorization =
                `Bearer ${accessToken}`;
        }

        /*
         * File uploads use FormData. Do not force the global
         * application/json header in that case; the browser/axios
         * must generate multipart/form-data together with its boundary.
         */
        if (
            typeof FormData !== "undefined" &&
            config.data instanceof FormData
        ) {
            if (
                typeof config.headers?.delete ===
                    "function"
            ) {
                config.headers.delete(
                    "Content-Type"
                );
            } else if (config.headers) {
                delete config.headers[
                    "Content-Type"
                ];
            }
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => response,

    (error) => {
        if (
            error.response?.status === 401
        ) {
            localStorage.removeItem(
                "access_token"
            );
        }

        return Promise.reject(error);
    }
);

export default apiClient;