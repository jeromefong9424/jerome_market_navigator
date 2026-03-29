import { BarChart2 } from 'lucide-react'

export default function Header() {
  return (
    <header className="flex-shrink-0 flex items-center px-4 py-2 border-b border-[#1A1A1A] bg-[#0D0D0F]">
      <div className="flex items-center gap-1.5">
        <BarChart2 size={15} className="text-[#3B82F6]" />
        <span className="text-white font-bold text-sm tracking-tight">Jerome Market Navigator</span>
      </div>
    </header>
  )
}
