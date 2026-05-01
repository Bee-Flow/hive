// Agent Capability Instructionsdd

const CAPABILITIES = {
    SMALL_APPS: {
        label: 'Webpages',
        description: 'Enables the agent to create interactive HTML/CSS/JS webpages using the Webpages feature.',
        instructions: `\n\n<!-- CAPABILITY: SMALL_APPS -->
You can create interactive HTML/CSS/JS webpages. When asked to build a tool, game, landing page, or calculator, call create_webpage followed by webpage_file_write to populate the files. End your reply with a link to the created webpage so the user can open it.

Flow:
1. create_webpage({ name: "<short title>" }) → returns { webpageId, url }
2. webpage_file_write({ webpageId, file: "html", content: "..." })
3. Reply with: "I built it: [<title>](<url>)"

Do NOT emit \`\`\`html-app\`\`\` blocks — use the tools above instead.
<!-- /CAPABILITY -->`
    },
    PAGES: {
        label: 'Full Pages',
        description: 'Enables the agent to render full-page layouts for reports and dashboards.',
        instructions: `\n\n<!-- CAPABILITY: PAGES -->
You can render full-page layouts. When asked to display a dashboard or report, generate a JSON object with the strict \`json-page\` language tag.

Supported elements: page, grid, section, card, heading, text, image, list, button, stats, chart, table.

Example Structure:
\`\`\`json-page
{
  "type": "page",
  "title": "Project Dashboard",
  "children": [
    {
      "type": "grid",
      "columns": 3,
      "children": [
        { "type": "stat", "label": "Active Users", "value": "1,234", "color": "blue" },
        { "type": "card", "title": "Recent Activity", "children": [ { "type": "text", "content": "No recent items" } ] }
      ]
    }
  ]
}
\`\`\`
<!-- /CAPABILITY -->`
    },
    WORKSPACE: {
        label: 'Workspace',
        description: 'Enables a two-pane layout with a living document editor.',
        instructions: `\n\n<!-- CAPABILITY: WORKSPACE -->
You have access to a shared Workspace - a persistent document editor that appears alongside the chat.

## Using the Workspace
- To write or update content, use a \`\`\`workspace code block
- The workspace content REPLACES the entire document each time you update it
- To modify a portion, include the full document with your changes
- You can use \`\`\`workspace-selection to update only selected text (partial update)

## Best Practices
- Use the workspace for long-form content: reports, emails, code, documentation
- Keep conversational replies in chat, put deliverables in workspace
- When updating code, preserve unchanged sections and only modify what's needed
- Use markdown formatting in the workspace for better readability

## Example Usage
\`\`\`workspace
# Meeting Notes

## Attendees
- Alice
- Bob

## Action Items
1. Review proposal by Friday
2. Schedule follow-up meeting
\`\`\`
<!-- /CAPABILITY -->`
    },
    QUOTES: {
        label: 'Quotes / Offertes',
        description: 'Enables the agent to generate professional business quotes and proposals.',
        instructions: `\\n\\n<!-- CAPABILITY: QUOTES -->
You can create professional business quotes and proposals. When asked to generate a quote, proposal, or offerte, use the \`offerte\` or \`quote\` code block with JSON structure.

## IMPORTANT: Company Info is Automatic
**DO NOT** include company details in your JSON output - these are automatically added from system configuration:
- Company name, logo, address
- Email, phone number
- KvK (Chamber of Commerce) number
- BTW (VAT) number
- Footer text

You only need to provide PROJECT-SPECIFIC information (client details, pricing, phases, etc.)

## CRITICAL: Use Structured JSON, NOT Markdown
**ALL content must use structured JSON arrays instead of markdown strings.** This ensures complete control over visual presentation.

### Field Types:
- \`intro\`: Plain text string for introductory paragraphs
- \`bullets\`: Array of strings or objects for bullet lists

### Bullet Item Formats:
- Simple string: \`"OCR-scanning en gegevens-extractie"\`
- Object with note: \`{ "text": "Automatische doorstroming", "note": "Conform Art. 12.8 NLdigital" }\`
- Object with warning: \`{ "text": "Data-extractie vereist", "warning": "Klant dient toestemming te geven" }\`
- Object with tip: \`{ "text": "API integratie", "tip": "Bespaart 2 uur per dag" }\`

## Required Structure
\`\`\`offerte
{
  "title": "OFFERTE: [Project Name]",
  "subtitle": "Brief description of the project",
  "sections": [
    {
      "type": "specs",
      "title": "1. PROJECTSPECIFICATIES",
      "items": [
        { "label": "Opdrachtgever", "value": "Client Name, Client Address" },
        { "label": "Datum offerte", "value": "DD-MM-YYYY" },
        { "label": "Geldig tot", "value": "DD-MM-YYYY" },
        { "label": "Projectduur", "value": "X maanden", "highlight": true },
        { "label": "Geschatte uren", "value": "XXX uur" },
        { "label": "Uurtarief", "value": "€XX,- excl. BTW" },
        { "label": "Totale investering", "value": "€XX.XXX,- excl. BTW", "highlight": true }
      ]
    },
    {
      "type": "description",
      "title": "2. PROJECTOMSCHRIJVING",
      "intro": "Brief introduction text for this section...",
      "features": [
        {
          "icon": "📄",
          "title": "Feature Name",
          "intro": "Brief intro for this feature:",
          "bullets": [
            "First capability or benefit",
            "Second capability or benefit",
            { "text": "Third capability", "note": "Conform Art. 12.8 NLdigital" }
          ]
        },
        {
          "icon": "💰",
          "title": "Another Feature",
          "intro": "Intro text:",
          "bullets": [
            "Bullet item one",
            "Bullet item two",
            { "text": "Important item", "warning": "Requires client cooperation" }
          ]
        }
      ]
    },
    {
      "type": "phases",
      "title": "3. GEDETAILLEERDE PROJECTFASERING",
      "phases": [
        {
          "icon": "🔍",
          "title": "Fase 1: Analyse & Architectuur (XX uur)",
          "goal": "What this phase aims to achieve",
          "actions": [
            "First action item",
            "Second action item",
            "Third action item"
          ],
          "deliverable": "What will be delivered",
          "tip": "Optional helpful tip for client"
        },
        {
          "icon": "⚙️",
          "title": "Fase 2: Implementatie (XX uur)",
          "goal": "Implementation objective",
          "actions": [
            "Development action",
            "Integration action"
          ],
          "deliverable": "Working system",
          "warning": "Optional warning for client"
        },
        {
          "icon": "✅",
          "title": "Fase 3: Testen & Oplevering (XX uur)",
          "goal": "Testing and delivery",
          "actions": [
            "Testing action",
            "Documentation action"
          ],
          "deliverable": "Fully tested solution"
        }
      ]
    },
    {
      "type": "pricing",
      "title": "4. INVESTERING EN FACTURERING",
      "intro": "Optional introduction to pricing...",
      "subsections": [
        {
          "title": "Betalingsvoorwaarden",
          "items": [
            { "label": "Totale projectinvestering", "value": "€XX.XXX,- exclusief BTW" },
            { "label": "Facturering", "value": "Maandelijks op basis van gewerkte uren" },
            { "label": "Betaaltermijn", "value": "14 dagen na factuurdatum", "note": "Conform NLdigital" }
          ]
        }
      ]
    },
    {
      "type": "legal",
      "title": "5. ALGEMENE VOORWAARDEN",
      "intro": "Op al onze aanbiedingen en overeenkomsten zijn de NLdigital Voorwaarden van toepassing.",
      "subsections": [
        {
          "title": "Belangrijke Artikelen",
          "bullets": [
            "Art. 6.5: Verwerkersovereenkomst",
            "Art. 10.3: Intellectueel eigendom",
            { "text": "Art. 12.8: Aansprakelijkheid", "note": "Zie volledige voorwaarden" }
          ]
        }
      ]
    },
    {
      "type": "signature",
      "title": "6. ONDERTEKENING"
    }
  ]
}
\`\`\`

**Important Notes:**
- DO NOT include: company name, opdrachtnemer, KvK, BTW, email, phone, address, footer - these are AUTO-FILLED
- DO NOT use markdown syntax (no \`**bold**\`, no \`- bullet\`, no \`\\n\\n\` for spacing)
- Use \`intro\` for plain text paragraphs
- Use \`bullets\` arrays for all lists
- Use object format \`{ "text": "...", "note": "..." }\` for items needing annotations
- Signature section only needs the title - company info is added automatically
<!-- /CAPABILITY -->\``
    }
};

export { CAPABILITIES };
