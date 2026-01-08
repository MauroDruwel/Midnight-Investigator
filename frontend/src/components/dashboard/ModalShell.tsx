import { useRef, useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloseIcon } from "@/components/expandable-card-demo-standard";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { ScrollContext } from "@/hooks/use-scroll-context";

type ModalShellProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    maxWidth?: string;
};

export function ModalShell({
    open,
    onClose,
    title,
    children,
    maxWidth = "max-w-xl",
}: ModalShellProps) {
    const ref = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }

        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => {
            document.body.style.overflow = "auto";
            window.removeEventListener("keydown", handleKey);
        };
    }, [open, onClose]);

    useOutsideClick(ref, () => {
        if (open) onClose();
    });

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                    <motion.div
                        className="fixed inset-0 z-50 grid place-items-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            ref={ref}
                            className={`relative w-full ${maxWidth} max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-[#0F1012] text-white shadow-2xl`}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                        >
                            <div className="sticky top-0 z-20 flex items-center justify-between bg-[#0F1012] p-6 pb-3 rounded-t-2xl">
                                <h3 className="text-lg font-semibold">{title}</h3>
                                <button
                                    type="button"
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow hover:bg-neutral-200 transition-colors"
                                    onClick={onClose}
                                >
                                    <CloseIcon />
                                </button>
                            </div>
                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 pt-0 custom-scrollbar">
                                <ScrollContext.Provider value={scrollRef}>
                                    {children}
                                </ScrollContext.Provider>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
