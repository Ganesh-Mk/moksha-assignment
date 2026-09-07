import { Navbar } from '@/components/layout/Navbar'
import { BenefitCards } from '@/components/sections/BenefitCards'
import { BrandKeyVisual } from '@/components/sections/BrandKeyVisual'
import { ProductShowcase } from '@/components/sections/ProductShowcase'
import { Hero } from '@/components/sections/Hero'
import { NewLaunch } from '@/components/sections/NewLaunch'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <NewLaunch />
        <BrandKeyVisual />
        <BenefitCards />
        <ProductShowcase />
      </main>
    </>
  )
}
