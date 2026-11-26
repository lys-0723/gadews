import { LoginScreen } from "./login-screen";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string | string[] }>;
}) {
  const { entry } = await searchParams;
  return <LoginScreen entry={entry === "admin" ? "admin" : "user"} />;
}
