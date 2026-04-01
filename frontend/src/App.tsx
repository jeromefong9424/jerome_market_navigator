import Header from './components/Header'
import RSDashboard from './pages/RSDashboard'

export default function App() {
  return (
    <div className="flex flex-col bg-[#0A0A0C] text-white min-h-screen">
      <Header />
      <div className="flex flex-1">
        <RSDashboard />
      </div>
    </div>
  )
}
