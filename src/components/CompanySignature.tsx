import Image from "next/image";

type Props = {
  className?: string;
};

export default function CompanySignature({ className = "" }: Props) {
  return (
    <div
      aria-label="기획·개발: 인생교수의 AI 연구소"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <span className="whitespace-nowrap text-[8px] font-medium tracking-[0.12em] text-[#8E8795]">기획·개발</span>
      <Image
        src="/branding/lifeprofessor-logo.png"
        width={399}
        height={67}
        alt="인생교수의 AI 연구소"
        className="h-auto w-[118px] opacity-55"
      />
    </div>
  );
}
