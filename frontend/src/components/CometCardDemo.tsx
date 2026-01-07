import { CometCard } from "@/components/ui/comet-card";

export function CometCardDemo({ title, count }: { title: string; count: number }) {
  return (
    <CometCard className="my-4 w-48">
      <div
        className="flex h-full cursor-pointer flex-col items-start gap-2 rounded-[16px] bg-[#1F2121] px-5 py-4 text-white shadow-lg"
        style={{ transformStyle: "preserve-3d" }}
      >
        <p className="text-sm text-gray-300">{title}</p>
        <div className="text-4xl font-semibold leading-none text-gray-100">{count}</div>
        <p className="text-xs text-gray-400">Updated recently</p>
      </div>
    </CometCard>
  );
}