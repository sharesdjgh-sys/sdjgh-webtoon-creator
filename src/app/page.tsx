import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, BookOpen, Monitor, PenTool, Sparkles } from "lucide-react";
import HomeProjectPanel from "@/components/home/HomeProjectPanel";
import styles from "@/components/home/home.module.css";
import { STEPS } from "@/lib/utils";
import { CREATION_GUIDE } from "@/lib/creationGuide";
import CompanySignature from "@/components/CompanySignature";

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="웹툰 메이커 AI 첫 페이지">
          <span className={styles.brandMark}><PenTool size={21} /></span>
          웹툰 메이커 <span className={styles.aiTag}>AI</span>
        </Link>
        <nav aria-label="주 메뉴" className={styles.nav}>
          <a href="#process">만드는 과정</a>
          <Link href="/guide">제작 가이드</Link>
          <a href="#workspace">내 작업 이어가기</a>
          <Link href="/dashboard" className={styles.navCta}>작업실 열기 <ArrowRight size={15} /></Link>
        </nav>
      </header>

      <main>
        <section className={styles.cover} aria-labelledby="cover-title">
          <div className={styles.coverTop}><span>상상이 작품이 되는 곳</span><span><Monitor size={13} /> PC 전용 창작 스튜디오</span></div>
          <div className={styles.coverGrid}>
            <div className={styles.coverCopy}>
              <p className={styles.chapter}>프롤로그 / 나의 첫 웹툰</p>
              <h1 id="cover-title">머릿속 이야기,<br /><em>첫 컷</em>이 되다.</h1>
              <p className={styles.coverDescription}>상상만 하던 주인공과 세계를 꺼내보세요.<br />기획부터 대본, 콘티와 작화까지.<br />AI 멘토와 함께, 완성은 나의 손으로.</p>
              <div className={styles.coverActions}>
                <Link href="/dashboard" className={styles.startButton}>내 웹툰 만들기 <ArrowRight size={19} /></Link>
                <a href="#workspace" className={styles.resumeLink}>만들던 이야기 이어가기 <ArrowDown size={14} /></a>
              </div>
              <div className={styles.copyNote}><span aria-hidden="true">✳</span><p>거창한 시작은 필요 없어요.<br /><strong>떠오르는 한 장면이면 충분해요.</strong></p></div>
            </div>
            <figure className={styles.coverArt}>
              <Image src="/landing/creator-world.png" alt="스케치를 그리는 손에서 시작해 주인공과 상상 속 도시로 이어지는 세 컷의 웹툰 일러스트" fill sizes="(max-width: 1200px) 57vw, 760px" loading="eager" className={styles.heroImage} />
              <span className={styles.artLabel}>상상에서, 장면으로.</span>
              <figcaption>서비스 소개용 AI 일러스트</figcaption>
            </figure>
          </div>
          <div className={styles.coverBottom}><span>기획 노트에서 마지막 말풍선까지</span><span>지금, 당신의 이야기가 시작됩니다. <ArrowDown size={15} /></span></div>
        </section>

        <section id="process" className={styles.process} aria-labelledby="process-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.chapter}>01 / 만드는 과정</p><h2 id="process-title">한 컷씩, 완성에 가까워져요.</h2></div>
            <Link href="/guide">단계별 제작 가이드 <ArrowRight size={16} /></Link>
          </div>
          <ol className={styles.stepStrip}>
            {STEPS.map((step, index) => <li key={step.route}>
              <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.label}</h3>
              <p>{CREATION_GUIDE[step.route].desc}</p>
            </li>)}
          </ol>
        </section>

        <section id="workspace" className={styles.workspace} aria-labelledby="workspace-title">
          <div className={styles.workspaceNotes}>
            <p className={styles.chapter}>02 / 나의 작업실</p>
            <h2 id="workspace-title">다음 장면이<br /><span>기다리고 있어요.</span></h2>
            <p className={styles.workspaceDescription}>쓰던 대본도, 그리던 주인공도 그대로.<br />내 작품의 다음 단계에서 다시 시작하세요.</p>
            <div className={styles.editorNote}>
              <span className={styles.notePin} aria-hidden="true" />
              <BookOpen size={22} />
              <h3>이야기의 결정권은 작가에게.</h3>
              <p>AI는 아이디어와 초안을 제안해요.<br />어떤 이야기를 만들지는 내가 정해요.</p>
            </div>
            <div className={styles.mentorLine}><Sparkles size={19} /><p><strong>막히는 순간에는 AI 멘토와</strong><br />기획 · 캐릭터 · 세계관 · 대본 · 콘티</p></div>
          </div>
          <div className={styles.workspacePanel}><HomeProjectPanel /></div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div><p className={styles.chapter}>다음 화의 작가는, 당신</p><h2 id="closing-title">읽고 싶은 이야기를<br />직접 만들어보세요.</h2></div>
          <Link href="/dashboard" className={styles.startButton}>첫 컷 시작하기 <ArrowRight size={20} /></Link>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerCopy}><span>웹툰 메이커 AI</span><p>당신의 상상에, 다음 장면을.</p></div>
        <CompanySignature />
        <span className={styles.footerCopyright}>© 2026</span>
      </footer>
    </div>
  );
}
