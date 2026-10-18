// Navigation only. API services remain responsible for action and owner scope.
export function canAccessPath(user,pathname) {
    const section=String(pathname).split('/').filter(Boolean)[0] || 'dashboard';
    if(['dashboard','profile','settings','notifications'].includes(section))return Boolean(user);
    return Array.isArray(user?.navigation_modules) && user.navigation_modules.includes(section);
}
