import Header from './components/Header'
import RSDashboard from './pages/RSDashboard'

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-[#0A0A0C] text-white overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <RSDashboard />
      </div>
    </div>
  )
}
