import Link from "next/link";
import { PriceCard } from "@/components/billing-ui";
import { BuyButton } from "@/components/pricing/buy-button";
import { type PackId, PACKS, DAILY_LIMITS } from "@/lib/domain/pricing";

const PACK_NAMES: Record<PackId, string> = { starter: "Starter", standard: "Standard", plus: "Plus" };
const FEATURED: PackId = "standard";

/** Every plan as one sheet: the free tier, then the packs, split by hairlines. Prices come from PACKS. */
export function PricingTable() {
  return (
    <div className="plate plate-grid md:grid-cols-2 xl:grid-cols-4">
      <PriceCard
        plan="Free"
        price="$0"
        period="forever, no account needed"
        allotment="Everything for learning"
        description="The whole learning product. Self-assessment is never removed or degraded."
        features={[
          "Every investigation, concept, company and mock interview",
          "Practice, progress and spaced review",
          "Your own projects, with the free model check",
        ]}
        cta={
          <Link href="/investigations" className="btn btn-secondary w-full">
            Start learning
          </Link>
        }
      />
      {PACKS.map((pack) => {
        const featured = pack.id === FEATURED;
        return (
          <PriceCard
            key={pack.id}
            featured={featured}
            band={featured ? "Recommended" : undefined}
            plan={PACK_NAMES[pack.id]}
            price={`$${pack.priceUsd}`}
            period="one-time, in USD"
            allotment={`${pack.credits} credits`}
            description={`$${(pack.priceUsd / pack.credits).toFixed(2)} per credit. Never expires, nothing renews.`}
            features={[
              `AI assessment of written answers, ${DAILY_LIMITS.grade.purchaser} a day, free`,
              "A failed AI run returns its credits",
              "Unused packs refundable within 14 days",
            ]}
            cta={<BuyButton pack={pack} name={PACK_NAMES[pack.id]} featured={featured} />}
          />
        );
      })}
    </div>
  );
}
