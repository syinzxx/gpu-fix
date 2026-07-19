# 3D Animated Index (Homepage) — Design

Date: 2026-07-18
Status: Approved by user

## Goal

Rebuild the public homepage (`app/page.tsx`) as a 3D animated landing page for the
GPU repair shop, keeping the existing ticket-code tracking form (server action) and
staff sign-in link fully functional.

## Stack

- `three` + `@react-three/fiber` (React 19 / Next 16 compatible versions), plus
  `@react-three/drei` for helpers.
- The 3D scene is a client component, lazy-loaded so the server-rendered hero text
  and tracking form appear instantly.

## 3D Scene

- Stylized GPU graphics card built procedurally from Three.js primitives:
  dark PCB, fan shroud with two spinning fans, heatsink fins, gold PCIe edge
  connector, glowing RGB accent strip.
- No external model/asset files.

## Animation & Interaction

- Card slowly floats and rotates; tilts toward the mouse cursor; fans spin.
- Violet/cyan lighting matching existing brand colors (`violet-600`, `cyan-400`).
- `prefers-reduced-motion`: static pose, no continuous animation.
- WebGL unavailable: falls back to the existing ambient-glow visual.

## Layout

- Hero: headline + copy + tracking form on one side, 3D card on the other;
  stacked on mobile.
- Keep: tracking form posting to `trackAction` server action, `/login` link,
  `SHOP_NAME` env usage, dark `#0b1120` background.
- No other pages touched.

## Trade-offs

- Adds ~300KB lazy-loaded JS for the 3D scene; acceptable since it doesn't block
  the form or text content.
