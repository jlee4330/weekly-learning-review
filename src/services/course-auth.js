import config from '../../config/course-auth.json';
export const courseAuthConfig = config;
export function loginEmail(identifier) {
  const value = identifier.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${config.studentEmailDomain}`;
}
export function loginError(error) {
  switch (error?.code) {
    case 'auth/invalid-credential': case 'auth/user-not-found': case 'auth/wrong-password': return 'Check your student ID or email and password, then try again.';
    case 'auth/invalid-email': return 'Enter a valid student ID or email address.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed': return 'Could not reach the login service. Check your connection and try again.';
    case 'auth/user-disabled': return 'This account has been disabled. Please contact the course team.';
    default: return 'Sign-in could not be completed. Please try again.';
  }
}
