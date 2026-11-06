/**
 * Maps Auth SDK errors to short Hebrew copy for users (no vendor names in strings).
 */
const LOGIN_BAD_CREDENTIALS = 'שם משתמש או סיסמא לא נכונים';

/** Auth errors sometimes only appear inside Error.message as "(auth/...)" */
export function authErrorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === 'string' && c.startsWith('auth/')) return c;
  }
  const s = e instanceof Error ? e.message : String(e);
  const m = s.match(/auth\/[a-z0-9-]+/i);
  return m ? m[0].toLowerCase() : '';
}

export function messageForAuthError(e: unknown, context: 'login' | 'register'): string {
  const code = authErrorCode(e);

  switch (code) {
    case 'auth/email-already-in-use':
      return 'שם המשתמש כבר קיים במערכת';
    case 'auth/wrong-password':
      return context === 'login' ? LOGIN_BAD_CREDENTIALS : 'הסיסמה לא מתאימה. נסו סיסמה אחרת.';
    case 'auth/user-not-found':
      return context === 'register'
        ? 'אירעה שגיאה בהרשמה — נסו שוב בעוד רגע.'
        : LOGIN_BAD_CREDENTIALS;
    case 'auth/invalid-email':
      return 'כתובת האימייל לא נראית תקינה. ודאו שיש @ ודומיין (למשל name@gmail.com).';
    case 'auth/invalid-credential':
      return context === 'login'
        ? LOGIN_BAD_CREDENTIALS
        : 'לא הצלחנו להשלים את ההרשמה. נסו שוב או התחברו אם כבר יש לכם חשבון.';
    case 'auth/account-exists-with-different-credential':
      return 'שם המשתמש כבר קיים במערכת';
    case 'auth/weak-password':
      return 'הסיסמה חלשה מדי. בחרו לפחות 6 תווים, עדיף שילוב של אותיות ומספרים.';
    case 'auth/operation-not-allowed':
      return 'כניסה במייל וסיסמה לא הופעלה בפרויקט. פנו למנהל המערכת או בדקו את הגדרות האימות.';
    case 'auth/too-many-requests':
      return 'יותר מדי ניסיונות. המתינו דקה ונסו שוב.';
    case 'auth/network-request-failed':
      return 'אין חיבור יציב לרשת. בדקו את האינטרנט ונסו שוב.';
    case 'auth/user-disabled':
      return 'החשבון הושבת. פנו לתמיכה.';
    default:
      if (code === 'auth/configuration-not-found' || String(e).includes('configuration-not-found')) {
        return 'שירות ההתחברות לא מוגדר כראוי בצד השרת. פנו למנהל המערכת.';
      }
      return 'משהו השתבש. נסו שוב עוד רגע.';
  }
}
