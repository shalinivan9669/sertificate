# Design System Strategy: Premium Industrial

## 1. Overview & Creative North Star
**The Creative North Star: "The Industrial Monolith"**

This design system is built to convey the unwavering authority of a state-level certification body. We are moving away from the "generic corporate" look and toward a "Premium Industrial" aesthetic. This is where the grit of heavy engineering meets the precision of modern technology. 

To achieve this, we avoid the "template" look by utilizing **intentional asymmetry**—such as offset headers and unbalanced grid placements—and **high-contrast typography scales**. We treat the screen not as a flat canvas, but as a technical schematic: structured, layered, and purposeful.

---

## 2. Colors & Tonal Architecture
The palette is rooted in the deep blues of the Kazakh energy sector and the cold grays of industrial machinery.

### The Palette
*   **Primary (`#0A192F`):** Our foundation. Used for high-impact "Trust Blocks," hero sections, and global navigation. It represents the depth of the industry.
*   **Secondary (`#4A90E2`):** The "Active Blue." This is our signal color for interaction, progress, and focus.
*   **Tertiary (`#2D3436`):** "Dark Graphite." Used for structural elements that require a tactile, metallic feel.
*   **Neutral (`#F8F9FA`):** Our "Cleanroom" white. It provides the necessary air for dense data.

### The "No-Line" Rule
Prohibit the use of 1px solid borders for sectioning content. Boundaries must be defined through:
1.  **Background Shifts:** A `surface-container-low` card sitting on a `surface` background.
2.  **Tonal Transitions:** Using the `surface-container` hierarchy to separate the "Stage" from the "Actor."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
*   **Base:** `surface` (#f8f9fa)
*   **Layout Sections:** `surface-container-low` (#f3f4f5)
*   **Active Cards:** `surface-container-lowest` (#ffffff)
*   **Floating Elements:** Use **Glassmorphism**. Semi-transparent primary colors with a `backdrop-blur` (20px+) to create a "frosted glass" effect over industrial photography.

### Signature Textures
Main CTAs and Hero backgrounds should utilize a subtle linear gradient: 
`Linear-Gradient(135deg, #0A192F 0%, #162a4a 100%)`. This provides a visual "soul" and metallic sheen that flat colors cannot replicate.

---

## 3. Typography
We utilize a dual-font system to balance "Confidence" with "Functionality."

*   **Headlines: Manrope (Bold/Extra-Bold):** Geometric and confident. Use the `display-lg` (3.5rem) for hero statements to command attention. The tight kerning and high x-height reflect modern engineering precision.
*   **Body & UI: Inter:** The industry standard for readability. Use `body-md` (0.875rem) for most data-heavy interfaces to ensure information density remains high without sacrificing clarity.

**Hierarchy Note:** Always maintain a minimum 2:1 scale ratio between Headlines and Body text to ensure an editorial, high-end feel.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle:** Stack surfaces. A `surface-container-highest` navigation bar should feel physically placed atop the `surface` background.
*   **Ambient Shadows:** When an element must float (e.g., a critical alert), use a tinted shadow: `rgba(10, 25, 47, 0.06)` with a 40px blur. This mimics natural light reflecting off a dark industrial surface.
*   **The "Ghost Border":** If a separator is required for accessibility, use the `outline-variant` token at **15% opacity**. Never use 100% opaque lines.

---

## 5. Components

### High-Density Tables
*   **Styling:** Forbid row dividers. Use `surface-container-low` zebra striping or a 4px left-accent border using the `secondary` token on hover.
*   **Content:** Use `label-sm` for table headers in all-caps with 0.05em letter spacing.

### Status Badges (The "Signal" System)
Badges should look like physical industrial plates:
*   **Valid:** `secondary_container` with `on_secondary_container` text.
*   **Expired:** `error_container` with `on_error_container` text.
*   **Critical:** High-contrast `on_error` background with a subtle pulse animation.

### Steppers & Progress
Avoid rounded, "bubbly" steppers. Use sharp `md` (0.375rem) corner radii and "Active Blue" (`#4A90E2`) connecting lines. The aesthetic should mimic a technical flow chart or pipeline.

### Input Fields
*   **Default State:** Background `surface-container-highest`, no border.
*   **Focus State:** 2px bottom-border only using the `secondary` token. This creates a "blueprint" feel.

### Buttons
*   **Primary:** Deep Navy (#0A192F) with a subtle inner-glow (top white border 10% opacity) to give it a 3D "machined" look.
*   **Secondary:** Ghost-style. No background, `outline-variant` ghost border at 20% opacity.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Heavy Industry Imagery:** Focus on high-contrast shots of oil rigs, mining shafts, and certified specialists in Kazakhstan. 
*   **Embrace Whitespace:** Just because the data is "industrial" doesn't mean it should be "cluttered." Use vertical rhythm to separate major modules.
*   **Implement Micro-interactions:** Use "Mechanical" easing (e.g., `cubic-bezier(0.2, 0, 0, 1)`) for transitions to mimic precision machinery.

### Don’t:
*   **Don't use generic illustrations:** No "friendly" 2D characters or edtech-style blobs. This is a high-stakes safety environment.
*   **Don't use high-contrast borders:** Avoid "boxed-in" layouts. Let the tonal shifts define the space.
*   **Don't use standard shadows:** Never use pure black `#000000` shadows. Always tint them with the `primary` navy color.