import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyEurIcon, ForkKnifeIcon, MapPinIcon } from "@phosphor-icons/react";

const CATEGORY_COLORS: Record<string, string> = {
  budget: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  "mid-range": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
  "fine dining": "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25",
  bar: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/25",
};

export interface RestaurantCardProps {
  name: string;
  category: string;
  cuisine: string | null;
  price: string | null;
  description: string | null;
  mapsUrl: string | null;
}

export function RestaurantCard({
  name,
  category,
  cuisine,
  price,
  description,
  mapsUrl,
}: RestaurantCardProps) {
  const badgeColor =
    CATEGORY_COLORS[category.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";

  return (
    <Card size="sm" className="w-full">
      <CardHeader>
        <div className="space-y-1.5 min-w-0">
          <Badge variant="outline" className={`text-[11px] font-semibold ${badgeColor}`}>
            {category}
          </Badge>
          <CardTitle className="text-base font-semibold leading-snug">{name}</CardTitle>
        </div>
        {description && (
          <CardDescription className="line-clamp-2 text-xs leading-relaxed">
            {description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {cuisine && (
          <span className="inline-flex items-center gap-1.5">
            <ForkKnifeIcon size={14} weight="bold" className="shrink-0" />
            {cuisine}
          </span>
        )}
        {price && (
          <span className="inline-flex items-center gap-1.5">
            <CurrencyEurIcon size={14} weight="bold" className="shrink-0" />
            {price}
          </span>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <MapPinIcon size={14} weight="bold" className="shrink-0" />
            View on Maps
          </a>
        )}
      </CardContent>
    </Card>
  );
}
