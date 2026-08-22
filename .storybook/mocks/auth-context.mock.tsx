import React, { createContext, useContext } from "react";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: "learner" | "teacher" | "admin";
  avatarUrl?: string;
}

interface AuthContextType {
  user: MockUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
});

export const useMockAuth = () => useContext(AuthContext);

export const MockAuthProvider = ({
  user,
  children,
}: {
  user: MockUser | null;
  children: React.ReactNode;
}) => {
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const withMockAuth = (user: MockUser | null) => {
  const AuthDecorator = (Story: React.ComponentType) => (
    <MockAuthProvider user={user}>
      <Story />
    </MockAuthProvider>
  );
  AuthDecorator.displayName = "WithMockAuth";
  return AuthDecorator;
};

export const MOCK_LEARNER_USER: MockUser = {
  id: "usr-learner-001",
  name: "Tran Minh Anh",
  email: "learner@ielts-prep.vn",
  role: "learner",
  avatarUrl:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
};

export const MOCK_TEACHER_USER: MockUser = {
  id: "usr-teacher-001",
  name: "Mr. David Harrison (IELTS 8.5)",
  email: "david.harrison@ielts-prep.vn",
  role: "teacher",
  avatarUrl:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
};
