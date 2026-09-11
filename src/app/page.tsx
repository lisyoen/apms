import Link from "next/link";
import styles from "./page.module.css";
export default function Home() { return <main className={styles.hero}><div className={styles.mark}>D</div><p className={styles.eyebrow}>AI WORKSPACE</p><h1>Dirigo</h1><p className={styles.description}>AI-directed project management</p><Link className={styles.button} href="/login">로그인</Link></main>; }
