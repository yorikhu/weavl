import { Coins } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import styles from "./page.module.scss";

const MARKET_ITEMS = [
  { title: "35mm 胶片质感调色 Skill", type: "Skill", author: "ColorLab", uses: "14.2k", price: 0, desc: "模拟柯达经典暖调胶片颗粒与色散" },
  { title: "电商服装高转化分镜 Prompt", type: "Prompt", author: "Weavl 官方", uses: "32.8k", price: 20, desc: "精准控制服装特写、材质光泽与动态走秀" },
  { title: "4K 人物皮肤超分辨率重绘", type: "Skill", author: "PixelMaster", uses: "8.9k", price: 50, desc: "保持五官一致性下的微距毛孔与高光修复" },
  { title: "国风水墨意境粒子流动", type: "Prompt", author: "墨客", uses: "19.1k", price: 0, desc: "传统水墨晕染与现代 3D 深度光影结合" },
  { title: "自动生成双语字幕与配音 Skill", type: "Skill", author: "AudioGen", uses: "27.4k", price: 10, desc: "智能对齐唇形与专业旁白合成" },
  { title: "赛博朋克霓虹夜景工作流", type: "Prompt", author: "NeoTokyo", uses: "11.5k", price: 30, desc: "雨夜地面反射、全息霓虹与暗部细节增强" },
] as const;

export default function MarketPage() {
  return (
    <AppShell>
      <div className={styles.container}>
        <div>
          <h2 className={styles.title}>织光资源市场 (Market)</h2>
          <p className={styles.sub}>精选高质感提示词 (Prompts) 与垂直工程技能 (Skills)</p>
        </div>

        <div className={styles.grid}>
          {MARKET_ITEMS.map((item) => (
            <div key={item.title} className={styles.card}>
              <div>
                <div className={styles.cardHead}>
                  <span className={item.type === "Skill" ? styles.tagSkill : styles.tagPrompt}>
                    {item.type}
                  </span>
                  <span className={styles.price}>
                    {item.price > 0 && <Coins size={12} />}
                    {item.price > 0 ? `${item.price} 积分` : "免费"}
                  </span>
                </div>
                <h4 className={styles.cardTitle}>{item.title}</h4>
                <p className={styles.cardDesc}>{item.desc}</p>
              </div>

              <div className={styles.cardFoot}>
                <span>{item.author} · {item.uses} 次使用</span>
                <button className={styles.useBtn}>立即使用</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
