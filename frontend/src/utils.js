/**
 * Capitalizes the first letter of a given string.
 * @param {string} string - Input string
 * @returns {string} Formatted string with first letter uppercase
 */
export const capitalizeFirstLetter = (string) => {
    if (!string) return "";
    return string.charAt(0).toUpperCase() + string.slice(1);
}