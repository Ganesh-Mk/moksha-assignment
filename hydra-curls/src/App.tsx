import { Navbar } from '@/components/layout/Navbar'
import { BenefitCards } from '@/components/sections/BenefitCards'
import { BrandKeyVisual } from '@/components/sections/BrandKeyVisual'
import { PremiumIngredients } from '@/components/sections/PremiumIngredients'
import { ProductShowcase } from '@/components/sections/ProductShowcase'
import { Testimonials } from '@/components/sections/Testimonials'
import { Hero } from '@/components/sections/Hero'
import { HydraCurlsPromise } from '@/components/sections/HydraCurlsPromise'
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
        <HydraCurlsPromise />
        <PremiumIngredients />
        <Testimonials />
      </main>
    </>
  )
}
