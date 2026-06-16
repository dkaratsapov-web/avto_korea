"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export type AccordionItem = {
  q: string;
  a: string;
};

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <h3 className="m-0 text-[18px] normal-case">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-[18px] text-left font-body text-[17px] font-bold text-ink transition-colors hover:text-bordeaux sm:px-6"
              >
                {item.q}
                <Plus
                  className={`h-5 w-5 flex-none text-steel transition-transform duration-200 ${
                    isOpen ? "rotate-45 text-bordeaux" : ""
                  }`}
                />
              </button>
            </h3>
            <div
              className={`grid transition-all duration-200 ${
                isOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-2 sm:px-6">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
