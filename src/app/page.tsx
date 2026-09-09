import Link from "next/link";
import styles from "./page.module.css";
export default function Home() { return <main className={styles.hero}><div className={styles.mark}>AP</div><p className={styles.eyebrow}>AGENTIC WORKSPACE</p><h1>APMS - Agentic Project Management System</h1><p className={styles.description}>에이전트와 함께 프로젝트를 계획하고 실행하는 관리 시스템입니다.</p><Link className={styles.button} href="/login">로그인</Link></main>; }
