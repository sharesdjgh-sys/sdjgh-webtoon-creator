import type { Metadata } from "next";
import { Black_Han_Sans, Gaegu, Instrument_Serif, Jua, Nanum_Myeongjo, Nanum_Pen_Script, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({ weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-webtoon-clean", display: "swap", preload: false });
const nanumMyeongjo = Nanum_Myeongjo({ weight: ["400", "700", "800"], variable: "--font-webtoon-serif", display: "swap", preload: false });
const nanumPen = Nanum_Pen_Script({ weight: "400", variable: "--font-webtoon-handwritten", display: "swap", preload: false });
const jua = Jua({ weight: "400", variable: "--font-webtoon-cute", display: "swap", preload: false });
const gaegu = Gaegu({ weight: ["300", "400", "700"], variable: "--font-webtoon-comic", display: "swap", preload: false });
const blackHanSans = Black_Han_Sans({ weight: "400", variable: "--font-webtoon-impact", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "웹툰 메이커 AI — AI와 함께 완성하는 나만의 웹툰",
  description: "AI 멘토와 함께 웹툰 창작 대회를 준비하세요. 아이디어 발굴부터 대회 제출까지 6단계로 완성합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${instrumentSerif.variable} ${notoSansKr.variable} ${nanumMyeongjo.variable} ${nanumPen.variable} ${jua.variable} ${gaegu.variable} ${blackHanSans.variable} h-full`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
