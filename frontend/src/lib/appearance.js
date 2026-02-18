const APPEARANCE_STORAGE_KEY = 'appearance_preference';

function getSystemAppearance() {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveAppearance(appearance) {
    if (appearance === 'auto') {
        return getSystemAppearance();
    }
    return appearance === 'dark' ? 'dark' : 'light';
}

export function loadAppearancePreference() {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return saved === 'dark' || saved === 'auto' || saved === 'light' ? saved : 'light';
}

export function applyAppearancePreference(appearance) {
    if (typeof document === 'undefined') return;
    const resolved = resolveAppearance(appearance);
    const root = document.documentElement;
    root.setAttribute('data-appearance', resolved);
    root.style.colorScheme = resolved;
}

export function saveAppearancePreference(appearance) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
    applyAppearancePreference(appearance);
}

export function initializeAppearance() {
    const preferredAppearance = loadAppearancePreference();
    applyAppearancePreference(preferredAppearance);
}
