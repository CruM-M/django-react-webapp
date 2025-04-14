import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
});

api.interceptors.request.use(config => {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken && ["post", "put", "delete"].includes(config.method)) {
        config.headers["X-CSRFToken"] = csrfToken;
    }
    return config;
});

function getCookie(name) {
    const value = `${document.cookie}`;
    const parts = value.split(`${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}

export default api;