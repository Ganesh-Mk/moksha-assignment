import { Navbar } from '@/components/layout/Navbar'
import { Hero } from '@/components/sections/Hero'
import { NewLaunch } from '@/components/sections/NewLaunch'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <NewLaunch />
      </main>
    </>
  )
}
