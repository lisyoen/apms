import Link from "next/link"; import LoginForm from "./login-form"; import styles from "./login.module.css";
export default function LoginPage() { return <main className={styles.page}><section className={styles.card}><Link className={styles.brand} href="/">APMS</Link><h1>로그인</h1><p>APMS 워크스페이스에 계속하려면 로그인하세요.</p><LoginForm /></section></main>; }
