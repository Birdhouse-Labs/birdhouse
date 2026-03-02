// ABOUTME: TypeScript code sample for syntax highlighting demo
// ABOUTME: Demonstrates classes, generics, async/await, and type annotations

import type { CodeSample } from "./types";

export const typescript: CodeSample = {
  id: "typescript",
  name: "TypeScript",
  language: "typescript",
  description: "A coffee shop order system with generics and async patterns",
  code: `// A type-safe coffee shop that takes itself very seriously

interface MenuItem<T extends 'drink' | 'food'> {
  name: string;
  price: number;
  category: T;
  caffeineLevel?: T extends 'drink' ? 'none' | 'low' | 'medium' | 'dangerous' : never;
}

type Drink = MenuItem<'drink'>;
type Food = MenuItem<'food'>;

class CoffeeShop {
  private menu: Map<string, Drink | Food> = new Map();
  private orders: Array<{ item: string; customer: string; existentialDread: number }> = [];

  constructor(public readonly name: string) {
    this.initializeMenu();
  }

  private initializeMenu(): void {
    const drinks: Drink[] = [
      { name: 'Espresso', price: 3.50, category: 'drink', caffeineLevel: 'dangerous' },
      { name: 'Decaf', price: 3.50, category: 'drink', caffeineLevel: 'none' },
      { name: 'Cold Brew', price: 4.50, category: 'drink', caffeineLevel: 'dangerous' },
    ];

    const foods: Food[] = [
      { name: 'Mass-Produced Croissant', price: 4.00, category: 'food' },
      { name: 'Artisanal Toast', price: 8.00, category: 'food' },
    ];

    [...drinks, ...foods].forEach(item => this.menu.set(item.name, item));
  }

  async order<T extends Drink | Food>(
    itemName: string,
    customer: string
  ): Promise<T | null> {
    const item = this.menu.get(itemName) as T | undefined;
    
    if (!item) {
      console.log(\`Sorry, we're too cool for "\${itemName}"\`);
      return null;
    }

    // Simulate barista contemplating the meaning of coffee
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    this.orders.push({
      item: itemName,
      customer,
      existentialDread: Math.floor(Math.random() * 10),
    });

    return item;
  }

  getStats(): { revenue: number; averageDread: number } {
    const revenue = this.orders.reduce((sum, order) => {
      const item = this.menu.get(order.item);
      return sum + (item?.price ?? 0);
    }, 0);

    const averageDread = this.orders.length > 0
      ? this.orders.reduce((sum, o) => sum + o.existentialDread, 0) / this.orders.length
      : 0;

    return { revenue, averageDread };
  }
}

// Usage
const shop = new CoffeeShop('The Pretentious Bean');
await shop.order<Drink>('Cold Brew', 'Developer at 2am');
console.log(shop.getStats());`,
};
