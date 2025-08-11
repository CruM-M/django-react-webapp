import axios from "axios";

/**
 * Axios instance for API communication with CSRF protection.
 *
 * Features:
 * - Sets the base URL from environment variable
 * - Includes credentials (cookies) in all requests
 * - Adds CSRF token header for POST, PUT, DELETE requests
 *
 * @constant
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
});

/**
 * Axios request interceptor to attach CSRF token for state-changing requests.
 *
 * @param {Object} config - Axios request configuration
 * @returns {Object} Modified Axios request configuration with
 * CSRF token header
 */
api.interceptors.request.use(config => {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken && ["post", "put", "delete"].includes(config.method)) {
        config.headers["X-CSRFToken"] = csrfToken;
    }
    return config;
});

/**
 * Retrieves a cookie value by name.
 *
 * @param {string} name - Name of the cookie
 * @returns {string|undefined} Value of the cookie, or undefined if not found
 */
function getCookie(name) {
    const value = `${document.cookie}`;
    const parts = value.split(`${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}

export default api;