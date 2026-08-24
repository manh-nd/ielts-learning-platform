import { SignUpView } from "@/components/auth/signup-view";

export default function SignUpPage() {
  const showGoogleOAuth = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return <SignUpView showGoogleOAuth={showGoogleOAuth} />;
}
