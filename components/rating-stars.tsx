import { Fragment } from "react";

const DEFAULT_LABELS = ["1 star", "2 stars", "3 stars", "4 stars", "5 stars"];

/**
 * Pure-CSS 5-star radio picker. No client JS needed: the fill-up-to-selection
 * effect comes from rendering the inputs highest-value-first and letting the
 * `peer-checked` sibling rule cascade across every label that follows the
 * checked input in the DOM, then flipping the visual order with
 * flex-row-reverse so star 1 renders on the left.
 */
export function RatingStars({
  name = "rating",
  labels = DEFAULT_LABELS,
}: {
  name?: string;
  /** Accessible names for each star, index n-1 (e.g. labels[0] describes 1 star). */
  labels?: string[];
}) {
  return (
    <div className="flex flex-row-reverse justify-end gap-1" dir="ltr">
      {[5, 4, 3, 2, 1].map((n) => (
        <Fragment key={n}>
          <input
            type="radio"
            id={`rating-star-${n}`}
            name={name}
            value={n}
            required
            className="peer sr-only"
          />
          <label
            htmlFor={`rating-star-${n}`}
            className="cursor-pointer text-3xl leading-none text-slate-200 transition-colors peer-checked:text-amber-400"
          >
            <span aria-hidden>★</span>
            <span className="sr-only">{labels[n - 1] ?? DEFAULT_LABELS[n - 1]}</span>
          </label>
        </Fragment>
      ))}
    </div>
  );
}
