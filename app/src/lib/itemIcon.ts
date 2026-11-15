import { Beef, CakeSlice, ChefHat, CookingPot, CupSoda, Drumstick, HandPlatter, Salad, Sandwich, Soup, Utensils, UtensilsCrossed, Wheat, type LucideIcon } from 'lucide-react'

const BY_CATEGORY: [RegExp, LucideIcon][] = [
  [/مشروب/, CupSoda],
  [/حلو/, CakeSlice],
  [/سلط/, Salad],
  [/شورب|فت/, Soup],
  [/مقبلات|ساندو/, Sandwich],
  [/شواي|صوان|عزائم/, HandPlatter],
  [/طواجن|طاس|روستو|بدوي/, CookingPot],
  [/مندي/, ChefHat],
  [/جانبي/, Wheat],
  [/رئيسي/, UtensilsCrossed],
  [/مشوي|مشاوي/, Beef],
]

/** The drawn sign of an item until its photo arrives: chicken for poultry, otherwise from its category. */
export function itemIcon(name: string, category: string): LucideIcon {
  if (/فراخ|فرخة|دجاج|حمام|بط|ديك|طاووق/.test(name)) return Drumstick
  return BY_CATEGORY.find(([re]) => re.test(category))?.[1] ?? Utensils
}

