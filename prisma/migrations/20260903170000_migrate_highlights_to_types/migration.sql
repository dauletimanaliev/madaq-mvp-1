-- Add the semantic type without changing or deleting existing highlight rows.
CREATE TYPE "HighlightType" AS ENUM ('protein', 'carbohydrate', 'fat', 'vitamin', 'fiber');

ALTER TABLE "highlights"
ADD COLUMN "type" "HighlightType",
ADD COLUMN "legacy_color" TEXT;

-- Only mappings whose semantics are explicitly known are applied. Pink is
-- preserved as an unclassified legacy value rather than guessed as a new type.
UPDATE "highlights"
SET "type" = CASE "color"
  WHEN 'yellow' THEN 'fat'::"HighlightType"
  WHEN 'green' THEN 'vitamin'::"HighlightType"
  WHEN 'blue' THEN 'fiber'::"HighlightType"
  ELSE NULL
END,
"legacy_color" = CASE
  WHEN "color" = 'pink' THEN 'pink'
  ELSE NULL
END;

ALTER TABLE "highlights" DROP COLUMN "color";
DROP TYPE "HighlightColor";
