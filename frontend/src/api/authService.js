import apiClient from "./apiClient";

const login = async (credentials) => {
    const response = await apiClient.post(
        "/auth/login",
        credentials
    );

    return response.data;
};

const authService = {
    login
};

export default authService;