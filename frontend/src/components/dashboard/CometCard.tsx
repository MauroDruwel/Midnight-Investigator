import { CometCard } from "@/components/ui/comet-card";

type CometCardProps = {
    title: string;
    value: string | number;
    subtext?: string;
};

export function CometDashboardCard({ title, value, subtext = "Updated recently" }: CometCardProps) {
    return (
        <CometCard className="my-4">
            <div
                className="flex h-32 w-52 cursor-pointer flex-col justify-between gap-1 rounded-[16px] bg-[#1F2121] px-5 py-4 text-white shadow-lg"
                style={{ transformStyle: "preserve-3d" }}
            >
                <div className="space-y-0.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">{title}</p>
                    <div className="text-2xl font-black italic tracking-tighter text-white truncate">{value}</div>
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/80 whitespace-nowrap">
                    {subtext}
                </p>
            </div>
        </CometCard>
    );
}
