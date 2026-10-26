import { NextResponse } from "next/server";

// Cost fix (Oct 2026, owner ruling 17 Oct): the old programmatic combination
// pages were deleted, with no redirects. They rendered on demand for every URL a
// bot asked for, and each render was an ISR write. Every URL in these families
// now answers 410 Gone here, with no rendering, ISR or database:
//   /prepare/<from-origin>   /requirements/**
// Nothing kept lives under either path. New pages are built only by
// AlmiVisibility.
//
// Next 16 "proxy" convention (the renamed middleware).
export function proxy() {
  return new NextResponse("410 Gone — this page has been removed.", {
    status: 410,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
      "x-robots-tag": "noindex",
    },
  });
}

export const config = {
  matcher: ["/prepare/:path+", "/requirements/:path+"],
};
