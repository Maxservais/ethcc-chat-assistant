import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { catalog } from "./json-render-catalog";

/**
 * Component registry mapping catalog definitions to shadcn/ui React implementations.
 * Used client-side by `<Renderer>` to render json-render specs.
 */
const componentImpls = {
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
