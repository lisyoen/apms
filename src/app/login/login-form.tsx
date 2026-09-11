"use client";
import { FormEvent, useEffect, useState } from "react"; import { useRouter } from "next/navigation"; import styles from "./login.module.css"; import { loginOptionState } from "./login-options";

const EMAIL_KEY = "dirigo.login.email";
const PASSWORD_KEY = "dirigo.login.password";
const REMEMBER_KEY = "dirigo.login.remember";

// Base64 only obscures the password from casual viewing; it is not encryption.
function encodePassword(value: string) { return btoa(String.fromCharCode(...new TextEncoder().encode(value))); }
function decodePassword(value: string) { return new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0))); }

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [remember, setRemember] = useState(false);
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
        setRemember(localStorage.getItem(REMEMBER_KEY) === "true");
      }
    } catch {
      localStorage.removeItem(EMAIL_KEY);
      localStorage.removeItem(PASSWORD_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, remember }) });
    if (response.ok) {
      if (saveCredentials) {
        localStorage.setItem(EMAIL_KEY, email);
        localStorage.setItem(PASSWORD_KEY, encodePassword(password));
        localStorage.setItem(REMEMBER_KEY, String(remember));
      } else {
        localStorage.removeItem(EMAIL_KEY);
        localStorage.removeItem(PASSWORD_KEY);
        localStorage.removeItem(REMEMBER_KEY);
      }
      router.push("/dashboard"); router.refresh(); return;
    }
    const body = await response.json().catch(() => ({})); setError(body.error ?? "로그인에 실패했습니다."); setBusy(false);
  }

  return <form onSubmit={submit} className={styles.form}>
    <label>이메일<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>비밀번호<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    <label className={styles.checkbox}><input name="saveCredentials" type="checkbox" checked={saveCredentials} onChange={(event) => {
      const next = loginOptionState(event.target.checked, remember, "saveCredentials");
      setSaveCredentials(next.saveCredentials); setRemember(next.remember);
    }} />ID/PW 저장 — 이 브라우저에 이메일·비밀번호를 저장해 자동 입력합니다(공용 PC 사용 금지)</label>
    <label className={`${styles.checkbox} ${styles.dependentCheckbox}`} title={!saveCredentials ? "ID/PW 저장을 먼저 선택해야 자동 로그인을 사용할 수 있습니다." : undefined}><input name="remember" type="checkbox" checked={remember} disabled={!saveCredentials} onChange={(event) => {
      const next = loginOptionState(saveCredentials, event.target.checked, "remember");
      setSaveCredentials(next.saveCredentials); setRemember(next.remember);
    }} />자동 로그인 — 30일 동안 로그인 상태를 유지합니다(미체크 시 24시간)</label>
    <p className={styles.credentialsNotice}>비밀번호는 Base64로 난독화될 뿐 암호화되지 않습니다.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
  </form>;
}
