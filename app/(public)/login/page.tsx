import { LoginView } from "@/components/auth/login-view";

export default function LoginPage() {
  const showGoogleOAuth = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return <LoginView showGoogleOAuth={showGoogleOAuth} />;
}
