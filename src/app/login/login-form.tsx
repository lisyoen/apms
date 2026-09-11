"use client";
import { FormEvent, useEffect, useState } from "react"; import { useRouter } from "next/navigation"; import styles from "./login.module.css";

const EMAIL_KEY = "dirigo.login.email";
const PASSWORD_KEY = "dirigo.login.password";

// Base64 only obscures the password from casual viewing; it is not encryption.
function encodePassword(value: string) { return btoa(String.fromCharCode(...new TextEncoder().encode(value))); }
function decodePassword(value: string) { return new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0))); }

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(EMAIL_KEY);
      const savedPassword = localStorage.getItem(PASSWORD_KEY);
      if (savedEmail !== null && savedPassword !== null) {
        setEmail(savedEmail);
        setPassword(decodePassword(savedPassword));
        setSaveCredentials(true);
      }
    } catch {
      localStorage.removeItem(EMAIL_KEY);
      localStorage.removeItem(PASSWORD_KEY);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (response.ok) {
      if (saveCredentials) {
        localStorage.setItem(EMAIL_KEY, email);
        localStorage.setItem(PASSWORD_KEY, encodePassword(password));
      } else {
        localStorage.removeItem(EMAIL_KEY);
        localStorage.removeItem(PASSWORD_KEY);
      }
      router.push("/dashboard"); router.refresh(); return;
    }
    const body = await response.json().catch(() => ({})); setError(body.error ?? "로그인에 실패했습니다."); setBusy(false);
  }

  return <form onSubmit={submit} className={styles.form}>
    <label>이메일<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>비밀번호<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    <label className={styles.checkbox}><input name="saveCredentials" type="checkbox" checked={saveCredentials} onChange={(event) => setSaveCredentials(event.target.checked)} />ID/PW 저장</label>
    <p className={styles.credentialsNotice}>체크하면 이 브라우저에 이메일과 비밀번호가 저장됩니다. 공용 PC 에서는 사용하지 마세요. 비밀번호는 Base64로 난독화될 뿐 암호화되지 않습니다.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
  </form>;
}
