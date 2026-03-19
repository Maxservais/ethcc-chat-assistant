import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { TalkCard } from "@/components/chat/TalkCard";
import { catalog } from "./json-render-catalog";

/**
 * Component registry mapping catalog definitions to React implementations.
 * Includes shadcn/ui components + custom EthCC components (TalkCard).
 */
const componentImpls = {
  TalkCard,
  Card: shadcnComponents.Card,
  Stack: shadcnComponents.Stack,
  Grid: shadcnComponents.Grid,
  Table: shadcnComponents.Table,
  Heading: shadcnComponents.Heading,
  Text: shadcnComponents.Text,
  Badge: shadcnComponents.Badge,
  Alert: shadcnComponents.Alert,
  Separator: shadcnComponents.Separator,
};

export const { registry } = defineRegistry(catalog, { components: componentImpls });
