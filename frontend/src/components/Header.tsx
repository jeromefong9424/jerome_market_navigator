import { BarChart2 } from 'lucide-react'

export default function Header() {
  return (
    <header className="flex-shrink-0 relative">
      <div className="flex items-center px-5 py-2.5 bg-[#0B0B0D]">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#3B82F6]/10 border border-[#3B82F6]/20">
            <BarChart2 size={13} className="text-[#3B82F6]" />
          </div>
          <span className="text-white font-semibold text-[13px] tracking-tight">Jerome Market Navigator</span>
          <span className="text-[8px] font-mono text-zinc-700 border border-white/[0.06] rounded px-1.5 py-0.5 uppercase tracking-widest">RS</span>
        </div>
      </div>
      {/* Gradient accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#3B82F6]/40 to-transparent" />
    </header>
  )
}
