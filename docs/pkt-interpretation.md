# API-owned PKT interpretation

Frankie API owns the 78-card historical meanings, editorial Chinese summaries, modern extensions, Celtic Cross definition and bilingual full interpretation templates. Frankie consumes `/api/v1/spreads?revision=pkt-1911-v1` and the card catalog; it does not define its own PKT card meanings or Celtic rules.

The canonical audit is `../frankie-tarot-api/docs/pkt-audit.md`. The exact supplied 1911 text is published by Frankie API at `/resources/pkt.txt`. Every card's `source.pkt` identifies the edition, SHA-256 and independent upright/reversed line references. `modernMeanings` preserves the previous project interpretations. Existing artwork and modern spreads remain intact.

## Reading continuity

New readings freeze the returned bilingual spread definition, interpretation profile and dataset version as `spreadDefinition` in the private version-1 snapshot. Picked and dealt cards already contain their orientation-specific meanings; these stay saved rather than being replaced from a refreshed catalog. A restored snapshot uses its definition even before the API loads. Pre-versioned readings use Frankie API's `legacyDefinition`; new tables capture the current API definition. Language changes localize the same frozen definition.

Frankie API keeps legacy spread semantics as the REST/MCP default for older clients; the explicit revision enables PKT semantics. Deploy Frankie API first, then Frankie. Until Frankie API is updated, older API responses still use the compatibility prompt in Frankie.

## Interpretation paths

Open AI and explicit MCP interpretation use the frozen API profile: poetic reading, then detailed analysis, including actual positions, orientations, historical sources and separately identified modern extensions. Personal knowledge is allowed only when actually available and relevant; the template distinguishes known facts, outdated context and interpretation. Brief MCP summaries retain their short output contract and omit full template instructions to avoid competing formats.

Validation covers all 156 historical English meaning references, source hash, retained modern meanings/art identities, corrected Celtic geometry, legacy/current REST revision selection, cold recovery, language changes, catalog replacement and literal user-text template substitution. Chinese meanings are editorial summaries, not a claim of an authoritative translation. Production rollout and real-device acceptance are separate from local validation.
