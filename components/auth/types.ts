export type UserRole = "learner" | "teacher";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string | null;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface PasswordCriteria {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumberOrSpecial: boolean;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Rất yếu" | "Yếu" | "Trung bình" | "Mạnh" | "Rất mạnh";
  criteria: PasswordCriteria;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const criteria: PasswordCriteria = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumberOrSpecial: /[0-9!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const count = Object.values(criteria).filter(Boolean).length;

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  let label: PasswordStrength["label"] = "Rất yếu";

  if (password.length === 0) {
    score = 0;
    label = "Rất yếu";
  } else if (count === 1) {
    score = 1;
    label = "Yếu";
  } else if (count === 2 || count === 3) {
    score = 2;
    label = "Trung bình";
  } else if (count === 4 && password.length < 12) {
    score = 3;
    label = "Mạnh";
  } else if (count === 4 && password.length >= 12) {
    score = 4;
    label = "Rất mạnh";
  }

  return { score, label, criteria };
}
