"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WeavlBrand } from "@/components/WeavlBrand";
import { Animation } from "@/components/Animation";
import { Form } from "@/components/Form";
import { useAuth } from "@/provider/AuthProvider";
import { useTheme } from "@/provider/ThemeProvider";
import ui from "@/styles/studio.module.scss";
import styles from "./page.module.scss";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const { theme } = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (mode === "register") await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/home");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.aeroLayer} aria-hidden="true">
        <Animation.AeroShards
          backgroundColor={theme === "dark" ? "#161618" : "#FFFFFF"}
          shardColor={theme === "dark" ? "#696973" : "#C2C7D0"}
          accentColor={theme === "dark" ? "#E4E4E7" : "#59606B"}
          placement="full"
          flow="stream"
          material="pearl"
          detail="balanced"
          effect="none"
          scale={1}
          spread={1}
          depth={1}
          speed={0.0875}
          spin={0.0875}
          interaction="repel"
          density={0.78}
          shardSize={1.1}
          stretch={1}
          turbulence={0.45}
          glow={0.65}
          edgeSoftness={2}
          bloom={0.3}
          grain={0.03}
          chromaticAberration={0}
          transitionDuration={1}
          interactionRadius={1.5}
          interactionStrength={0.25}
          rippleIntensity={0.5}
          holdToGather
        />
      </div>
      <WeavlBrand className={styles.brand} iconSize={23} />
      <div className={styles.content}>
        <div className={styles.intro}>
          <span className={ui.eyebrow}>YOUR CREATIVE WORKSPACE</span>
          <h1>
            让内容与方法，
            <br />
            彼此成就。
          </h1>
          <p>从一句想法开始，连接 Agent、画布、工作流和每一份资产。</p>
          <div className={styles.capabilityTrail} aria-label="创作能力">
            <span>01 / 对话起笔</span>
            <span>02 / 画布成形</span>
            <span>03 / 流程交付</span>
          </div>
        </div>
        <Form className={styles.form} values={form} onValuesChange={setForm} onFinish={submit}>
          <div className={styles.formHead}>
            <h2>{mode === "login" ? "欢迎回来" : "创建工作空间"}</h2>
            <p>{mode === "login" ? "继续你的创作" : "几步即可开始使用 Weavl"}</p>
          </div>
          {mode === "register" && <Form.Input name="name" label="称呼" required autoComplete="name" />}
          <Form.Input name="email" label="邮箱" type="email" required autoComplete="email" />
          <Form.Input
            name="password"
            label="密码"
            type="password"
            minLength={8}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {error && <p className={ui.error}>{error}</p>}
          <button className={ui.button} type="submit" disabled={busy}>
            {busy ? "请稍候…" : mode === "login" ? "登录工作台" : "创建账号"}
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            className={styles.switch}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "没有账号？创建一个" : "已有账号？返回登录"}
          </button>
          <p className={styles.demo}>本地演示账号：demo@weavl.local · weavl1234</p>
        </Form>
      </div>
      <Link href="/home" className={styles.back}>
        浏览产品首页 →
      </Link>
    </main>
  );
}
